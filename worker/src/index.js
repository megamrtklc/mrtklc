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
  if (requestUrl.origin !== trustedOrigin) return false;

  const origin = request.headers.get("origin");
  if (origin) return origin === trustedOrigin;

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === trustedOrigin;
    } catch {
      return false;
    }
  }

  // Some browser form submissions omit Origin and Referer. In that case,
  // require the browser's same-origin Fetch Metadata and the expected host.
  return request.headers.get("sec-fetch-site") === "same-origin"
    && request.headers.get("host") === requestUrl.host;
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
    return {ok:true,claims:{email:"Yönetici"}};
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
  const payload=encodeBase64Url(new TextEncoder().encode(JSON.stringify({sub:"admin",iat:now,exp:now+43200})));
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

function catalogUrl(env) {
  const owner = encodeURIComponent(env.GITHUB_OWNER || "megamrtklc");
  const repo = encodeURIComponent(env.GITHUB_REPO || "mrtklc");
  const path = String(env.GITHUB_CATALOG_PATH || "filmvediziler.json").split("/").map(encodeURIComponent).join("/");
  const branch = encodeURIComponent(env.GITHUB_BRANCH || "main");
  return `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
}

async function readCatalog(env) {
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN secret tanımlanmamış.");
  const response = await fetch(catalogUrl(env), { headers: githubHeaders(env) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "GitHub kataloğu okunamadı.");
  if (!payload.content || !payload.sha) throw new Error("GitHub katalog içeriği veya SHA bilgisi eksik.");
  const binary = atob(payload.content.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || !Array.isArray(data.catalog)) throw new Error("Katalog JSON yapısı beklenen biçimde değil.");
  return { data, sha: payload.sha };
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
    for (const field of ["image", "backdrop", "trailerUrl"]) {
      if (!item[field]) continue;
      try {
        const parsed = new URL(String(item[field]));
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
    if(request.method==="POST"&&url.pathname==="/api/login")return handleLogin(request,env);
    if(request.method==="POST"&&url.pathname==="/api/logout")return handleLogout(request);
    const auth=await authorize(request,env);
    if(!auth.ok) {
      if(url.pathname.startsWith("/api/"))return json({error:auth.error},auth.status);
      return loginPage();
    }
    if(!url.pathname.startsWith("/api/"))return env.ASSETS.fetch(request);
    if(request.method==="GET"&&url.pathname==="/api/session")return json({authenticated:true,email:auth.claims.email||"Yönetici"});
    if(request.method==="GET"&&url.pathname==="/api/catalog") {
      try { return json(await readCatalog(env)); }
      catch(error) { return json({error:error.message||"Katalog okunamadı."},502); }
    }
    if(request.method==="PUT"&&url.pathname==="/api/catalog") {
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
  }
};
