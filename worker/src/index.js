/* Admin UI bundle deployment sync: admin assets are packaged by Wrangler. */
const API_VERSION = "2022-11-28";
const BRAND_CONFIG_DEFAULTS = {"brandName":"MRTSINEMA","shortName":"MRT","slogan":"Film ve dizi arşivinin kişisel merkezi","pageTitle":"MRTSINEMA","metaDescription":"Film ve dizi arşivinin kişisel merkezi.","copyright":"© 2026 MRTSINEMA. Tüm hakları saklıdır.","adminSubtitle":"YÖNETİM PANELİ","scopes":{"site":true,"admin":true,"login":true,"seo":true}};
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

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
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
function escapeBrandHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));}
function loginPage(showError=false,brandConfig=BRAND_CONFIG_DEFAULTS) {
  const brandName=escapeBrandHtml(brandConfig?.brandName||BRAND_CONFIG_DEFAULTS.brandName);
  const shortName=escapeBrandHtml(brandConfig?.shortName||BRAND_CONFIG_DEFAULTS.shortName);
  const slogan=escapeBrandHtml(brandConfig?.slogan||BRAND_CONFIG_DEFAULTS.slogan);
  const adminSubtitle=escapeBrandHtml(brandConfig?.adminSubtitle||BRAND_CONFIG_DEFAULTS.adminSubtitle);
  const error=showError?'<div class="error" role="alert" aria-live="assertive"><span class="error-icon" aria-hidden="true">!</span><span><strong>Giriş yapılamadı</strong><small>Şifre doğrulanamadı. Bilgini kontrol edip tekrar dene.</small></span></div>':"";
  const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#090a0d"><title>${brandName} · Yönetim Merkezi</title><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="/fonts.css?v=20261124-login-v2"><style>
*{box-sizing:border-box}
:root{color-scheme:dark;--gold:#d7b56d;--gold-bright:#f0d99e;--muted:#a5a4a2}
html{min-height:100%;background:#090a0d}
body{position:relative;isolation:isolate;margin:0;min-height:100vh;min-height:100svh;display:flex;align-items:center;justify-content:center;padding:28px 20px;background:radial-gradient(ellipse at 50% 12%,rgba(180,139,68,.13),transparent 42%),radial-gradient(ellipse at 8% 88%,rgba(120,91,48,.09),transparent 34%),linear-gradient(145deg,#090a0d 0%,#101116 52%,#090a0d 100%);color:#f5f1e8;font:15px Inter,system-ui,sans-serif}
body:before,body:after{content:"";position:fixed;inset:0;pointer-events:none;z-index:-1}
body:before{opacity:.16;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:46px 46px;mask-image:radial-gradient(ellipse at center,#000,transparent 78%)}
body:after{background:radial-gradient(ellipse at center,transparent 35%,rgba(0,0,0,.42) 100%)}
.login-shell{width:min(100%,460px);position:relative;z-index:2;margin:auto 0}
.login-panel{position:relative;z-index:3;overflow:hidden;padding:clamp(28px,6vw,46px);border:1px solid rgba(215,181,109,.38);border-radius:26px;background:linear-gradient(145deg,#191a20 0%,#101116 100%);box-shadow:0 30px 100px rgba(0,0,0,.72),0 0 70px rgba(215,181,109,.09)}
.login-panel:before{content:"";position:absolute;top:0;left:12%;right:12%;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent);opacity:.8}
.brand-lockup{display:flex;align-items:center;gap:14px}
.brand-mark{width:58px;height:58px;flex:0 0 58px;display:grid;place-items:center;border:1px solid rgba(240,217,158,.68);border-radius:17px;background:linear-gradient(145deg,#e6cb8b,#9b743b);box-shadow:0 9px 28px rgba(215,181,109,.2);color:#171717}
.brand-mark{position:relative;isolation:isolate;overflow:hidden;transition:transform .28s ease,box-shadow .28s ease}.brand-mark:after{content:"";position:absolute;inset:1px;border:1px solid rgba(255,255,255,.3);border-radius:inherit;pointer-events:none}.brand-mark svg{position:relative;z-index:1;width:37px;height:37px;filter:drop-shadow(0 1px 1px rgba(255,255,255,.22))}.brand-lockup:hover .brand-mark{transform:translateY(-2px);box-shadow:0 12px 34px rgba(215,181,109,.3)}
.brand-copy{min-width:0}
.brand-name{font-size:16px;font-weight:800;letter-spacing:2.4px;color:#f4ead2}
.brand-tag{margin-top:5px;color:#b9a77f;font-size:9px;font-weight:700;letter-spacing:2.1px;text-transform:uppercase}
.eyebrow{margin:32px 0 9px;color:var(--gold);font-size:10px;font-weight:750;letter-spacing:2.7px;text-transform:uppercase}
h1{margin:0;color:#fff;font-size:clamp(25px,5vw,31px);font-weight:700;letter-spacing:-.8px}
.intro{margin:12px 0 0;color:#b6b4b0;font-size:13px;line-height:1.75}
.login-form{margin-top:28px}
.field-label{display:block;margin:0 0 10px;color:#e5dfd2;font-size:12px;font-weight:650;letter-spacing:.25px}
.password-wrap{position:relative}
.password-input{display:block;width:100%;height:54px;padding:0 58px 0 16px;border:1px solid rgba(255,255,255,.14);border-radius:12px;outline:none;background:rgba(5,7,11,.66);color:#fff;font:inherit;letter-spacing:1.5px;transition:border-color .2s,box-shadow .2s}
.password-input::placeholder{color:#77777b;letter-spacing:0}
.password-input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(215,181,109,.14)}
.toggle-password{position:absolute;top:50%;right:8px;transform:translateY(-50%);width:40px;height:38px;display:grid;place-items:center;border:0;border-radius:9px;background:transparent;color:#aaa69c;cursor:pointer}
.toggle-password:hover,.toggle-password:focus-visible{background:rgba(215,181,109,.12);color:var(--gold-bright);outline:none}
.toggle-password svg{width:19px;height:19px}
.submit-button{width:100%;min-height:54px;margin-top:18px;display:flex;align-items:center;justify-content:center;gap:11px;border:1px solid rgba(255,231,178,.5);border-radius:12px;background:linear-gradient(110deg,#e2c47e,#bd914c);color:#171713;font:750 13px Inter,system-ui,sans-serif;letter-spacing:.25px;cursor:pointer;box-shadow:0 10px 28px rgba(173,129,55,.2);transition:filter .2s,transform .2s,box-shadow .2s}
.submit-button:hover{filter:brightness(1.08);transform:translateY(-1px);box-shadow:0 13px 32px rgba(173,129,55,.28)}
.submit-button:focus-visible{outline:2px solid var(--gold-bright);outline-offset:3px}
.submit-button:disabled{cursor:wait;opacity:.85;transform:none}
.spinner{width:18px;height:18px;flex:0 0 18px;border:2px solid rgba(23,23,19,.22);border-top-color:#171713;border-right-color:#171713;border-radius:50%;animation:spin .65s cubic-bezier(.5,.1,.5,.9) infinite}.submit-button[aria-busy="true"]{background:linear-gradient(110deg,#d8bb78,#b88b47);box-shadow:0 0 0 3px rgba(215,181,109,.12),0 10px 28px rgba(173,129,55,.22)}
@keyframes spin{to{transform:rotate(360deg)}}
.error{display:flex;align-items:flex-start;gap:11px;margin:0 0 18px;padding:13px 14px;border:1px solid rgba(239,112,112,.3);border-radius:12px;background:rgba(111,32,37,.22);color:#ffd0ce}
.error-icon{width:23px;height:23px;flex:0 0 23px;display:grid;place-items:center;border-radius:50%;background:rgba(239,112,112,.16);color:#ff9b97;font-weight:800}
.error strong,.error small{display:block}
.error strong{font-size:12px}
.error small{margin-top:4px;color:#e4aaa7;font-size:11px;line-height:1.5}
.security-note{display:flex;justify-content:center;align-items:center;gap:7px;margin:23px 0 0;color:#aaa69d;font-size:10px;letter-spacing:.2px}
.security-note svg{width:14px;height:14px;color:var(--gold)}
.panel-footer{margin-top:25px;padding-top:17px;border-top:1px solid rgba(255,255,255,.1);text-align:center;color:#777873;font-size:9px;letter-spacing:1.25px}
@media(max-width:520px){body{align-items:flex-start;padding:max(22px,env(safe-area-inset-top)) 14px max(22px,env(safe-area-inset-bottom))}.login-shell{width:100%;max-width:420px;margin:auto 0}.login-panel{padding:29px 23px;border-radius:21px}.brand-mark{width:52px;height:52px;flex-basis:52px;border-radius:15px}.eyebrow{margin-top:27px}.intro{font-size:12px}.login-form{margin-top:24px}.password-input,.submit-button{min-height:54px}}
@media(max-height:700px){body{align-items:flex-start;padding-top:max(16px,env(safe-area-inset-top));padding-bottom:max(16px,env(safe-area-inset-bottom))}.login-shell{margin:auto 0}.login-panel{padding-top:26px;padding-bottom:26px}.eyebrow{margin-top:20px}.login-form{margin-top:18px}.security-note{margin-top:15px}.panel-footer{margin-top:16px}}
body.keyboard-open{align-items:flex-start;padding-top:max(10px,env(safe-area-inset-top));padding-bottom:12px}body.keyboard-open .login-shell{margin:0 auto}body.keyboard-open .login-panel{padding-top:22px;padding-bottom:20px}body.keyboard-open .eyebrow{margin-top:16px}body.keyboard-open .login-form{margin-top:14px}body.keyboard-open .security-note,body.keyboard-open .panel-footer{margin-top:12px}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
</style></head><body><main class="login-shell"><section class="login-panel" aria-labelledby="login-title"><div class="brand-lockup"><div class="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M8 11h32v26H8z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M8 18h32M8 30h32" stroke="currentColor" stroke-width="1.5" opacity=".65"/><path d="m15 11 5 7m5-7 5 7m5-7 2 3M15 30l-2 7m12-7-2 7m12-7-2 7" stroke="currentColor" stroke-width="1.5" opacity=".55"/><path d="m18 25 5-4v8l-5-4Zm12-4v8l-5-4 5-4Z" fill="currentColor"/></svg></div><div class="brand-copy"><div class="brand-name">${brandName}</div><div class="brand-tag">${adminSubtitle}</div></div></div><div class="eyebrow">YÖNETİCİ GİRİŞİ</div><h1 id="login-title">Yönetim Merkezi</h1><p class="intro">${slogan}. Devam etmek için yönetici hesabının erişim şifresini gir.</p>${error}<form class="login-form" id="login-form" method="post" action="/api/login"><label class="field-label" for="admin-password">Yönetici şifresi</label><div class="password-wrap"><input class="password-input" id="admin-password" type="password" name="password" placeholder="Şifreni gir" autocomplete="current-password" required minlength="10" maxlength="256" autofocus><button class="toggle-password" id="toggle-password" type="button" aria-label="Şifreyi göster" aria-pressed="false"><svg id="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div><button class="submit-button" id="submit-button" type="submit"><span id="submit-label">Güvenli giriş yap</span></button></form><div class="security-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><span>Şifreli bağlantı · Yetkili yönetici erişimi</span></div><div class="panel-footer">${brandName} · ${adminSubtitle}</div></section></main><script>
(function(){
  var input=document.getElementById("admin-password");
  var toggle=document.getElementById("toggle-password");
  var form=document.getElementById("login-form");
  var submit=document.getElementById("submit-button");
  var label=document.getElementById("submit-label");
  var icon=document.getElementById("eye-icon");
  if(toggle&&input){toggle.addEventListener("click",function(){var visible=input.type==="password";input.type=visible?"text":"password";toggle.setAttribute("aria-label",visible?"Şifreyi gizle":"Şifreyi göster");toggle.setAttribute("aria-pressed",visible?"true":"false");icon.innerHTML=visible?'<path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.8"/><path d="M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10 10 0 0 0 4-.8"/>':'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>';});}
  if(form&&submit){form.addEventListener("submit",function(){if(!form.reportValidity())return;submit.disabled=true;submit.setAttribute("aria-busy","true");label.textContent="Güvenli bağlantı kuruluyor…";var spinner=document.createElement("span");spinner.className="spinner";spinner.setAttribute("aria-hidden","true");submit.insertBefore(spinner,submit.firstChild);});}\n  var viewport=window.visualViewport;\n  function syncKeyboardLayout(){if(!viewport)return;document.body.classList.toggle("keyboard-open",viewport.height<560);}\n  if(viewport){viewport.addEventListener("resize",syncKeyboardLayout);viewport.addEventListener("scroll",syncKeyboardLayout);syncKeyboardLayout();}
})();
</script></body></html>`;
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
    const refreshedPayload=encodeBase64Url(new TextEncoder().encode(JSON.stringify({sub:"admin",iat:payload.iat||Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+7200})));
    const refreshedSignature=encodeBase64Url(await hmac(env.SESSION_SECRET,refreshedPayload));
    return {ok:true,claims:{email:"Yönetici"},cookie:"cv_admin_session="+refreshedPayload+"."+refreshedSignature+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=7200"};
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
  if(password.length<10||password.length>256){let loginBrand=BRAND_CONFIG_DEFAULTS;try{const loaded=await readBrandConfig(env);if(loaded.config)loginBrand=loaded.config;}catch(error){}return loginPage(true,loginBrand);}
  const [candidate,expected]=await Promise.all([hmac(env.SESSION_SECRET,password),hmac(env.SESSION_SECRET,env.ADMIN_PASSWORD)]);
  if(!constantTimeEqual(candidate,expected)){let loginBrand=BRAND_CONFIG_DEFAULTS;try{const loaded=await readBrandConfig(env);if(loaded.config)loginBrand=loaded.config;}catch(error){}const page=loginPage(true,loginBrand);return new Response(page.body,{status:401,headers:page.headers});}
  const now=Math.floor(Date.now()/1000);
  const payload=encodeBase64Url(new TextEncoder().encode(JSON.stringify({sub:"admin",iat:now,exp:now+7200})));
  const signature=encodeBase64Url(await hmac(env.SESSION_SECRET,payload));
  return new Response(null,{status:303,headers:{"location":"/","set-cookie":"cv_admin_session="+payload+"."+signature+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=7200","cache-control":"no-store"}});
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
export function validateCatalogData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.catalog)) throw new Error("Gönderilen katalog yapısı geçersiz.");
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
      if (field === "trailerUrl" && /^[A-Za-z0-9_-]{11}$/.test(value)) continue;
      try {
        const parsed = new URL(value);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("invalid protocol");
      } catch {
        throw new Error("Geçersiz görsel veya fragman adresi: " + field);
      }
    }
  }
  if (data.collections !== undefined) {
    if (!Array.isArray(data.collections) || data.collections.length > 500) throw new Error("Koleksiyon listesi geçersiz.");
    const collectionIds = new Set();
    for (const collection of data.collections) {
      if (!collection || typeof collection !== "object" || Array.isArray(collection)) throw new Error("Koleksiyonda geçersiz kayıt bulundu.");
      const id = String(collection.id ?? "").trim();
      if (!id || collectionIds.has(id)) throw new Error("Koleksiyon kimliği boş veya yinelenmiş.");
      collectionIds.add(id);
      if (typeof collection.title !== "string" || !collection.title.trim() || collection.title.length > 180) throw new Error("Koleksiyon adı geçersiz.");
      if (collection.description !== undefined && (typeof collection.description !== "string" || collection.description.length > 5000)) throw new Error("Koleksiyon açıklaması geçersiz.");
      if (collection.active !== undefined && typeof collection.active !== "boolean") throw new Error("Koleksiyon yayın durumu geçersiz.");
      if (collection.items !== undefined && (!Array.isArray(collection.items) || collection.items.length > data.catalog.length)) throw new Error("Koleksiyon içerik listesi geçersiz.");
      const itemIds = new Set();
      for (const itemId of collection.items || []) {
        const key = String(itemId);
        if (!ids.has(key)) throw new Error("Koleksiyonda katalogda bulunmayan bir yapım seçilmiş.");
        if (itemIds.has(key)) throw new Error("Koleksiyonda aynı yapım birden fazla kez seçilmiş.");
        itemIds.add(key);
      }
    }
  }
  if (data.homepageConfig !== undefined) {
    const config = data.homepageConfig;
    if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Ana sayfa vitrin ayarları geçersiz.");
    const settings = config.settings || {};
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new Error("Vitrin görüntü ayarları geçersiz.");
    for (const [field,min,max] of [["desktopCount",1,20],["mobileCount",1,12],["interval",2,60]]) {
      if (settings[field] !== undefined && (!Number.isInteger(Number(settings[field])) || Number(settings[field]) < min || Number(settings[field]) > max)) throw new Error("Vitrin ayarı sınır dışında: " + field);
    }
    for (const field of ["autoplay","pauseOnHover"]) {
      if (settings[field] !== undefined && typeof settings[field] !== "boolean") throw new Error("Vitrin ayarı geçersiz: " + field);
    }
    if (config.heroSlides !== undefined && (!Array.isArray(config.heroSlides) || config.heroSlides.length > data.catalog.length)) throw new Error("Vitrin yapım listesi geçersiz.");
    const slideIds = new Set();
    for (const slide of config.heroSlides || []) {
      if (!slide || typeof slide !== "object" || Array.isArray(slide)) throw new Error("Vitrinde geçersiz yapım kaydı bulundu.");
      const id = String(slide.id ?? "");
      if (!ids.has(id)) throw new Error("Vitrinde katalogda bulunmayan bir yapım seçilmiş.");
      if (slideIds.has(id)) throw new Error("Vitrinde aynı yapım birden fazla kez seçilmiş.");
      slideIds.add(id);
    }
  }
  return true;
}

async function writeCatalog(env, data, expectedSha) {
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN secret tanımlanmamış.");
  validateCatalogData(data);

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

function brandConfigUrl(env,withRef=true){
 const owner=encodeURIComponent(env.GITHUB_OWNER||"megamrtklc"),repo=encodeURIComponent(env.GITHUB_REPO||"mrtklc");
 const base="https://api.github.com/repos/"+owner+"/"+repo+"/contents/brand-config.json";
 return withRef?base+"?ref="+encodeURIComponent(env.GITHUB_BRANCH||"main"):base;
}
async function readBrandConfig(env){
 const headers=env.GITHUB_TOKEN?githubHeaders(env):{"accept":"application/vnd.github+json","x-github-api-version":API_VERSION,"user-agent":"CineVerse-Admin-Worker"};
 const response=await fetch(brandConfigUrl(env),{headers});
 if(response.status===404)return {config:BRAND_CONFIG_DEFAULTS,sha:null};
 const payload=await response.json().catch(()=>({}));
 if(!response.ok||!payload.content)throw new Error(payload.message||"Marka ayarları okunamadı.");
 const bytes=Uint8Array.from(atob(String(payload.content).replace(/\s/g,"")),ch=>ch.charCodeAt(0));
 const config=JSON.parse(new TextDecoder().decode(bytes));
 return {config:{...BRAND_CONFIG_DEFAULTS,...config,scopes:{...BRAND_CONFIG_DEFAULTS.scopes,...(config.scopes||{})}},sha:payload.sha||null};
}
async function writeBrandConfig(env,config,expectedSha){
 if(!env.GITHUB_TOKEN)throw new Error("GITHUB_TOKEN secret tanımlanmamış.");
 if(!config||typeof config!=="object"||Array.isArray(config))throw new Error("Marka ayarları geçersiz.");
 const clean={brandName:String(config.brandName||"").trim().slice(0,40),shortName:String(config.shortName||"").trim().slice(0,16),slogan:String(config.slogan||"").trim().slice(0,100),pageTitle:String(config.pageTitle||"").trim().slice(0,80),metaDescription:String(config.metaDescription||"").trim().slice(0,240),copyright:String(config.copyright||"").trim().slice(0,120),adminSubtitle:String(config.adminSubtitle||"").trim().slice(0,48),scopes:{site:config.scopes?.site!==false,admin:config.scopes?.admin!==false,login:config.scopes?.login!==false,seo:config.scopes?.seo!==false}};
 if(!clean.brandName||!clean.pageTitle)throw new Error("Ana marka adı ve sayfa başlığı zorunludur.");
 const currentResponse=await fetch(brandConfigUrl(env),{headers:githubHeaders(env)});let currentSha=null;
 if(currentResponse.ok){const current=await currentResponse.json();currentSha=current.sha||null;}
 else if(currentResponse.status!==404){const error=await currentResponse.json().catch(()=>({}));throw new Error(error.message||"Mevcut marka ayarları kontrol edilemedi.");}
 if(currentSha!==(expectedSha||null))return {conflict:true,sha:currentSha};
 const content=bytesToBase64(new TextEncoder().encode(JSON.stringify(clean,null,2)));
 const response=await fetch(brandConfigUrl(env,false),{method:"PUT",headers:{...githubHeaders(env),"content-type":"application/json"},body:JSON.stringify({message:"Update brand identity settings",content,sha:currentSha||undefined,branch:env.GITHUB_BRANCH||"main"})});
 const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.message||"Marka ayarları kaydedilemedi.");
 return {conflict:false,sha:result.content?.sha||null,commit:result.commit?.sha||null,config:clean};
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
      let loginBrand=BRAND_CONFIG_DEFAULTS;
      try{const loaded=await readBrandConfig(env);if(loaded.config?.scopes?.login!==false)loginBrand=loaded.config;}catch(error){}
      return loginPage(false,loginBrand);
    }
    const response=await (async()=>{
      if(!path.startsWith("/api/"))return env.ASSETS.fetch(request);
      if(request.method==="GET"&&path==="/api/brand-config") {
        try { return json(await readBrandConfig(env)); }
        catch(error) { return json({error:error.message||"Marka ayarları okunamadı."},502); }
      }
      if(request.method==="PUT"&&path==="/api/brand-config") {
        if(!sameOrigin(request))return json({error:"Geçersiz istek kaynağı."},403);
        try { const body=await request.json();const result=await writeBrandConfig(env,body?.config,body?.sha);
          if(result.conflict)return json({error:"Marka ayarları başka bir işlemde güncellenmiş.",sha:result.sha},409);
          return json({ok:true,sha:result.sha,commit:result.commit,config:result.config});
        } catch(error) { return json({error:error.message||"Marka ayarları kaydedilemedi."},400); }
      }
      if(request.method==="GET"&&path==="/api/session")return json({authenticated:true,email:auth.claims.email||"Yönetici"});
      if(request.method==="GET"&&path==="/api/credentials") {
        const result={github:{configured:!!env.GITHUB_TOKEN},tmdb:{configured:!!env.TMDB_API_KEY}};
        if(env.GITHUB_TOKEN) {
          try {
            const headers=githubHeaders(env);
            const [ur,rr]=await Promise.all([fetch("https://api.github.com/user",{headers}),fetch("https://api.github.com/repos/"+encodeURIComponent(env.GITHUB_OWNER||"megamrtklc")+"/"+encodeURIComponent(env.GITHUB_REPO||"mrtklc"),{headers})]);
            const user=await ur.json().catch(()=>({})),repository=await rr.json().catch(()=>({}));
            if(!ur.ok)throw new Error(user.message||"GitHub hesap kimliği doğrulanamadı.");
            result.github.login=user.login||"";result.github.name=user.name||"";
            result.github.repoPermission=rr.ok?(repository.permissions?.push?"Yazma ve yayınlama":repository.permissions?.pull?"Salt okunur":"Depo erişimi doğrulandı"):"Hesap doğrulandı; depo yetkisi okunamadı";
          }catch(error){result.github.identityError=error.message||"GitHub kimliği doğrulanamadı.";}
        }
        return json(result);
      }
      if(request.method==="GET"&&path==="/api/tmdb") {
        if(!env.TMDB_API_KEY)return json({error:"TMDB_API_KEY secret tanımlanmamış. GitHub Actions Secrets alanına ekleyip dağıtımı yeniden çalıştır."},503);
        const targetPath=String(url.searchParams.get("path")||"");
        if(!targetPath||targetPath.length>500||targetPath.includes("..")||/[^a-zA-Z0-9_/?=&.%\-]/.test(targetPath))return json({error:"Geçersiz TMDB isteği."},400);
        try {
          const target=new URL("https://api.themoviedb.org/3/"+targetPath);
          target.searchParams.set("api_key",env.TMDB_API_KEY);
          if(!target.searchParams.has("language"))target.searchParams.set("language","tr-TR");
          const upstream=await fetch(target.toString(),{headers:{"accept":"application/json"}});
          const payload=await upstream.json().catch(()=>({}));
          if(!upstream.ok)return json({error:payload.status_message||"TMDB isteği başarısız."},upstream.status);
          return json(payload);
        }catch(error){return json({error:error.message||"TMDB servisine ulaşılamadı."},502);}
      }

      if(request.method==="GET"&&path==="/api/profile-photo")return getProfilePhoto(env);
      if(request.method==="POST"&&path==="/api/profile-photo") {
        try{return await saveProfilePhoto(request,env);}
        catch(error){return json({error:error.message||"Profil fotoğrafı kaydedilemedi."},502);}
      }
      if(request.method==="GET"&&path==="/api/quality-history") {
        try {
          const historyPath="data/quality-history.json";
          const owner=encodeURIComponent(env.GITHUB_OWNER||"megamrtklc"),repo=encodeURIComponent(env.GITHUB_REPO||"mrtklc"),branch=encodeURIComponent(env.GITHUB_BRANCH||"main");
          const apiUrl=`https://api.github.com/repos/${owner}/${repo}/contents/${historyPath}?ref=${branch}`;
          const response=await fetch(apiUrl,{headers:githubHeaders(env)});
          if(response.status===404)return json({history:[],sha:null});
          const payload=await response.json();if(!response.ok)throw new Error(payload.message||"Kalite geçmişi okunamadı.");
          const bytes=Uint8Array.from(atob(String(payload.content||"").replace(/\s/g,"")),ch=>ch.charCodeAt(0));
          const data=JSON.parse(new TextDecoder().decode(bytes));
          return json({history:Array.isArray(data.history)?data.history:[],sha:payload.sha||null});
        } catch(error){return json({error:error.message||"Kalite geçmişi okunamadı."},502);}
      }
      if(request.method==="PUT"&&path==="/api/quality-history") {
        if(!sameOrigin(request))return json({error:"Geçersiz istek kaynağı."},403);
        try {
          if(!env.GITHUB_TOKEN)return json({error:"GitHub yazma bağlantısı yapılandırılmamış."},503);
          const body=await request.json();if(!body||!Array.isArray(body.history)||body.history.length>180)return json({error:"Kalite geçmişi biçimi geçersiz."},400);
          const historyPath="data/quality-history.json",owner=encodeURIComponent(env.GITHUB_OWNER||"megamrtklc"),repo=encodeURIComponent(env.GITHUB_REPO||"mrtklc"),branch=encodeURIComponent(env.GITHUB_BRANCH||"main");
          const apiUrl=`https://api.github.com/repos/${owner}/${repo}/contents/${historyPath}`;
          const current=await fetch(apiUrl+"?ref="+branch,{headers:githubHeaders(env)});const currentData=await current.json().catch(()=>({}));
          const currentSha=current.ok?currentData.sha:null;
          if(currentSha!==(body.sha||null))return json({error:"Kalite geçmişi başka bir işlemde güncellenmiş.",sha:currentSha},409);
          const content=bytesToBase64(new TextEncoder().encode(JSON.stringify({version:1,history:body.history},null,2)));
          const response=await fetch(apiUrl,{method:"PUT",headers:{...githubHeaders(env),"content-type":"application/json"},body:JSON.stringify({message:"Update catalog quality history",content,sha:currentSha||undefined,branch:env.GITHUB_BRANCH||"main"})});
          const result=await response.json();if(!response.ok)throw new Error(result.message||"Kalite ölçümü kaydedilemedi.");
          return json({ok:true,sha:result.content?.sha||null,commit:result.commit?.sha||null});
        } catch(error){return json({error:error.message||"Kalite ölçümü kaydedilemedi."},502);}
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
