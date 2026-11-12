/* Admin UI bundle deployment sync: admin assets are packaged by Wrangler. */
const API_VERSION = "2022-11-28";
let cachedJwks = null;
let cachedJwksAt = 0;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}


function encodeBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function decodeBase64Url(value) {
  const normalized=value.replace(/-/g,"+").replace(/_/g,"/");
  const padded=normalized+"=".repeat((4-normalized.length%4)%4);
  const binary=atob(padded);
  return Uint8Array.from(binary,char=>char.charCodeAt(0));
}
async function hmac(secret,value) {
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value)));
}
function constantTimeEqual(a,b) {
  if(a.length!==b.length)return false;
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
  return diff===0;
}
function getCookie(request,name) {
  const cookie=request.headers.get("cookie")||"";
  const match=cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="));
  return match?match.slice(name.length+1):"";
}
function sameOrigin(request) {
  const trustedOrigin = "https://cineverse-admin.megamrtklc.workers.dev";
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== trustedOrigin || request.headers.get("host") !== requestUrl.host) return false;

  // Fetch Metadata is browser-generated and reliably distinguishes
  // same-origin form submissions from cross-site requests.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";

  const origin = request.headers.get("origin");
  if (origin) return origin === trustedOrigin;

  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === trustedOrigin;
  } catch {
    return false;
  }
}
function loginPage(showError=false) {
  const error=showError?'<p class="error">Şifre doğru değil. Lütfen tekrar dene.</p>':"";
  const html='<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>CineVerse Yönetici Girişi</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 0,#30251b 0,#17191f 48%,#101116 100%);color:#f4f1eb;font:15px system-ui,sans-serif}.panel{width:min(100%,420px);padding:38px;border:1px solid #ffffff18;border-radius:22px;background:#202127ef;box-shadow:0 24px 80px #0008}.mark{width:42px;height:42px;border-radius:13px;background:linear-gradient(135deg,#d6b36b,#8e632c);display:grid;place-items:center;color:#17191f;font-weight:900;font-size:20px}.eyebrow{margin:25px 0 8px;color:#c9a967;font-size:11px;letter-spacing:2px;font-weight:700}h1{margin:0;font-size:27px}p{color:#a8a8ae;line-height:1.6}.field{display:block;margin:26px 0 14px;color:#d9d5ce;font-size:13px}.field input{display:block;width:100%;margin-top:9px;padding:14px 15px;border:1px solid #ffffff24;border-radius:11px;background:#15161b;color:#fff;font:inherit;outline:none}.field input:focus{border-color:#c9a967;box-shadow:0 0 0 3px #c9a96722}button{width:100%;padding:14px;border:0;border-radius:11px;background:linear-gradient(110deg,#d6b36b,#b78a43);color:#17191f;font:700 14px system-ui;cursor:pointer}.error{margin:0 0 14px;padding:11px 13px;border-radius:9px;background:#7f292933;color:#ffaaaa;font-size:13px}.foot{margin-top:22px;text-align:center;font-size:11px;color:#777982}</style></head><body><main class="panel"><div class="mark">C</div><div class="eyebrow">CINEVERSE / MANAGEMENT STUDIO</div><h1>Yönetici girişi</h1><p>Yönetim merkezine devam etmek için erişim şifreni gir.</p>'+error+'<form method="post" action="/api/login"><label class="field">Yönetici şifresi<input type="password" name="password" autocomplete="current-password" required minlength="10" autofocus></label><button type="submit">Güvenli giriş yap</button></form><div class="foot">Yalnızca yetkili yönetici erişebilir.</div></main></body></html>';
  return new Response(html,{status:200,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"}});
}
async function authorize(request,env) {
  if(!env.ADMIN_PASSWORD||!env.SESSION_SECRET||String(env.SESSION_SECRET).length<32)return {ok:false,status:503,error:"Yönetici girişi henüz yapılandırılmamış."};
  const token=getCookie(request,"cv_admin_session");
  if(!token)return {ok:false,status:401,error:"Yönetici oturumu gerekli."};
  try {
    const parts=token.split(".");
    if(parts.length!==2)throw new Error("Invalid session");
    const payload=JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    const expected=await hmac(env.SESSION_SECRET,parts[0]);
    const supplied=decodeBase64Url(parts[1]);
    if(!constantTimeEqual(expected,supplied)||payload.sub!=="admin"||typeof payload.exp!=="number"||payload.exp<=Math.floor(Date.now()/1000))throw new Error("Invalid session");
    const refreshedPayload=encodeBase64Url(new TextEncoder().encode(JSON.stringify({sub:"admin",iat:payload.iat||Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+43200})));
    const refreshedSignature=encodeBase64Url(await hmac(env.SESSION_SECRET,refreshedPayload));
    return {ok:true,claims:{email:"Yönetici"},cookie:"cv_admin_session="+refreshedPayload+"."+refreshedSignature+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200"};
  } catch { return {ok:false,status:401,error:"Yönetici oturumu doğrulanamadı."}; }
}
async function handleLogin(request,env) {
  if(!sameOrigin(request))return json({error:"Geçersiz istek kaynağı."},403);
  if(!env.ADMIN_PASSWORD||!env.SESSION_SECRET||String(env.SESSION_SECRET).length<32)return json({error:"Yönetici girişi sunucuda yapılandırılmamış."},503);
  if(env.LOGIN_LIMITER) {
    const ip=request.headers.get("cf-connecting-ip")||"unknown";
    const limit=await env.LOGIN_LIMITER.limit({key:ip});
    if(!limit.success)return new Response("Çok fazla giriş denemesi. Bir dakika sonra tekrar dene.",{status:429,headers:{"content-type":"text/plain; charset=utf-8","retry-after":"60","cache-control":"no-store"}});
  }
  const form=await request.formData();
  const password=String(form.get("password")||"");
  if(password.length<10||password.length>256)return loginPage(true);
  const [candidate,expected]=await Promise.all([hmac(env.SESSION_SECRET,password),hmac(env.SESSION_SECRET,env.ADMIN_PASSWORD)]);
  if(!constantTimeEqual(candidate,expected))return new Response(loginPage(true).body,{status:401,headers:loginPage(true).headers});
  const now=Math.floor(Date.now()/1000);
  const payload=encodeBase64Url(new TextEncoder().encode(JSON.stringify({sub:"admin",iat:now,exp:now+300})));
  const signature=encodeBase64Url(await hmac(env.SESSION_SECRET,payload));
  return new Response(null,{status:303,headers:{"location":"/","set-cookie":"cv_admin_session="+payload+"."+signature+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200","cache-control":"no-store"}});
}
async function handleLogout(request) {
  if(!sameOrigin(request))return json({error:"Geçersiz istek kaynağı."},403);
  return new Response(null,{status:303,headers:{"location":"/","set-cookie":"cv_admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0","cache-control":"no-store"}});
}

function githubHeaders(env) {
  return {
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": API_VERSION,
    "user-agent": "CineVerse-Admin-Worker"
  };
}

function profilePhotoUrl(env) {
  const owner=encodeURIComponent(env.GITHUB_OWNER||"megamrtklc");
  const repo=encodeURIComponent(env.GITHUB_REPO||"mrtklc");
  const branch=encodeURIComponent(env.GITHUB_BRANCH||"main");
  return `https://api.github.com/repos/${owner}/${repo}/contents/admin/assets/admin-profile`;
}
async function getProfilePhoto(env) {
  if(!env.GITHUB_TOKEN)return json({error:"GitHub bağlantısı yapılandırılmamış."},503);
  for(const ext of ["webp","png","jpg"]) {
    const response=await fetch(profilePhotoUrl(env)+"."+ext+"?ref="+encodeURIComponent(env.GITHUB_BRANCH||"main"),{headers:githubHeaders(env)});
    if(response.status===404)continue;
    const data=await response.json();
    if(!response.ok)return json({error:data.message||"Profil fotoğrafı okunamadı."},502);
    return json({url:data.download_url||("https://raw.githubusercontent.com/"+(env.GITHUB_OWNER||"megamrtklc")+"/"+(env.GITHUB_REPO||"mrtklc")+"/"+(env.GITHUB_BRANCH||"main")+"/admin/assets/admin-profile."+ext)+"?v="+encodeURIComponent(data.sha||"")});
  }
  return json({url:null});
}
async function saveProfilePhoto(request,env) {
  if(!sameOrigin(request))return json({error:"Geçersiz istek kaynağı."},403);
  if(!env.GITHUB_TOKEN)return json({error:"GitHub bağlantısı yapılandırılmamış."},503);
  const length=Number(request.headers.get("content-length")||0);
  if(length>1050000)return json({error:"Fotoğraf boyutu 700 KB sınırını aşıyor."},413);
  const body=await request.json();
  const mime=String(body?.mime||"");
  const allowed={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
  if(!allowed[mime]||typeof body?.base64!=="string"||body.base64.length>960000)return json({error:"Yalnızca JPG, PNG veya WebP fotoğraf yükleyebilirsin (en fazla 700 KB)."},400);
  let bytes;
  try{bytes=Uint8Array.from(atob(body.base64),c=>c.charCodeAt(0));}catch{return json({error:"Fotoğraf verisi okunamadı."},400);}
  if(bytes.length<16||bytes.length>716800)return json({error:"Fotoğraf boyutu 700 KB sınırını aşmamalı."},413);
  const signature=Array.from(bytes.slice(0,12));
  const valid=mime==="image/jpeg"?signature[0]===255&&signature[1]===216&&signature[2]===255:
    mime==="image/png"?signature.slice(0,8).join(",")==="137,80,78,71,13,10,26,10":
    signature.slice(0,4).map(x=>String.fromCharCode(x)).join("")==="RIFF"&&signature.slice(8,12).map(x=>String.fromCharCode(x)).join("")==="WEBP";
  if(!valid)return json({error:"Dosya içeriği seçilen görsel biçimiyle eşleşmiyor."},400);
  const ext=allowed[mime],path="admin/assets/admin-profile."+ext;
  const owner=encodeURIComponent(env.GITHUB_OWNER||"megamrtklc"),repo=encodeURIComponent(env.GITHUB_REPO||"mrtklc");
  const branch=env.GITHUB_BRANCH||"main",base=`https://api.github.com/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
  // Upload the replacement first so a failed upload never removes the current photo.
  const existing=await fetch(base+"?ref="+encodeURIComponent(branch),{headers:githubHeaders(env)});
  let sha;
  if(existing.ok)sha=(await existing.json()).sha;
  else if(existing.status!==404)return json({error:"Mevcut profil fotoğrafı kontrol edilemedi."},502);
  const encoded=encodeBase64Url(bytes).replace(/-/g,"+").replace(/_/g,"/");
  const content=encoded+"=".repeat((4-encoded.length%4)%4);
  const response=await fetch(base,{method:"PUT",headers:{...githubHeaders(env),"content-type":"application/json"},body:JSON.stringify({message:"Update CineVerse admin profile photo",content,sha,branch})});
  const result=await response.json();
  if(!response.ok)return json({error:result.message||"Profil fotoğrafı kaydedilemedi."},502);

  // Only after the new image is stored, remove files from older formats.
  for(const oldExt of ["jpg","png","webp"]) {
    if(oldExt===ext)continue;
    const oldPath="admin/assets/admin-profile."+oldExt;
    const oldUrl=`https://api.github.com/repos/${owner}/${repo}/contents/${oldPath.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`;
    try {
      const oldRes=await fetch(oldUrl,{headers:githubHeaders(env)});
      if(!oldRes.ok)continue;
      const old=await oldRes.json();
      const del=await fetch(oldUrl.split("?")[0],{method:"DELETE",headers:{...githubHeaders(env),"content-type":"application/json"},body:JSON.stringify({message:"Remove previous CineVerse admin profile photo",sha:old.sha,branch})});
      if(!del.ok)console.warn("Previous admin profile photo cleanup failed:",oldExt,del.status);
    } catch(error) {
      console.warn("Previous admin profile photo cleanup failed:",oldExt,error);
    }
  }
  return json({ok:true,url:"https://raw.githubusercontent.com/"+(env.GITHUB_OWNER||"megamrtklc")+"/"+(env.GITHUB_REPO||"mrtklc")+"/"+branch+"/admin/assets/admin-profile."+ext+"?v="+encodeURIComponent(result.content?.sha||Date.now())});
}

function catalogUrl(env) {
  const owner = encodeURIComponent(env.GITHUB_OWNER || "megamrtklc");
  const repo = encodeURIComponent(env.GITHUB_REPO || "mrtklc");
  const path = String(env.GITHUB_CATALOG_PATH || "filmvediziler.json").split("/").map(encodeURIComponent).join("/");
  const branch = encodeURIComponent(env.GITHUB_BRANCH || "main");
  return `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
}

// Admin UI is served from this Worker asset bundle; keep catalog reads independent from write-token scope.
// Redeploy the corrected admin asset bundle with the current UI selector fixes.
async function readCatalog(env) {
  const headers = env.GITHUB_TOKEN ? githubHeaders(env) : { accept: "application/vnd.github+json", "x-github-api-version": API_VERSION, "user-agent": "CineVerse-Admin-Worker" };
  let response = await fetch(catalogUrl(env), { headers });
  let usedAuthenticatedRead = !!env.GITHUB_TOKEN && response.ok;
  let payload = await response.json().catch(() => ({}));

  // The repository is public. If a stored token is expired or mis-scoped,
  // keep the admin readable through GitHub's public Contents API.
  if (!response.ok || !payload.content || !payload.sha) {
    response = await fetch(catalogUrl(env), {
      headers: { accept: "application/vnd.github+json", "x-github-api-version": API_VERSION, "user-agent": "CineVerse-Admin-Worker" }
    });
    payload = await response.json().catch(() => ({}));
    usedAuthenticatedRead = false;
  }

  if (!response.ok || !payload.content || !payload.sha) {
    const rawUrl = "https://raw.githubusercontent.com/" +
      (env.GITHUB_OWNER || "megamrtklc") + "/" +
      (env.GITHUB_REPO || "mrtklc") + "/" +
      (env.GITHUB_BRANCH || "main") + "/" +
      (env.GITHUB_CATALOG_PATH || "filmvediziler.json");
    const rawResponse = await fetch(rawUrl, { headers: { "cache-control": "no-cache" } });
    if (!rawResponse.ok) throw new Error(payload.message || "GitHub kataloğu okunamadı (" + response.status + ").");
    const data = await rawResponse.json();
    if (!data || !Array.isArray(data.catalog)) throw new Error("Katalog JSON yapısı beklenen biçimde değil.");
    return { data, sha: null, writable: false, readOnlyReason: "Katalog görüntüleniyor; güvenli yazma bağlantısı doğrulanamadı." };
  }

  const binary = atob(payload.content.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || !Array.isArray(data.catalog)) throw new Error("Katalog JSON yapısı beklenen biçimde değil.");
  return {
    data,
    sha: payload.sha,
    writable: usedAuthenticatedRead && !!env.GITHUB_TOKEN,
    readOnlyReason: usedAuthenticatedRead ? null : "Katalog açık GitHub kaynağından yüklendi; düzenleme için GitHub erişim anahtarını yenilemek gerekiyor."
  };
}
async function writeCatalog(env, data, expectedSha) {
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN secret tanımlanmamış.");
  if (!data || typeof data !== "object" || !Array.isArray(data.catalog)) throw new Error("Gönderilen katalog yapısı geçersiz.");
  if (data.catalog.length < 1 || data.catalog.length > 5000) throw new Error("Katalog kayıt sayısı sınır dışında.");
  if (JSON.stringify(data).length > 2_000_000) throw new Error("Katalog boyutu 2 MB sınırını aşıyor.");
  const ids = new Set();
  for (const item of data.catalog) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Katalogda geçersiz kayıt bulundu.");
    if (item.id === undefined || item.id === null || !String(item.id).trim()) throw new Error("Her katalog kaydının benzersiz bir kimliği olmalı.");
    if (typeof item.title !== "string" || !item.title.trim()) throw new Error("Her katalog kaydının yapım adı olmalı.");
    const id = String(item.id);
    if (ids.has(id)) throw new Error("Katalogda yinelenen kayıt kimliği var: " + id);
    ids.add(id);
    for (const field of ["image", "backdrop", "trailerUrl", "watchUrl"]) {
      if (!item[field]) continue;
      const value = String(item[field]).trim();
      // Legacy catalog entries may store an 11-character YouTube video ID instead of a URL.
      if (field === "trailerUrl" && /^[A-Za-z0-9_-]{11}$/.test(value)) continue;
      try {
        const parsed = new URL(value);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("invalid protocol");
      } catch {
        throw new Error("Geçersiz görsel veya fragman adresi: " + field);
      }
    }
  }

  const current = await fetch(catalogUrl(env), { headers: githubHeaders(env) });
  const currentPayload = await current.json();
  if (!current.ok) throw new Error(currentPayload.message || "Güncel katalog SHA bilgisi alınamadı.");
  if (currentPayload.sha !== expectedSha) return { conflict: true, sha: currentPayload.sha };

  const encoded = bytesToBase64(new TextEncoder().encode(JSON.stringify(data, null, 2)));
  const response = await fetch(catalogUrl(env).split("?")[0], {
    method: "PUT",
    headers: { ...githubHeaders(env), "content-type": "application/json" },
    body: JSON.stringify({
      message: "Update CineVerse catalog from admin",
      content: encoded,
      sha: expectedSha,
      branch: env.GITHUB_BRANCH || "main"
    })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Katalog GitHub'a kaydedilemedi.");
  return { conflict: false, sha: result.content?.sha || null, commit: result.commit?.sha || null };
}

export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    // Normalize optional trailing slashes so /api/catalog and /api/catalog/ resolve identically.
    const path=url.pathname.replace(/\/+$/,"")||"/";
    if(request.method==="POST"&&path==="/api/login")return handleLogin(request,env);
    if(request.method==="POST"&&path==="/api/logout")return handleLogout(request);
    const auth=await authorize(request,env);
    if(!auth.ok) {
      if(path.startsWith("/api/"))return json({error:auth.error},auth.status);
      return loginPage();
    }
    const response=await (async()=>{
      if(!path.startsWith("/api/"))return env.ASSETS.fetch(request);
      if(request.method==="GET"&&path==="/api/session")return json({authenticated:true,email:auth.claims.email||"Yönetici"});
      if(request.method==="GET"&&path==="/api/profile-photo")return getProfilePhoto(env);
      if(request.method==="POST"&&path==="/api/profile-photo") {
        try{return await saveProfilePhoto(request,env);}
        catch(error){return json({error:error.message||"Profil fotoğrafı kaydedilemedi."},502);}
      }
      if(request.method==="GET"&&path==="/api/catalog") {
        try { return json(await readCatalog(env)); }
        catch(error) { return json({error:error.message||"Katalog okunamadı."},502); }
      }
      if(request.method==="PUT"&&path==="/api/catalog") {
        if(!sameOrigin(request))return json({error:"Geçersiz istek kaynağı."},403);
        try {
          const length=Number(request.headers.get("content-length")||0);
          if(length>2500000)return json({error:"İstek boyutu sınırı aşıldı."},413);
          const body=await request.json();
          if(!body||typeof body.sha!=="string"||!body.sha)return json({error:"Güncel katalog SHA bilgisi gerekli."},400);
          const result=await writeCatalog(env,body.data,body.sha);
          if(result.conflict)return json({error:"Katalog başka bir işlemde güncellenmiş. Veriyi yeniden yükleyip tekrar deneyin.",sha:result.sha},409);
          return json({ok:true,sha:result.sha,commit:result.commit});
        } catch(error) { return json({error:error.message||"Katalog kaydedilemedi."},400); }
      }
      return json({error:"API endpoint bulunamadı."},404);
    })();
    const headers=new Headers(response.headers);
    headers.set("set-cookie",auth.cookie);
    headers.set("cache-control","no-store");
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
};
