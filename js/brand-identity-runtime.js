/*
 * PERDE — Marka kimliği çalışma zamanı
 * Görev: brand-config.json ayarlarını sayfa metinlerine, erişilebilirlik
 * etiketlerine, başlığa ve SEO meta alanlarına uygular; dinamik DOM değişimlerini izler.
 * Bağımlılık: Sayfa gövdesi, brand-config.json ve MutationObserver.
 */

(function(){
 var fallback={"brandName":"Perde Film","shortName":"Perde","slogan":"Film ve dizi arşivinin kişisel merkezi","pageTitle":"Perde Film","metaDescription":"Perde Film ile film ve dizileri keşfet, izleme listeni oluştur ve izleme ilerlemeni takip et.","copyright":"© 2026 PERDE FILM. Tüm hakları saklıdır.","adminSubtitle":"YÖNETİM PANELİ","scopes":{"site":true,"admin":true,"login":true,"seo":true}};
 function apply(config){
  config=Object.assign({},fallback,config||{});
  if(config.scopes&&config.scopes.site===false)return;
  var name=String(config.brandName||fallback.brandName),walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(function(node){var p=node.parentElement;if(!p||/^(SCRIPT|STYLE|TEXTAREA|INPUT|CODE|PRE)$/i.test(p.tagName))return;var next=node.nodeValue.replace(/CINE\s*VERSE|CINEVERSE/gi,name);if(next!==node.nodeValue)node.nodeValue=next;});
  document.querySelectorAll("[title],[aria-label],[alt],[placeholder]").forEach(function(el){["title","aria-label","alt","placeholder"].forEach(function(attr){var value=el.getAttribute(attr);if(value){var next=value.replace(/CINE\s*VERSE|CINEVERSE/gi,name);if(next!==value)el.setAttribute(attr,next);}});});
  var short=String(config.shortName||''),primary=name,accent='';
  if(short&&name.toUpperCase().startsWith(short.toUpperCase())){primary=name.slice(0,short.length);accent=name.slice(short.length);}
  [['headerConfig.brandPrimary','headerConfig.brandAccent'],['footerConfig.brandPrimary','footerConfig.brandAccent']].forEach(function(pair){
   var p=document.querySelector('[x-text="'+pair[0]+'"]'),a=document.querySelector('[x-text="'+pair[1]+'"]');
   if(p&&p.textContent!==primary)p.textContent=primary;
   if(a&&a.textContent!==accent)a.textContent=accent;
  });
  var copyright=document.querySelector('[x-text="footerConfig.copyright"]');
  if(copyright&&config.copyright)copyright.textContent=config.copyright;
  if(config.scopes.seo!==false){
   if(config.pageTitle)document.title=config.pageTitle;
   var d=document.querySelector('meta[name="description"]');if(d&&config.metaDescription)d.setAttribute('content',config.metaDescription);
   var og=document.querySelector('meta[property="og:title"]');if(og&&config.pageTitle)og.setAttribute('content',config.pageTitle);
   var od=document.querySelector('meta[property="og:description"]');if(od&&config.metaDescription)od.setAttribute('content',config.metaDescription);
  }
  window.__CV_BRAND_CONFIG__=config;
 }
 fetch('./brand-config.json?v=1',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(config){
  if(!config)return;apply(config);var queued=false;
  new MutationObserver(function(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;apply(config);});}).observe(document.body,{childList:true,subtree:true,characterData:true});
 }).catch(function(){});
})();
