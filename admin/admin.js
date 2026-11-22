(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const state = { homepageLayoutDirty:false, data:null, catalog:[], filtered:[], page:1, pageSize:12, missingTrailerPage:1, missingTrailerPageSize:12, qualityPage:1, qualityPageSize:10, view:'overview', analyticsDetail:null, analyticsDetailPage:1, analyticsDetailPageSize:12, sha:null, apiEnabled:false, saving:false, heroDraft:null, heroRefreshDraft:null, tmdbSearchTimer:null, tmdbSearchRequest:0, tmdbSelected:null };
  const HOMEPAGE_LAYOUT_DEFAULTS = ['hero','personalized','continue','watchlist','watched','favorites','new-arrivals','series-tracking','genre-discovery','franchises','published-collections','catalog'];
  const HOMEPAGE_LAYOUT_ITEMS = {
    hero:{title:'Manşet',description:'Masaüstü ve mobil ana görsel alanı',icon:'▣',locked:true},
    personalized:{title:'İzleme Zevkine Göre',description:'Kişiselleştirilmiş film ve dizi önerileri',icon:'✦'},
    continue:{title:'İzlemeye Devam Et',description:'Kaldığın yerden devam ettiğin yapımlar',icon:'▷'},
    watchlist:{title:'İzleme Listem',description:'Daha sonra izlemek için kaydettiklerin',icon:'♡'},
    watched:{title:'İzlediklerim',description:'İzledim olarak işaretlediğin film ve diziler',icon:'◉'},
    favorites:{title:'Favorilerim',description:'Favorilerine eklediğin film ve diziler',icon:'♥'},
    'new-arrivals':{title:'Son Eklenenler',description:'Kataloğa en son eklenen yapımlar',icon:'＋'},
    'series-tracking':{title:'Dizi Takibi',description:'Sezon ve bölüm ilerlemen',icon:'▤'},
    'genre-discovery':{title:'Türlere Göre Keşfet',description:'Tür kartları ve keşif filtreleri',icon:'⌕'},
    franchises:{title:'Seri Filmler',description:'Film serileri ve vizyon sıraları',icon:'▧'},
    'published-collections':{title:'Yayınlanan Koleksiyonlar',description:'Admin panelinde hazırlanan özel seçkiler',icon:'▧'},
    catalog:{title:'Tüm Yapımlar & Trendler',description:'Katalogdan seçilen genel yapım rafı',icon:'▥'}
  };
  const ADMIN_PREFERENCES_KEY='perde-admin-preferences-v1';
  const PREFERENCE_GUIDES={
    density:{title:'Arayüz yoğunluğu',intro:'Yönetim ekranlarındaki içeriklerin dikey boşluklarını düzenler.',body:'<p><b>Nerede değişir?</b> Yapım Kütüphanesi satırları, yönetim kartları ve form alanlarının boşlukları etkilenir.</p><p><b>Rahat:</b> Daha fazla nefes alan, göz yormayan yerleşim.</p><p><b>Kompakt:</b> Daha az boşlukla ekranda daha fazla kayıt.</p><p>Önizleme, bu sayfanın üstündeki örnek tablo satırlarında görünür. Kaydetmeden gerçek panele uygulanmaz.</p>'},
    theme:{title:'Görünüm teması',intro:'Panelin renk kontrastını ve vurgu görünümünü belirler.',body:'<p><b>Nerede değişir?</b> Sol menü, üst çubuk, kart yüzeyleri, metinler ve kenarlıklar etkilenir.</p><p><b>Sinematik koyu:</b> Mevcut koyu zemin ve altın vurgular korunur.</p><p><b>Yüksek kontrast:</b> Metinler ve sınırlar daha belirgin hale gelir.</p><p>Yalnızca yönetim panelini etkiler; ziyaretçi sitesinin temasını değiştirmez.</p>'},
    sidebar:{title:'Panel düzeni',intro:'Sol navigasyon menüsünün kapladığı alanı ayarlar.',body:'<p><b>Nerede değişir?</b> Masaüstünde sol menü genişliği ve ana içerik alanının kullanılabilir genişliği değişir.</p><p><b>Standart:</b> Menü ikonları ve adları görünür.</p><p><b>Dar:</b> Menü ikon odaklı dar bir şeride dönüşür; içerik alanı genişler. Mobil menü davranışı değişmez.</p>'},
    tables:{title:'Tablo ve liste ayarları',intro:'Kütüphane sayfasında her sayfada kaç kayıt gösterileceğini belirler.',body:'<p><b>Nerede değişir?</b> Film &amp; Diziler sayfasındaki kayıt listesi ve sayfalama kontrolü etkilenir.</p><p>12 kayıt kısa sayfalar, 24 kayıt dengeli görünüm, 48 kayıt daha az sayfa ile uzun liste sunar.</p><p>Fragmanı olmayanlar ekranının kendi sayfalama ayarı bu tercihten bağımsız kalır.</p>'},
    notifications:{title:'Bildirim tercihleri',intro:'İşlem sonrası başarı ve bilgi mesajlarının gösterimini kontrol eder.',body:'<p><b>Nerede değişir?</b> Yönetim panelindeki kaydetme ve bilgilendirme toast mesajları etkilenir.</p><p>Kapalı olduğunda başarı ve bilgi bildirimleri gizlenir. Hata ve güvenlik uyarıları her zaman görünür kalır.</p>'},
    motion:{title:'Hareket ve erişilebilirlik',intro:'Arayüzdeki animasyon ve geçişlerin hızını azaltır.',body:'<p><b>Nerede değişir?</b> Sayfa geçişleri, menü açılışları, kart hareketleri ve küçük animasyonlar etkilenir.</p><p>Hareketleri azalt seçeneği açık olduğunda bu efektler en aza indirilir. Sistem düzeyindeki hareket azaltma tercihi de ayrıca korunur.</p>'}
  };
  function readAdminPreferences(){
    const defaults={density:'comfortable',reduceMotion:false,theme:'dark',sidebar:'normal',pageSize:12,notifications:true};
    try{
      const saved=JSON.parse(localStorage.getItem(ADMIN_PREFERENCES_KEY)||'{}');
      return {density:saved.density==='compact'?'compact':'comfortable',reduceMotion:saved.reduceMotion===true,theme:saved.theme==='contrast'?'contrast':'dark',sidebar:saved.sidebar==='compact'?'compact':'normal',pageSize:[12,24,48].includes(Number(saved.pageSize))?Number(saved.pageSize):12,notifications:saved.notifications!==false};
    }catch(_){return defaults;}
  }
  function applyAdminPreferences(preferences=readAdminPreferences()){
    document.body.classList.toggle('admin-density-compact',preferences.density==='compact');
    document.body.classList.toggle('admin-reduce-motion',preferences.reduceMotion);
    document.body.classList.toggle('admin-theme-contrast',preferences.theme==='contrast');
    document.body.classList.toggle('admin-sidebar-compact',preferences.sidebar==='compact');
    state.pageSize=preferences.pageSize;
    return preferences;
  }
  function readPreferenceDraft(){
    const checked=name=>$('input[name="'+name+'"]:checked')?.value;
    return {density:checked('panel-density')==='compact'?'compact':'comfortable',reduceMotion:!!$('#panel-reduce-motion')?.checked,theme:checked('panel-theme')==='contrast'?'contrast':'dark',sidebar:checked('panel-sidebar')==='compact'?'compact':'normal',pageSize:[12,24,48].includes(Number(checked('panel-page-size')))?Number(checked('panel-page-size')):12,notifications:!!$('#panel-notifications')?.checked};
  }
  function updatePreferencePreviews(draft=readPreferenceDraft()){
    const density=$('#preview-density');if(density)density.classList.toggle('is-compact',draft.density==='compact');
    const theme=$('#preview-theme');if(theme)theme.classList.toggle('is-contrast',draft.theme==='contrast');
    const sidebar=$('#preview-sidebar');if(sidebar)sidebar.classList.toggle('is-compact',draft.sidebar==='compact');
    const size=$('#preview-page-size');if(size){size.querySelector('b').textContent=draft.pageSize;size.querySelector('i').textContent='Sayfa 1 · '+Math.max(1,Math.ceil((state.catalog.length||125)/draft.pageSize))+' sayfa';}
    const notices=$('#preview-notifications');if(notices)notices.classList.toggle('is-muted',!draft.notifications);
    const motion=$('#preview-motion');if(motion){motion.classList.toggle('is-reduced',draft.reduceMotion);motion.querySelector('i').textContent=draft.reduceMotion?'Azaltıldı':'0.22 sn';}
  }
  function renderPreferenceDraftStatus(){
    const saved=readAdminPreferences(),draft=readPreferenceDraft();
    const dirty=Object.keys(saved).some(key=>saved[key]!==draft[key]);
    const status=$('#preferences-status'),save=$('#preferences-save'),indicator=$('#preferences-saved-indicator');
    if(save)save.disabled=!dirty;
    if(indicator){indicator.textContent=dirty?'● KAYDEDİLMEMİŞ DEĞİŞİKLİK':'● KAYITLI AYARLAR';indicator.classList.toggle('is-dirty',dirty);}
    if(status){const message=status.querySelector('span:last-child');if(message)message.textContent=dirty?'Önizlemeler güncellendi. Gerçek paneli değiştirmek için Kaydet düğmesine bas.':'Mevcut kayıtlı ayarların kullanılıyor. Henüz bekleyen değişiklik yok.';status.classList.toggle('is-dirty',dirty);}
    updatePreferencePreviews(draft);
  }
  function loadPreferenceDraft(preferences=readAdminPreferences()){
    const set=(name,value)=>{const input=$('input[name="'+name+'"][value="'+value+'"]');if(input)input.checked=true;};
    set('panel-density',preferences.density);set('panel-theme',preferences.theme);set('panel-sidebar',preferences.sidebar);set('panel-page-size',String(preferences.pageSize));
    const motion=$('#panel-reduce-motion');if(motion)motion.checked=preferences.reduceMotion;
    const notifications=$('#panel-notifications');if(notifications)notifications.checked=preferences.notifications;
    renderPreferenceDraftStatus();
  }
  function saveAdminPreferences(){
    const next=readPreferenceDraft();
    try{localStorage.setItem(ADMIN_PREFERENCES_KEY,JSON.stringify(next));}
    catch(_){toast('Tercihler kaydedilemedi. Tarayıcı depolama iznini kontrol et.','warning');return false;}
    applyAdminPreferences(next);loadPreferenceDraft(next);
    if(state.data&&state.view==='catalog'){state.page=1;renderCatalog();}
    toast('Panel tercihleri kaydedildi ve uygulandı.','success');return true;
  }
  function openPreferenceGuide(key){
    const guide=PREFERENCE_GUIDES[key];if(!guide)return;
    $('#preferences-info-title').textContent=guide.title;$('#preferences-info-intro').textContent=guide.intro;$('#preferences-info-body').innerHTML=guide.body;
    $('#preferences-info-dialog').showModal();
  }
  function applyAdminTheme(){ document.body.classList.remove('admin-theme-ivory','admin-theme-slate','admin-theme-dark'); const meta=document.querySelector('meta[name="theme-color"]'); if(meta)meta.content='#f4f3ef'; }
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const titleOf = item => item.title || item.tmdbTitle || item.originalTitle || item.tmdbOriginalTitle || 'Başlıksız yapım';
  const posterOf = item => item.image || item.poster || item.tmdbPoster || '';
  const isSeries = item => ['tv','series','dizi'].includes(String(item?.type||'').toLowerCase());
  const yearOf = item => Number(item.year || item.releaseYear || (item.tmdbReleaseDate || '').slice(0,4)) || '—';
  const collectionList = () => Array.isArray(state.data?.collections) ? state.data.collections : [];
  const franchiseList = () => Array.isArray(state.data?.franchises) ? state.data.franchises : [];
  const toast = (message,type='warning') => { const prefs=readAdminPreferences(); if(!prefs.notifications&&['success','info'].includes(type))return; const el=$('#toast'); if(!el)return; const title=$('#toast-title'),body=$('#toast-message'),icon=el.querySelector('.toast-icon'); const safeType=['success','warning','error','info'].includes(type)?type:'warning'; const config={success:{title:'İŞLEM BAŞARILI',icon:'✓',duration:2600,role:'status'},warning:{title:'İŞLEM BAŞARISIZ',icon:'!',duration:4800,role:'alert'},error:{title:'SİSTEM HATASI',icon:'×',duration:5200,role:'alert'},info:{title:'BİLGİLENDİRME',icon:'i',duration:3800,role:'status'}}[safeType]; if(title)title.textContent=config.title; if(body)body.textContent=String(message||''); if(icon)icon.textContent=config.icon; el.dataset.type=safeType; el.setAttribute('role',config.role); el.setAttribute('aria-live',config.role==='alert'?'assertive':'polite'); document.body.classList.add('has-admin-toast'); el.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>{el.classList.remove('show');document.body.classList.remove('has-admin-toast');},config.duration); };
  async function fetchWithTimeout(url,options={},timeoutMs=15000){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{return await fetch(url,{...options,signal:controller.signal});}
    catch(error){
      if(error?.name==='AbortError')throw new Error('Bağlantı 15 saniye içinde yanıt vermedi: '+url);
      throw error;
    }finally{clearTimeout(timer);}
  }
  function showStartupError(message){
    const notice=$('.notice');
    if(notice){
      const title=$('.notice b',notice),description=$('.notice p',notice),tag=$('.notice-tag',notice);
      if(title)title.textContent='Bağlantı kurulamadı';
      if(description)description.textContent=message;
      if(tag)tag.textContent='ERROR';
    }
  }
  window.addEventListener('error',event=>{
    if(!state.data)showStartupError(event.message||'Yönetim paneli başlatılırken bir JavaScript hatası oluştu.');
  });
  window.addEventListener('unhandledrejection',event=>{
    if(!state.data)showStartupError(event.reason?.message||String(event.reason||'Beklenmeyen bir bağlantı hatası oluştu.'));
  });
  // Kritik ekleme düğmelerini erken aşamada delege et: panelin başka bir alanındaki
  // başlangıç hatası bu düğmelerin olaylarını devre dışı bırakmasın.
  document.addEventListener('click',event=>{
    const contentButton=event.target.closest?.('#add-content, #catalog-add');
    if(contentButton){
      event.preventDefault();
      try{openEditor();}catch(error){console.error('Yeni yapım formu açılamadı:',error);toast('Yeni yapım formu açılamadı: '+(error.message||'Beklenmeyen hata.'),'error');}
      return;
    }
    const collectionButton=event.target.closest?.('#collection-add');
    if(collectionButton){event.preventDefault();try{openCollectionEditor(null);}catch(error){console.error('Koleksiyon formu açılamadı:',error);toast('Koleksiyon formu açılamadı: '+(error.message||'Beklenmeyen hata.'),'error');}return;}
    const franchiseButton=event.target.closest?.('#franchise-add');
    if(franchiseButton){event.preventDefault();try{openFranchiseEditor(null);}catch(error){console.error('Seri formu açılamadı:',error);toast('Seri formu açılamadı: '+(error.message||'Beklenmeyen hata.'),'error');}return;}
  });
  function canWrite(){ if(!state.apiEnabled||!state.sha){toast('Katalog şu anda salt okunur. GitHub erişim bağlantısı doğrulanınca düzenleme açılacak.');return false;} return true; }
  function navigate(view){
    state.view=view;
    $$('.view').forEach(el=>el.classList.toggle('active',el.id==='view-'+view));
    $$('.nav-link').forEach(el=>{const active=el.dataset.view===view;el.classList.toggle('active',active);el.setAttribute('aria-current',active?'page':'false');});
    const active=$('.nav-link[data-view="'+view+'"]');
    $('#crumb-current').textContent=view==='analytics-detail'?'İstatistikler / Detaylı Rapor':(active?active.textContent.trim().replace(/\s+/g,' '):'Genel Bakış');
    setMobileSidebar(false);
    if(view==='catalog')renderCatalog();
    if(view==='trailers-missing')renderMissingTrailers();
    if(view==='quality')renderQualityAudit();
    if(view==='collections')renderCollections();
    if(view==='franchises')renderFranchises();
    if(view==='homepage')renderHomepage();
    if(view==='homepage-layout')renderHomepageLayout();
    if(view==='personalized-section')renderPersonalizedSection();
    if(view==='watch-layout')renderWatchLayout();
    if(view==='header-footer')renderHeaderFooter();
    if(view==='backup')refreshBackupSummary();
    if(view==='system')refreshSystemDiagnostics();
  }
  function applyProfilePhoto(url){
    const targets=[$('#avatar-photo'),$('#profile-photo-preview'),$('#profile-dialog-preview')];
    targets.forEach(img=>{if(!img)return;if(url){img.src=url;img.hidden=false;}else{img.removeAttribute('src');img.hidden=true;}});
    const initials=[$('#avatar-initials'),$('#profile-photo-large span'),$('#profile-dialog-initials')];
    initials.forEach(el=>{if(el)el.hidden=!!url;});
  }
  async function loadProfilePhoto(){
    try{const response=await fetch('/api/profile-photo',{cache:'no-store',credentials:'same-origin'});if(!response.ok)return;const data=await response.json();if(data.url)applyProfilePhoto(data.url);}
    catch(error){console.warn('Profil fotoğrafı alınamadı:',error);}
  }
  async function saveProfilePhoto(event){
    event.preventDefault();
    const file=$('#profile-file').files[0];if(!file){toast('Önce bir fotoğraf seç.');return;}
    const allowed=['image/jpeg','image/png','image/webp'];
    if(!allowed.includes(file.type)){toast('JPG, PNG veya WebP dosyası seçmelisin.');return;}
    if(file.size>716800){toast('Fotoğraf en fazla 700 KB olabilir.');return;}
    const button=$('#profile-save');button.disabled=true;button.textContent='Yükleniyor…';
    $('#profile-upload-status').textContent='Fotoğraf güvenli biçimde yükleniyor…';
    try{
      const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Fotoğraf okunamadı.'));reader.readAsDataURL(file);});
      const base64=dataUrl.split(',')[1];
      const response=await fetch('/api/profile-photo',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({mime:file.type,base64})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||'Fotoğraf kaydedilemedi.');
      applyProfilePhoto(result.url);
      $('#profile-dialog').close();$('#profile-form').reset();toast('Profil fotoğrafı güncellendi.');
    }catch(error){$('#profile-upload-status').textContent=error.message;toast(error.message,'error');}
    finally{button.disabled=false;button.textContent='Fotoğrafı kaydet';}
  }
  function renderAdminProfile(){
    const profile=state.data?.adminProfile||{};
    const name=String(profile.name||'Yönetici').trim()||'Yönetici';
    const input=$('#admin-name-input');if(input&&document.activeElement!==input)input.value=name;
    const header=$('#admin-display-name');if(header)header.textContent=name;
    const summary=$('#users-profile-name');if(summary)summary.textContent=name;
  }
  async function saveAdminProfile(event){
    event.preventDefault();if(!canWrite())return;
    const name=$('#admin-name-input').value.trim();
    if(!name){toast('Yönetici adı boş bırakılamaz.');return;}
    if(name.length>60){toast('Yönetici adı en fazla 60 karakter olabilir.');return;}
    const nextData={...state.data,adminProfile:{...(state.data.adminProfile||{}),name}};
    const ok=await persist(nextData,'Yönetici adı güncellendi.');
    if(ok)renderAdminProfile();
  }
  function renderWelcomePosters(){
    const host=$('#dashboard-poster-cloud');if(!host)return;
    const picks=state.catalog.filter(item=>posterOf(item)).sort(()=>Math.random()-.5).slice(0,5);
    host.innerHTML=picks.map((item,index)=>'<div class="welcome-poster poster-float-'+(index+1)+'"><img src="'+escapeHtml(posterOf(item))+'" alt="" loading="lazy" onerror="this.parentElement.remove()"><span>'+escapeHtml(titleOf(item))+'</span></div>').join('');
  }
  function renderOverviewInsights(){
    const years=state.catalog.map(yearOf).filter(x=>x!=='—').map(Number).filter(Number.isFinite);
    const ratings=state.catalog.map(x=>Number(x.rating||x.tmdbRating)).filter(x=>Number.isFinite(x)&&x>0);
    $('#overview-average').textContent=ratings.length?(ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1)+'/10':'—';
    $('#overview-oldest').textContent=years.length?Math.min(...years):'—';
    $('#overview-newest').textContent=years.length?Math.max(...years):'—';
    $('#overview-trailers').textContent=state.catalog.filter(x=>x.trailerUrl||x.tmdbTrailerUrl).length.toLocaleString('tr-TR');
    const movieCount=state.catalog.filter(x=>!isSeries(x)).length,seriesCount=state.catalog.length-movieCount,totalCount=Math.max(1,state.catalog.length);
    const movieShare=movieCount/totalCount*100,seriesShare=seriesCount/totalCount*100;
    $('#overview-balance-movies').style.width=movieShare+'%';$('#overview-balance-series').style.width=seriesShare+'%';
    $('#overview-balance-movie-count').textContent=movieCount.toLocaleString('tr-TR');$('#overview-balance-series-count').textContent=seriesCount.toLocaleString('tr-TR');
    const quality={
      poster:state.catalog.filter(x=>!posterOf(x)).length,
      rating:state.catalog.filter(x=>!(Number(x.rating||x.tmdbRating)>0)).length,
      trailer:state.catalog.filter(x=>!(x.trailerUrl||x.tmdbTrailerUrl)).length,
      watch:state.catalog.filter(x=>!(x.watchUrl||(Array.isArray(x.episodeWatchUrls)&&x.episodeWatchUrls.some(Boolean)))).length,
      cast:state.catalog.filter(x=>!((Array.isArray(x.cast)&&x.cast.length)||(Array.isArray(x.tmdbCast)&&x.tmdbCast.length))).length
    };
    $('#quality-missing-poster').textContent=quality.poster.toLocaleString('tr-TR');
    $('#quality-missing-rating').textContent=quality.rating.toLocaleString('tr-TR');
    $('#quality-missing-trailer').textContent=quality.trailer.toLocaleString('tr-TR');
    $('#quality-missing-watch').textContent=quality.watch.toLocaleString('tr-TR');
    $('#quality-missing-cast').textContent=quality.cast.toLocaleString('tr-TR');
    const affectedCount=state.catalog.filter(item=>qualityIssuesFor(item).length>0).length;
    $('#overview-quality-affected').textContent=affectedCount.toLocaleString('tr-TR')+' eksik kayıt';
    const counts={};state.catalog.forEach(x=>{const y=yearOf(x);if(y!=='—')counts[y]=(counts[y]||0)+1;});
    const top=Object.entries(counts).sort((a,b)=>Number(a[0])-Number(b[0])).slice(-12),max=Math.max(1,...top.map(x=>x[1]));
    $('#overview-yearline').innerHTML=top.map(([year,count])=>'<span style="height:'+Math.max(8,count/max*100)+'%" title="'+escapeHtml(year)+': '+count+' yapım"><small>'+escapeHtml(String(year).slice(-2))+'</small></span>').join('');
  }
  function updateMetrics(){
    const movies=state.catalog.filter(x=>!isSeries(x)).length;
    $('#metric-total').textContent=state.catalog.length.toLocaleString('tr-TR');
    $('#metric-movies').textContent=movies.toLocaleString('tr-TR');
    $('#metric-series').textContent=(state.catalog.length-movies).toLocaleString('tr-TR');
    $('#nav-count').textContent=state.catalog.length.toLocaleString('tr-TR');
    $('#metric-collections').textContent=collectionList().length.toLocaleString('tr-TR');
  }
  function renderRecent(){
    const recent=[...state.catalog].slice(-5).reverse();
    $('#recent-list').innerHTML=recent.length?recent.map(item=>'<div class="recent-item"><img class="poster-thumb" loading="lazy" src="'+escapeHtml(posterOf(item))+'" alt="" onerror="this.style.visibility=\'hidden\'"><div class="recent-meta"><b>'+escapeHtml(titleOf(item))+'</b><small>'+(isSeries(item)?'Dizi':'Film')+' · '+escapeHtml(yearOf(item))+'</small></div><span class="rating-pill">★ '+escapeHtml(item.rating||item.tmdbRating||'—')+'</span></div>').join(''):'<div class="loading-line">Katalogda içerik bulunamadı.</div>';
  }
  function renderCatalog(){
    const query=$('#catalog-search').value.trim().toLocaleLowerCase('tr');
    const type=$('#type-filter').value, year=$('#year-filter').value;
    state.filtered=state.catalog.filter(item=>{
      const cast=[...(item.cast||[]),...(item.tmdbCast||[])].map(x=>typeof x==='string'?x:(x?.name||''));
      const searchable=[titleOf(item),item.director,item.tmdbDirector,...cast].join(' ').toLocaleLowerCase('tr');
      return (!query||searchable.includes(query))&&(type==='all'||(type==='tv'?isSeries(item):!isSeries(item)))&&(year==='all'||String(yearOf(item))===year);
    });
    const sort=$('#catalog-sort')?.value||'newest';
    if(sort==='newest')state.filtered.reverse();
    else if(sort==='rating')state.filtered.sort((a,b)=>{
      const scoreA=Number(a.rating||a.tmdbRating)||0,scoreB=Number(b.rating||b.tmdbRating)||0;
      return scoreB-scoreA;
    });
    const pages=Math.max(1,Math.ceil(state.filtered.length/state.pageSize));state.page=Math.min(state.page,pages);
    const rows=state.filtered.slice((state.page-1)*state.pageSize,state.page*state.pageSize);
    $('#catalog-rows').innerHTML=rows.length?rows.map(item=>'<tr><td><div class="catalog-title"><img loading="lazy" src="'+escapeHtml(posterOf(item))+'" alt="" onerror="this.style.visibility=\'hidden\'"><div><b>'+escapeHtml(titleOf(item))+'</b><small>'+escapeHtml(item.director||item.tmdbDirector||'Yönetmen bilgisi yok')+'</small></div></div></td><td><span class="type-chip">'+(isSeries(item)?'Dizi':'Film')+'</span></td><td>'+escapeHtml(yearOf(item))+'</td><td><span class="score">★ '+escapeHtml(item.rating||item.tmdbRating||'—')+'</span></td><td>'+escapeHtml(item.tmdbId||'—')+'</td><td class="row-actions"><button class="row-action" data-edit="'+escapeHtml(item.id)+'">Düzenle</button><button class="row-action danger-action" data-delete="'+escapeHtml(item.id)+'">Sil</button></td></tr>').join(''):'<tr><td colspan="6" class="empty-cell">Aramanızla eşleşen kayıt bulunamadı.</td></tr>';
    $('#result-count').textContent=state.filtered.length.toLocaleString('tr-TR')+' kayıt';
    $('#page-info').textContent='Sayfa '+state.page+' / '+pages;
    $('#prev-page').disabled=state.page<=1;$('#next-page').disabled=state.page>=pages;
    $$('#catalog-rows [data-edit]').forEach(btn=>btn.addEventListener('click',()=>{const item=state.catalog.find(x=>String(x.id)===btn.dataset.edit);if(item)openEditor(item);}));
    $$('#catalog-rows [data-delete]').forEach(btn=>btn.addEventListener('click',()=>deleteContent(btn.dataset.delete)));
  }
  function renderMissingTrailers(){
    const query=($('#missing-trailer-search')?.value||'').trim().toLocaleLowerCase('tr');
    const missing=state.catalog.filter(item=>!String(item.trailerUrl||item.tmdbTrailerUrl||'').trim())
      .filter(item=>!query||titleOf(item).toLocaleLowerCase('tr').includes(query))
      .reverse();
    const pages=Math.max(1,Math.ceil(missing.length/state.missingTrailerPageSize));
    state.missingTrailerPage=Math.min(state.missingTrailerPage,pages);
    const rows=missing.slice((state.missingTrailerPage-1)*state.missingTrailerPageSize,state.missingTrailerPage*state.missingTrailerPageSize);
    $('#missing-trailer-rows').innerHTML=rows.length?rows.map(item=>'<tr><td><div class="catalog-title"><img loading="lazy" src="'+escapeHtml(posterOf(item))+'" alt=""><div><b>'+escapeHtml(titleOf(item))+'</b><small>'+escapeHtml(item.director||item.tmdbDirector||'Yönetmen bilgisi yok')+'</small></div></div></td><td><span class="type-chip">'+(isSeries(item)?'Dizi':'Film')+'</span></td><td>'+escapeHtml(yearOf(item))+'</td><td><span class="trailer-missing-status">Fragman eklenmemiş</span></td><td class="row-actions"><button class="row-action" data-missing-trailer-edit="'+escapeHtml(item.id)+'">Düzenle</button></td></tr>').join(''):'<tr><td colspan="5" class="empty-cell">'+(query?'Aramayla eşleşen fragmansız yapım bulunamadı.':'Harika! Tüm yapımlarda fragman bağlantısı mevcut.')+'</td></tr>';
    $('#missing-trailer-count').textContent=String(state.catalog.filter(item=>!String(item.trailerUrl||item.tmdbTrailerUrl||'').trim()).length);
    $('#missing-trailer-result-count').textContent=missing.length.toLocaleString('tr-TR')+' yapım';
    $('#missing-trailer-page-info').textContent='Sayfa '+state.missingTrailerPage+' / '+pages;
    $('#missing-trailer-prev').disabled=state.missingTrailerPage<=1;
    $('#missing-trailer-next').disabled=state.missingTrailerPage>=pages;
    document.querySelectorAll('#missing-trailer-rows [data-missing-trailer-edit]').forEach(btn=>btn.addEventListener('click',event=>{event.preventDefault();const item=state.catalog.find(x=>String(x.id)===btn.dataset.missingTrailerEdit);if(!item){toast('Düzenlenecek yapım katalogda bulunamadı.');return;}try{openEditor(item);}catch(error){console.error('Fragman kaydı düzenleyicisi açılamadı:',error);toast('Düzenleme ekranı açılamadı: '+(error.message||'Beklenmeyen hata.'));}}));
  }
  const QUALITY_LABELS={poster:'Afiş',rating:'IMDb puanı',trailer:'Fragman',watch:'İzleme bağlantısı',cast:'Oyuncu bilgisi',director:'Yönetmen',year:'Yapım yılı',description:'Konu',tmdb:'TMDB eşleşmesi'};
  function qualityIssuesFor(item){
    const issues=[];
    if(!posterOf(item))issues.push('poster');
    if(!(Number(item.rating||item.tmdbRating)>0))issues.push('rating');
    if(!String(item.trailerUrl||item.tmdbTrailerUrl||'').trim())issues.push('trailer');
    if(!(String(item.watchUrl||'').trim()||(item.episodeWatchUrls&&Object.values(item.episodeWatchUrls).some(url=>String(url||'').trim()))))issues.push('watch');
    if(!((Array.isArray(item.cast)&&item.cast.length)||(Array.isArray(item.tmdbCast)&&item.tmdbCast.length)))issues.push('cast');
    if(!String(item.director||item.tmdbDirector||'').trim())issues.push('director');
    if(yearOf(item)==='—')issues.push('year');
    if(!String(item.desc||item.tmdbOverview||'').trim())issues.push('description');
    if(!String(item.tmdbId||'').trim())issues.push('tmdb');
    return issues;
  }
  const QUALITY_TRACK_KEYS=['poster','rating','trailer','watch','cast','director','year','description','tmdb'];
  let qualityHistory={history:[],sha:null};
  function buildQualitySnapshot(){
    const counts=Object.fromEntries(QUALITY_TRACK_KEYS.map(key=>[key,0]));
    state.catalog.forEach(item=>qualityIssuesFor(item).forEach(key=>counts[key]++));
    return {id:'q-'+Date.now(),createdAt:new Date().toISOString(),total:state.catalog.length,affected:state.catalog.filter(item=>qualityIssuesFor(item).length).length,counts};
  }
  async function loadQualityHistory(){
    try{const response=await fetch('/api/quality-history',{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw new Error('Kalite geçmişi alınamadı.');const data=await response.json();qualityHistory={history:Array.isArray(data.history)?data.history:[],sha:data.sha||null};}
    catch(error){qualityHistory={history:[],sha:null};const note=$('#quality-history-note');if(note)note.textContent='Kalite geçmişi şu anda alınamadı. Katalog taraması çalışmaya devam ediyor.';console.warn(error);}
    renderQualityHistory();
  }
  function renderQualityHistory(){
    const rows=qualityHistory.history.slice().sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
    const latest=rows[rows.length-1],previous=rows[rows.length-2];
    const dateText=value=>value?new Date(value).toLocaleString('tr-TR',{dateStyle:'medium',timeStyle:'short'}):'Henüz yok';
    $('#quality-last-date').textContent=dateText(latest?.createdAt);
    $('#quality-last-total').textContent=latest?latest.affected+' yapımda eksik bilgi':'İlk ölçümü kaydet';
    $('#quality-snapshot-count').textContent=String(rows.length);
    const change=$('#quality-change'),label=$('#quality-change-label');
    if(latest&&previous){const delta=latest.affected-previous.affected;change.textContent=(delta>0?'+':'')+delta;change.classList.toggle('is-better',delta<0);change.classList.toggle('is-worse',delta>0);label.textContent=delta<0?'Önceki ölçüme göre daha az eksik kayıt':delta>0?'Önceki ölçüme göre daha fazla eksik kayıt':'Değişiklik yok';}
    else{change.textContent='—';change.classList.remove('is-better','is-worse');label.textContent='Karşılaştırma için ikinci ölçüm gerekli';}
    const chart=$('#quality-history-chart');
    if(!rows.length){chart.innerHTML='<div class="quality-history-empty">Henüz ölçüm kaydedilmedi. İlk ölçümü kaydederek takibi başlat.</div>';return;}
    const recent=rows.slice(-8),max=Math.max(1,...recent.map(row=>Number(row.affected)||0));
    chart.innerHTML=recent.map(row=>{const height=Math.max(5,Math.round((Number(row.affected)||0)/max*100));const d=new Date(row.createdAt);return '<div class="quality-history-column" title="'+escapeHtml(d.toLocaleString('tr-TR'))+' · '+row.affected+' eksik yapım"><b>'+row.affected+'</b><div class="quality-history-track"><i style="height:'+height+'%"></i></div><small>'+escapeHtml(d.toLocaleDateString('tr-TR',{day:'2-digit',month:'short'}))+'</small></div>';}).join('');
  }
  async function saveQualitySnapshot(){
    const button=$('#quality-snapshot-save');if(button.disabled)return;
    button.disabled=true;button.textContent='Kaydediliyor…';
    try{
      const snapshot=buildQualitySnapshot(),history=qualityHistory.history.slice(),last=history[history.length-1];
      if(last&&last.total===snapshot.total&&last.affected===snapshot.affected&&JSON.stringify(last.counts)===JSON.stringify(snapshot.counts)){toast('Son ölçümle aynı sonuç; yeni kayıt oluşturulmadı.','info');return;}
      history.push(snapshot);
      const response=await fetch('/api/quality-history',{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({history:history.slice(-180),sha:qualityHistory.sha})});
      const payload=await response.json().catch(()=>({}));
      if(response.status===409)throw new Error('Kalite geçmişi başka bir işlemde güncellenmiş. Sayfayı yenileyip tekrar deneyin.');
      if(!response.ok)throw new Error(payload.error||'Ölçüm kaydedilemedi.');
      qualityHistory={history:history.slice(-180),sha:payload.sha||null};renderQualityHistory();toast('Kalite ölçümü güvenli biçimde kaydedildi.','success');
    }catch(error){toast(error.message||'Ölçüm kaydedilemedi.','error');console.error(error);}
    finally{button.disabled=false;button.textContent='＋ Bu ölçümü kaydet';}
  }
  function renderQualityAudit(){
    const query=($('#quality-search')?.value||'').trim().toLocaleLowerCase('tr');
    const filter=$('#quality-filter')?.value||'all';
    const issueKeys=['poster','rating','trailer','watch','cast','director','year','description','tmdb'];
    const summary={};issueKeys.forEach(key=>summary[key]=0);
    const audited=state.catalog.map(item=>({item,issues:qualityIssuesFor(item)}));
    audited.forEach(row=>row.issues.forEach(key=>summary[key]++));
    const otherCount=['director','year','description','tmdb'].reduce((sum,key)=>sum+summary[key],0);
    $('#quality-page-poster').textContent=summary.poster.toLocaleString('tr-TR');
    $('#quality-page-rating').textContent=summary.rating.toLocaleString('tr-TR');
    $('#quality-page-trailer').textContent=summary.trailer.toLocaleString('tr-TR');
    $('#quality-page-watch').textContent=summary.watch.toLocaleString('tr-TR');
    $('#quality-page-cast').textContent=summary.cast.toLocaleString('tr-TR');
    $('#quality-page-other').textContent=otherCount.toLocaleString('tr-TR');
    const affected=audited.filter(row=>row.issues.length);
    $('#quality-total-affected').textContent=affected.length.toLocaleString('tr-TR');
    $('#quality-issue-count').textContent=String(affected.length);
    const rows=affected.filter(({item,issues})=>(!query||titleOf(item).toLocaleLowerCase('tr').includes(query))&&(filter==='all'||(filter==='other'?issues.some(key=>['director','year','description','tmdb'].includes(key)):issues.includes(filter))));
    const pages=Math.max(1,Math.ceil(rows.length/state.qualityPageSize));
    state.qualityPage=Math.min(state.qualityPage,pages);
    const start=(state.qualityPage-1)*state.qualityPageSize;
    const visibleRows=rows.slice(start,start+state.qualityPageSize);
    $('#quality-result-count').textContent=rows.length.toLocaleString('tr-TR')+' yapım';
    $('#quality-rows').innerHTML=visibleRows.length?visibleRows.map(({item,issues},index)=>'<tr><td class="quality-row-number">'+(start+index+1)+'.</td><td><div class="catalog-title"><img loading="lazy" src="'+escapeHtml(posterOf(item))+'" alt="" onerror="this.style.visibility=\'hidden\'"><div><b>'+escapeHtml(titleOf(item))+'</b><small>'+(isSeries(item)?'Dizi':'Film')+' · '+escapeHtml(yearOf(item))+'</small></div></div></td><td><span class="type-chip">'+(isSeries(item)?'Dizi':'Film')+'</span></td><td>'+escapeHtml(yearOf(item))+'</td><td><div class="quality-tags">'+issues.map(key=>'<span>'+escapeHtml(QUALITY_LABELS[key])+'</span>').join('')+'</div></td><td class="row-actions"><button class="row-action" data-quality-edit="'+escapeHtml(item.id)+'">Düzenle</button></td></tr>').join(''):'<tr><td colspan="6" class="empty-cell">'+(filter!=='all'||query?'Bu filtreyle eşleşen eksik kayıt bulunamadı.':'Harika! Katalogda kontrol gerektiren eksik bilgi bulunamadı.')+'</td></tr>';
    const pagination=$('#quality-pagination');
    if(pagination){pagination.hidden=rows.length<=state.qualityPageSize;$('#quality-page-info').textContent='Sayfa '+state.qualityPage+' / '+pages+' · '+(start+1)+'–'+Math.min(start+state.qualityPageSize,rows.length)+' / '+rows.length;$('#quality-prev').disabled=state.qualityPage<=1;$('#quality-next').disabled=state.qualityPage>=pages;}
    $('#quality-rows [data-quality-edit]').forEach(btn=>btn.addEventListener('click',()=>{const item=state.catalog.find(x=>String(x.id)===btn.dataset.qualityEdit);if(item)openEditor(item);}));
  }
  function renderCollections(){
    const list=collectionList();
    $('#collection-grid').innerHTML=list.length?list.map(item=>{
      const count=Array.isArray(item.items)?item.items.length:0;
      return '<article class="collection-card"><div class="collection-card-top"><span class="collection-status '+(item.active===false?'inactive':'')+'">'+(item.active===false?'Pasif':'Yayında')+'</span><span class="collection-id">'+escapeHtml(item.id||'')+'</span></div><h3>'+escapeHtml(item.title||item.name||'İsimsiz koleksiyon')+'</h3><p>'+escapeHtml(item.description||'Açıklama eklenmemiş')+'</p><strong>'+count+'</strong><small>İçerik kaydı</small><div class="collection-actions"><button class="row-action" data-collection-edit="'+escapeHtml(item.id)+'">Düzenle</button><button class="row-action danger-action" data-collection-delete="'+escapeHtml(item.id)+'">Sil</button></div></article>';
    }).join(''):'<article class="panel-card empty-state"><span>▧</span><h2>Henüz koleksiyon bulunamadı</h2><p>Yeni koleksiyon oluşturarak seçkilerini yönetebilirsin.</p></article>';
    $$('#collection-grid [data-collection-edit]').forEach(btn=>btn.addEventListener('click',()=>openCollectionEditor(btn.dataset.collectionEdit)));
    $$('#collection-grid [data-collection-delete]').forEach(btn=>btn.addEventListener('click',()=>deleteCollection(btn.dataset.collectionDelete)));
    updateMetrics();
  }
  function renderFranchises(){
    const list=franchiseList();
    $('#franchise-grid').innerHTML=list.length?list.map(item=>{
      const count=Array.isArray(item.items)?item.items.length:0;
      return '<article class="collection-card"><div class="collection-card-top"><span class="collection-status '+(item.active===false?'inactive':'')+'">'+(item.active===false?'Pasif':'Yayında')+'</span><span class="collection-id">'+escapeHtml(item.id||'')+'</span></div><h3>'+escapeHtml(item.title||'İsimsiz seri')+'</h3><p>'+escapeHtml(item.description||'Açıklama eklenmemiş')+'</p><strong>'+count+'</strong><small>Film kaydı</small><div class="collection-actions"><button class="row-action" data-franchise-edit="'+escapeHtml(item.id)+'">Düzenle</button><button class="row-action danger-action" data-franchise-delete="'+escapeHtml(item.id)+'">Sil</button></div></article>';
    }).join(''):'<article class="panel-card empty-state"><span>▤</span><h2>Henüz film serisi bulunamadı</h2><p>Yeni seri oluşturarak mevcut filmleri bir araya getirebilirsin.</p></article>';
    $$('#franchise-grid [data-franchise-edit]').forEach(btn=>btn.addEventListener('click',()=>openFranchiseEditor(btn.dataset.franchiseEdit)));
    $$('#franchise-grid [data-franchise-delete]').forEach(btn=>btn.addEventListener('click',()=>deleteFranchise(btn.dataset.franchiseDelete)));
  }
  function openFranchiseEditor(id){
    if(!canWrite())return;
    const item=franchiseList().find(x=>String(x.id)===String(id));
    $('#franchise-form').reset();$('#franchise-id').value=item?.id||'';
    $('#franchise-title').value=item?.title||'';$('#franchise-description').value=item?.description||'';
    $('#franchise-backdrop').value=item?.backdrop||item?.poster||'';
    $('#franchise-active').checked=item?.active!==false;
    const selected=new Set((item?.items||[]).map(String));
    $('#franchise-items').innerHTML=state.catalog.filter(x=>!isSeries(x)).sort((a,b)=>yearOf(a)-yearOf(b)).map(x=>'<label class="collection-pick"><input type="checkbox" value="'+escapeHtml(x.id)+'" '+(selected.has(String(x.id))?'checked':'')+'><span><b>'+escapeHtml(titleOf(x))+'</b><small>Film · '+escapeHtml(yearOf(x))+'</small></span></label>').join('');
    $('#franchise-search').value='';filterFranchiseItems();
    $('#franchise-dialog-title').textContent=item?'Film serisini düzenle':'Yeni film serisi';
    $('#franchise-dialog').showModal();
  }
  function filterFranchiseItems(){
    const q=$('#franchise-search').value.trim().toLocaleLowerCase('tr');
    $$('#franchise-items .collection-pick').forEach(el=>el.hidden=!el.textContent.toLocaleLowerCase('tr').includes(q));
  }
  async function saveFranchise(event){
    event.preventDefault();if(!canWrite())return;
    const id=$('#franchise-id').value||('franchise-'+Date.now());
    const existing=franchiseList().find(x=>String(x.id)===String(id));
    const selected=$$('#franchise-items input:checked').map(x=>x.value);
    if(selected.length<2){toast('Bir seri oluşturmak için en az iki film seçmelisin.');return;}
    const title=$('#franchise-title').value.trim();
    if(!title){toast('Seri adı zorunludur.');return;}
    const record={...(existing||{}),id,title,description:$('#franchise-description').value.trim(),backdrop:$('#franchise-backdrop').value.trim(),active:$('#franchise-active').checked,items:selected};
    const nextData={...state.data,franchises:[...franchiseList()]};
    const index=nextData.franchises.findIndex(x=>String(x.id)===String(id));
    if(index>=0)nextData.franchises[index]=record;else nextData.franchises.push(record);
    const ok=await persist(nextData,existing?'Film serisi güncellendi.':'Film serisi oluşturuldu.');
    if(ok)$('#franchise-dialog').close();
  }
  async function deleteFranchise(id){
    if(!canWrite())return;
    const item=franchiseList().find(x=>String(x.id)===String(id));if(!item)return;
    if(!confirm('“'+item.title+'” film serisini silmek istiyor musun? Filmler katalogda kalır.'))return;
    await persist({...state.data,franchises:franchiseList().filter(x=>String(x.id)!==String(id))},'Film serisi silindi; katalogdaki filmler korundu.');
  }
  const getItemRating=item=>parseFloat(String(item.rating??item.imdbRating??item.voteAverage??'').replace(',','.'));
  const getItemGenres=item=>{
    let values=item.genres??item.genre??item.category??item.categories??[];
    if(!Array.isArray(values))values=String(values||'').split(/[,/|;]+/);
    return [...new Set(values.map(value=>String(value&&typeof value==='object'?(value.name||value.title||''):value).trim()).filter(name=>name&&name!=='—'))];
  };
  const RATING_BOUNDS=[[0,5],[5,6],[6,7],[7,8],[8,9],[9,10.000001]];
  const RATING_LABELS=['0–4,9','5–5,9','6–6,9','7–7,9','8–8,9','9–10'];
  function renderAnalytics(){
    const catalog=Array.isArray(state.catalog)?state.catalog:[];
    const total=catalog.length,movies=catalog.filter(x=>!isSeries(x)).length,series=total-movies;
    const ratings=catalog.map(getItemRating).filter(n=>Number.isFinite(n)&&n>0&&n<=10);
    const average=ratings.length?ratings.reduce((a,b)=>a+b,0)/ratings.length:0;
    const setText=(selector,value)=>{const el=$(selector);if(el)el.textContent=value;};
    setText('#analytics-total',total.toLocaleString('tr-TR'));
    setText('#analytics-movies',movies.toLocaleString('tr-TR'));
    setText('#analytics-series',series.toLocaleString('tr-TR'));
    setText('#analytics-average',average?average.toFixed(1).replace('.',',')+'/10':'—');
    setText('#analytics-movie-share',total?Math.round(movies/total*100)+'% katalog':'Katalog boş');
    setText('#analytics-series-share',total?Math.round(series/total*100)+'% katalog':'Katalog boş');
    setText('#analytics-rated-count',ratings.length+' / '+total+' yapımda puan var');
    const drawBars=(selector,rows,empty,maxOverride,action)=>{
      const root=$(selector);if(!root)return;
      const max=Math.max(1,maxOverride||0,...rows.map(row=>row[1]));
      root.innerHTML=rows.length?rows.map(([name,count])=>{
        const content='<span>'+escapeHtml(name)+'</span><span class="bar-track"><i class="bar-fill" style="width:'+(count/max*100)+'%"></i></span><b>'+count+'</b><i class="bar-action-arrow" aria-hidden="true">›</i>';
        return action?'<button type="button" class="bar-row analytics-bar-action" data-report-action="'+action+'" data-report-value="'+escapeHtml(name)+'" aria-label="'+escapeHtml(name)+' ayrıntılarını görüntüle">'+content+'</button>':'<div class="bar-row">'+content+'</div>';
      }).join(''):'<small class="analytics-empty">'+escapeHtml(empty)+'</small>';
    };
    drawBars('#type-chart',[['Film',movies],['Dizi',series]],'Henüz katalog kaydı yok.');
    const typeBalance=$('#analytics-type-balance');
    if(typeBalance)typeBalance.innerHTML='<span><i class="analytics-dot movie"></i>Film <b>'+movies+'</b></span><span><i class="analytics-dot series"></i>Dizi <b>'+series+'</b></span>';
    const yearCounts={};
    catalog.forEach(item=>{const y=yearOf(item);if(y!=='—'&&Number(y)>=1880&&Number(y)<=2100)yearCounts[y]=(yearCounts[y]||0)+1;});
    const yearRows=Object.entries(yearCounts).sort((a,b)=>Number(b[0])-Number(a[0]));
    const yearMore=$('#year-chart-more'),yearAll=$('#year-chart-all');
    const expandedYears=yearMore?.dataset.expanded==='true';
    drawBars('#year-chart',yearRows.slice(0,expandedYears?12:6),'Yapım yılı bilgisi bulunamadı.',0,'year');
    if(yearMore){yearMore.hidden=yearRows.length<=6;yearMore.textContent=expandedYears?'Daha az göster':'Daha fazla göster';yearMore.setAttribute('aria-expanded',String(expandedYears));}
    if(yearAll)yearAll.hidden=yearRows.length<=12;
    const now=new Date();
    const datedCatalog=catalog.map(item=>({item,date:item.addedAt?new Date(item.addedAt):null})).filter(row=>row.date&&!Number.isNaN(row.date.getTime()));
    const daysAgo=days=>new Date(now.getTime()-days*86400000);
    const added30=datedCatalog.filter(row=>row.date>=daysAgo(30)&&row.date<=now).length;
    const added90=datedCatalog.filter(row=>row.date>=daysAgo(90)&&row.date<=now).length;
    const undatedCount=total-datedCatalog.length;
    setText('#catalog-added-30',String(added30));
    setText('#catalog-added-90',String(added90));
    setText('#catalog-undated',undatedCount.toLocaleString('tr-TR')+' yapımın eklenme tarihi bilinmiyor');
    const monthNames=Array.from({length:6},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-(5-i),1);return {key:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),label:d.toLocaleDateString('tr-TR',{month:'short'})+' '+String(d.getFullYear()).slice(-2)};});
    const monthCounts=monthNames.map(month=>[month.label,datedCatalog.filter(row=>row.date.getFullYear()+'-'+String(row.date.getMonth()+1).padStart(2,'0')===month.key).length]);
    if(datedCatalog.length)drawBars('#catalog-monthly-chart',monthCounts,'Henüz tarihli ekleme bulunmuyor.');else{const monthlyRoot=$('#catalog-monthly-chart');if(monthlyRoot)monthlyRoot.innerHTML='<small class="analytics-empty">Eski kayıtların eklenme tarihleri tutulmadığı için aylık geçmiş henüz oluşmadı.</small>';}
    const annualCounts={};
    datedCatalog.forEach(row=>{const year=row.date.getFullYear();annualCounts[year]=(annualCounts[year]||0)+1;});
    const annualRows=Object.entries(annualCounts).sort((a,b)=>Number(b[0])-Number(a[0])).slice(0,6);
    if(annualRows.length)drawBars('#catalog-annual-chart',annualRows,'Henüz yıllık ekleme verisi bulunmuyor.');else{const annualRoot=$('#catalog-annual-chart');if(annualRoot)annualRoot.innerHTML='<small class="analytics-empty">Yıllık rapor, yeni kayıtların eklenme tarihleri kaydedildikçe oluşacak.</small>';}
    const genreCounts={};
    catalog.forEach(item=>getItemGenres(item).forEach(name=>{genreCounts[name]=(genreCounts[name]||0)+1;}));
    const genreRows=Object.entries(genreCounts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'tr'));
    const genreMore=$('#genre-chart-more'),genreAll=$('#genre-chart-all');
    const expandedGenres=genreMore?.dataset.expanded==='true';
    drawBars('#genre-chart',genreRows.slice(0,expandedGenres?12:6),'Tür etiketi bulunan kayıt yok.',0,'genre');
    if(genreMore){genreMore.hidden=genreRows.length<=6;genreMore.textContent=expandedGenres?'Daha az göster':'Daha fazla göster';genreMore.setAttribute('aria-expanded',String(expandedGenres));}
    if(genreAll)genreAll.hidden=genreRows.length<=12;
    const ratingRows=RATING_LABELS.map((name,index)=>[name,0]);
    ratings.forEach(n=>{const index=n<5?0:n<6?1:n<7?2:n<8?3:n<9?4:5;ratingRows[index][1]++;});
    const ratingRoot=$('#rating-chart');
    if(ratingRoot)ratingRoot.innerHTML=ratingRows.map(([name,count],index)=>'<button type="button" class="bar-row rating-bar-row analytics-bar-action" data-report-action="rating" data-report-value="'+index+'" aria-label="'+escapeHtml(name)+' puan aralığındaki '+count+' yapımı görüntüle"><span>'+escapeHtml(name)+'</span><span class="bar-track"><i class="bar-fill" style="width:'+(count/Math.max(1,...ratingRows.map(row=>row[1]))*100)+'%"></i></span><b>'+count+'</b><i class="bar-action-arrow" aria-hidden="true">›</i></button>').join('');
    const bestYear=yearRows.slice().sort((a,b)=>b[1]-a[1])[0],bestGenre=genreRows[0];
    setText('#analytics-insight-title',total?('Arşivinde '+total+' yapım bulunuyor'):'Arşivin henüz boş');
    setText('#analytics-insight-copy',total?((bestYear?'En yoğun yapım yılı '+bestYear[0]+' ('+bestYear[1]+' kayıt). ':'')+(bestGenre?'En sık görülen tür '+bestGenre[0]+' ('+bestGenre[1]+' kayıt). ':'')+(ratings.length?'Puan ortalaması '+average.toFixed(1).replace('.',',')+'/10.':'Henüz puan verisi bulunmuyor.')):'İlk yapımlarını eklediğinde tür, yıl ve puan analizleri burada otomatik oluşacak.');
  }
  function openAnalyticsDetail(kind,value){
    state.analyticsDetail={kind,value:value??null};
    state.analyticsDetailPage=1;
    const search=$('#analytics-detail-search');if(search)search.value='';
    navigate('analytics-detail');
    renderAnalyticsDetail();
  }
  function renderAnalyticsDetail(){
    const config=state.analyticsDetail;if(!config)return;
    const kind=config.kind,catalog=Array.isArray(state.catalog)?state.catalog:[];
    const ratingBounds=kind==='rating'?RATING_BOUNDS[Number(config.value)]:null;
    const heading=$('#analytics-detail-title'),description=$('#analytics-detail-description');
    const search=$('#analytics-detail-search'),typeFilter=$('#analytics-detail-type'),sort=$('#analytics-detail-sort'),pageSize=$('#analytics-detail-page-size');
    const isSummary=kind==='years'||kind==='genres';
    const sortOptions=isSummary?'<option value="default">'+(kind==='years'?'En yeni yıl':'En çok yapım')+'</option><option value="ascending">En az yapım</option><option value="name">Alfabetik</option>':'<option value="default">IMDb puanı</option><option value="year">Yapım yılı</option><option value="title">Yapım adı</option>';
    if(sort&&sort.dataset.kind!==kind){sort.innerHTML=sortOptions;sort.dataset.kind=kind;sort.value='default';}
    const query=(search?.value||'').trim().toLocaleLowerCase('tr');
    const type=typeFilter?.value||'all',sortMode=sort?.value||'default';
    const size=Number(pageSize?.value)||12;state.analyticsDetailPageSize=size;
    if(kind==='rating'){
      const index=Number(config.value);
      if(!ratingBounds)return;
      heading.textContent='IMDb '+RATING_LABELS[index]+' puan aralığı';
      description.textContent='Bu puan aralığındaki yapımlar. Listeyi ara, filtrele ve sıralayabilirsin.';
    }else if(kind==='years'){
      heading.textContent='Tüm yapım yılları';
      description.textContent='Katalogda bulunan bütün yapım yılları. Bir yıla dokunarak o yılın yapımlarını incele.';
    }else if(kind==='genres'){
      heading.textContent='Tüm türler';
      description.textContent='Katalogdaki türlerin tamamı. Bir türe dokunarak o türdeki yapımları incele.';
    }else if(kind==='year'){
      heading.textContent=config.value+' yılı yapımları';
      description.textContent='Seçilen yılda yayınlanan film ve diziler.';
    }else if(kind==='genre'){
      heading.textContent=config.value+' yapımları';
      description.textContent='Seçilen türde bulunan film ve diziler.';
    }
    const matchesType=item=>type==='all'||(type==='tv'?isSeries(item):!isSeries(item));
    let rows=[];
    if(kind==='years'||kind==='genres'){
      const counts={};
      catalog.filter(matchesType).forEach(item=>{
        if(kind==='years'){const y=yearOf(item);if(y!=='—'&&Number(y)>=1880&&Number(y)<=2100)counts[y]=(counts[y]||0)+1;}
        else getItemGenres(item).forEach(name=>{counts[name]=(counts[name]||0)+1;});
      });
      rows=Object.entries(counts).filter(([name])=>!query||String(name).toLocaleLowerCase('tr').includes(query));
      rows.sort((a,b)=>sortMode==='name'?a[0].localeCompare(b[0],'tr'):sortMode==='ascending'?a[1]-b[1]:kind==='years'?Number(b[0])-Number(a[0]):b[1]-a[1]);
    }else{
      rows=catalog.filter(item=>{
        if(!matchesType(item))return false;
        if(kind==='rating'){const n=getItemRating(item);return Number.isFinite(n)&&n>0&&n<=10&&n>=ratingBounds[0]&&n<ratingBounds[1];}
        if(kind==='year')return String(yearOf(item))===String(config.value);
        if(kind==='genre')return getItemGenres(item).includes(String(config.value));
        return false;
      }).filter(item=>!query||[titleOf(item),yearOf(item),item.director||item.tmdbDirector||''].join(' ').toLocaleLowerCase('tr').includes(query));
      rows.sort((a,b)=>sortMode==='title'?titleOf(a).localeCompare(titleOf(b),'tr'):sortMode==='year'?Number(yearOf(b))-Number(yearOf(a)):getItemRating(b)-getItemRating(a));
    }
    const count=rows.length,pages=Math.max(1,Math.ceil(count/size));
    state.analyticsDetailPage=Math.min(Math.max(1,state.analyticsDetailPage),pages);
    const shown=rows.slice((state.analyticsDetailPage-1)*size,state.analyticsDetailPage*size);
    const host=$('#analytics-detail-results');
    if(host){
      host.innerHTML=shown.length?shown.map(row=>{
        if(isSummary){
          const label=kind==='years'?row[0]+' yılı':row[0];
          return '<button type="button" class="analytics-detail-summary-row" data-report-action="'+(kind==='years'?'year':'genre')+'" data-report-value="'+escapeHtml(row[0])+'"><span><b>'+escapeHtml(label)+'</b><small>'+row[1]+' yapım</small></span><i>›</i></button>';
        }
        const rating=getItemRating(row),ratingText=Number.isFinite(rating)&&rating>0?rating.toFixed(1).replace('.',','):'—';
        return '<article class="analytics-detail-item"><img loading="lazy" src="'+escapeHtml(posterOf(row))+'" alt="" onerror="this.remove()"><div class="analytics-detail-item-main"><b>'+escapeHtml(titleOf(row))+'</b><small>'+(isSeries(row)?'Dizi':'Film')+' · '+escapeHtml(yearOf(row))+' · '+escapeHtml(row.director||row.tmdbDirector||'Yönetmen bilgisi yok')+'</small></div><strong>★ '+ratingText+'</strong></article>';
      }).join(''):'<div class="analytics-detail-empty">Bu filtrelerle eşleşen kayıt bulunamadı.</div>';
    }
    const countEl=$('#analytics-detail-count');if(countEl)countEl.textContent=count.toLocaleString('tr-TR')+(isSummary?' kategori':' yapım');
    const pageInfo=$('#analytics-detail-page-info');if(pageInfo)pageInfo.textContent=count?((state.analyticsDetailPage-1)*size+1)+'–'+Math.min(state.analyticsDetailPage*size,count)+' / '+count:'0 kayıt';
    const prev=$('#analytics-detail-prev'),next=$('#analytics-detail-next');
    if(prev)prev.disabled=state.analyticsDetailPage<=1;
    if(next)next.disabled=state.analyticsDetailPage>=pages;
    if(pageSize)pageSize.value=String(size);
  }
  function exportAnalyticsDetailCsv(){
    const config=state.analyticsDetail;if(!config){toast('Önce bir rapor aç.','info');return;}
    const catalog=Array.isArray(state.catalog)?state.catalog:[];
    const kind=config.kind,query=($('#analytics-detail-search')?.value||'').trim().toLocaleLowerCase('tr');
    const type=$('#analytics-detail-type')?.value||'all',sortMode=$('#analytics-detail-sort')?.value||'default';
    const matchesType=item=>type==='all'||(type==='tv'?isSeries(item):!isSeries(item));
    let rows=[];
    if(kind==='years'||kind==='genres'){
      const counts={};
      catalog.filter(matchesType).forEach(item=>{
        if(kind==='years'){const y=yearOf(item);if(y!=='—'&&Number(y)>=1880&&Number(y)<=2100)counts[y]=(counts[y]||0)+1;}
        else getItemGenres(item).forEach(name=>{counts[name]=(counts[name]||0)+1;});
      });
      rows=Object.entries(counts).filter(([name])=>!query||String(name).toLocaleLowerCase('tr').includes(query));
      rows.sort((a,b)=>sortMode==='name'?a[0].localeCompare(b[0],'tr'):sortMode==='ascending'?a[1]-b[1]:kind==='years'?Number(b[0])-Number(a[0]):b[1]-a[1]);
      const quote=value=>'"'+String(value??'').replace(/"/g,'""').replace(/[\r\n]+/g,' ')+'"';
      const csv='\uFEFF'+[quote(kind==='years'?'Yapım yılı':'Tür')+';'+quote('Yapım sayısı'),...rows.map(row=>row.map(quote).join(';'))].join('\r\n');
      downloadAnalyticsCsv(csv,'perde-'+(kind==='years'?'yil':'tur')+'-raporu');
      return;
    }
    const bounds=kind==='rating'?RATING_BOUNDS[Number(config.value)]:null;
    rows=catalog.filter(item=>{
      if(!matchesType(item))return false;
      if(kind==='rating'){const n=getItemRating(item);return !!bounds&&Number.isFinite(n)&&n>0&&n<=10&&n>=bounds[0]&&n<bounds[1];}
      if(kind==='year')return String(yearOf(item))===String(config.value);
      if(kind==='genre')return getItemGenres(item).includes(String(config.value));
      return false;
    }).filter(item=>!query||[titleOf(item),yearOf(item),item.director||item.tmdbDirector||''].join(' ').toLocaleLowerCase('tr').includes(query));
    rows.sort((a,b)=>sortMode==='title'?titleOf(a).localeCompare(titleOf(b),'tr'):sortMode==='year'?Number(yearOf(b))-Number(yearOf(a)):getItemRating(b)-getItemRating(a));
    const columns=[['Yapım adı',x=>titleOf(x)],['Tür',x=>isSeries(x)?'Dizi':'Film'],['Yıl',x=>yearOf(x)],['IMDb puanı',x=>getItemRating(x)||''],['Yönetmen',x=>x.director||x.tmdbDirector||''],['Tür etiketleri',x=>getItemGenres(x).join(' / ')],['Eklenme tarihi',x=>x.addedAt||'Bilinmiyor'],['TMDB ID',x=>x.tmdbId??x.tmdb_id??'']];
    const quote=value=>'"'+String(value??'').replace(/"/g,'""').replace(/[\r\n]+/g,' ')+'"';
    const csv='\uFEFF'+[columns.map(column=>quote(column[0])).join(';'),...rows.map(item=>columns.map(column=>quote(column[1](item))).join(';'))].join('\r\n');
    downloadAnalyticsCsv(csv,'perde-detayli-rapor');
  }
  function downloadAnalyticsCsv(csv,baseName){
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=baseName+'-'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
    toast('Filtrelenmiş rapor CSV olarak indirildi.','success');
  }
  function handleAnalyticsAction(action,value){
    if(action==='rating')openAnalyticsDetail('rating',Number(value));
    else if(action==='year')openAnalyticsDetail('year',String(value));
    else if(action==='genre')openAnalyticsDetail('genre',String(value));
    else if(action==='all-years')openAnalyticsDetail('years');
    else if(action==='all-genres')openAnalyticsDetail('genres');
  }
  function exportAnalyticsCsv(){
    const catalog=Array.isArray(state.catalog)?state.catalog:[];
    if(!catalog.length){toast('Dışa aktarılacak katalog kaydı bulunamadı.','info');return;}
    const columns=[['Yapım adı',x=>titleOf(x)],['Tür',x=>isSeries(x)?'Dizi':'Film'],['Yıl',x=>yearOf(x)],['Kataloğa eklenme tarihi',x=>x.addedAt||'Bilinmiyor'],['Puan',x=>x.rating??x.imdbRating??x.voteAverage??''],['Tür etiketleri',x=>{const v=x.genres??x.genre??x.category??x.categories??'';return Array.isArray(v)?v.map(g=>g&&typeof g==='object'?g.name:g).join(' / '):v;}],['Yönetmen',x=>x.director??x.directors??''],['TMDB ID',x=>x.tmdbId??x.tmdb_id??'']];
    const quote=value=>'"'+String(value??'').replace(/"/g,'""').replace(/[\r\n]+/g,' ')+'"';
    const csv='\uFEFF'+[columns.map(c=>quote(c[0])).join(';'),...catalog.map(item=>columns.map(c=>quote(c[1](item))).join(';'))].join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='perde-katalog-raporu-'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
    toast('Katalog CSV raporu indirilmeye hazır.','success');
  }
  function refreshYearFilter(){
    const el=$('#year-filter'),selected=el.value;
    const years=[...new Set(state.catalog.map(yearOf).filter(y=>y!=='—'))].sort((a,b)=>Number(b)-Number(a));
    el.innerHTML='<option value="all">Tüm yıllar</option>'+years.map(y=>'<option value="'+escapeHtml(y)+'">'+escapeHtml(y)+'</option>').join('');
    el.value=years.includes(Number(selected))||years.includes(selected)?String(selected):'all';
  }
  async function persist(nextData,successMessage){
    if(!canWrite()||state.saving)return false;
    state.saving=true;
    try{
      const response=await fetch('/api/catalog',{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({data:nextData,sha:state.sha})});
      const result=await response.json().catch(()=>({}));
      if(response.status===409)throw new Error('Katalog başka bir işlemde güncellenmiş. Sayfayı yenileyip tekrar deneyin.');
      if(!response.ok)throw new Error(result.error||'Değişiklik kaydedilemedi.');
      state.data=nextData;state.catalog=Array.isArray(nextData.catalog)?nextData.catalog:[];
      state.sha=result.sha;refreshYearFilter();updateMetrics();renderRecent();renderCatalog();renderMissingTrailers();renderCollections();renderFranchises();renderAnalytics();renderHomepage();renderHomepageLayout();renderPersonalizedSection();renderOverviewInsights();
      renderWatchLayout();renderAdminProfile();
      toast(successMessage||'Değişiklikler GitHub kataloğuna kaydedildi.','success');
      return true;
    }catch(error){toast(error.message,'error');console.error(error);return false;}
    finally{state.saving=false;}
  }
  function headerFooterDefaults(){
    return {
      header:{enabled:true,sticky:true,showLogoIcon:true,brandPrimary:'CINE',brandAccent:'VERSE',logoImage:'',showHome:true,homeLabel:'Ana Sayfa',showExplore:true,exploreLabel:'Keşfet',showFranchises:true,franchisesLabel:'Seri Filmler',showVideo:true,videoLabel:'Video Bağlantıları',showSearch:true,showProfile:true,showMobileMenu:true,catalogMenusInitialized:false,customLinks:[]},
      footer:{enabled:true,customLinks:[],brandPrimary:'CINE',brandAccent:'VERSE',logoImage:'',description:'Filmlerini keşfet, dizilerini takip et, izleme yolculuğunu kendi kütüphanende biriktir.',showBadges:true,badgeOne:'KİŞİSEL KÜTÜPHANE',badgeTwo:'DİZİ TAKİBİ',columnOneTitle:'CineVerse',homeLabel:'Ana Sayfa',exploreLabel:'Keşfet',libraryLabel:'Kütüphanem',columnTwoTitle:'İzleme Alanım',watchlistLabel:'İzleme Listem',statsLabel:'İstatistikler',featureTitle:'İzleme keyfini kişiselleştir',featureDescription:'Listeni oluştur, kaldığın yerden devam et ve izleme geçmişini tek yerde düzenle.',ctaLabel:'Kütüphaneme Git',showCta:true,copyright:'© 2026 CineVerse. Tüm hakları saklıdır.',showBackToTop:true}
    };
  }
  function headerFooterConfig(){
    const defaults=headerFooterDefaults();
    state.data.headerConfig={...defaults.header,...(state.data.headerConfig||{})};
    if(!state.data.headerConfig.catalogMenusInitialized){
      const required=[{label:'Filmler',page:'movies'},{label:'Diziler',page:'series'},{label:'Yerli Yapımlar',page:'turkish'}];
      const links=Array.isArray(state.data.headerConfig.customLinks)?state.data.headerConfig.customLinks:[];
      required.forEach(item=>{if(!links.some(link=>link.page===item.page))links.push(item);});
      state.data.headerConfig.customLinks=links;
      state.data.headerConfig.catalogMenusInitialized=true;
    }
    state.data.footerConfig={...defaults.footer,...(state.data.footerConfig||{})};
    return {header:state.data.headerConfig,footer:state.data.footerConfig};
  }
  const CUSTOM_LINK_PAGES=[['home','Ana Sayfa'],['explore','Keşfet'],['franchises','Seri Filmler'],['movies','Filmler'],['series','Diziler'],['turkish','Yerli Yapımlar'],['video-links','Video Bağlantıları'],['library','Kütüphanem'],['watchlist','İzleme Listem'],['stats','İstatistikler']];
  function renderCustomLinkRows(kind,links){
    const root=$('#hf-'+kind+'-custom-links');if(!root)return;
    const safe=Array.isArray(links)?links:[];
    root.innerHTML=safe.map((link,index)=>'<div class="hf-custom-link-row" data-custom-link-row="'+kind+'"><label class="field"><span>Menü adı</span><input type="text" maxlength="40" data-custom-link-label value="'+escapeHtml(link.label||'')+'" placeholder="Örn. Hakkımızda"></label><label class="field"><span>Yönlendirilecek sayfa</span><select data-custom-link-page>'+CUSTOM_LINK_PAGES.map(([page,label])=>'<option value="'+page+'" '+(link.page===page?'selected':'')+'>'+label+'</option>').join('')+'</select></label><button type="button" class="hf-remove-link" data-remove-custom-link aria-label="Menüyü sil">Sil</button></div>').join('');
  }
  function readCustomLinkRows(kind){
    return $$('#hf-'+kind+'-custom-links [data-custom-link-row]').map(row=>({label:row.querySelector('[data-custom-link-label]').value.trim(),page:row.querySelector('[data-custom-link-page]').value})).filter(link=>link.label);
  }

  function renderLogoPreview(kind,src){
    const preview=$('#hf-'+kind+'-logo-preview');if(!preview)return;
    preview.innerHTML=src?'<img src="'+src+'" alt="'+kind+' logo önizlemesi">':'<span>Logo yüklenmedi</span>';
    const remove=$('[data-remove-logo="'+kind+'"]');if(remove)remove.disabled=!src;
  }
  async function readLogoFile(file){
    if(!file)return '';
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Yalnızca PNG, JPG veya WebP dosyası yükleyebilirsin.');
    if(file.size>4*1024*1024)throw new Error('Logo dosyası 4 MB sınırını aşamaz.');
    const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Logo dosyası okunamadı.'));reader.readAsDataURL(file);});
    const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Görsel açılamadı.'));img.src=source;});
    const scale=Math.min(1,900/image.width,320/image.height),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/webp',.88);
  }
  function renderHeaderFooter(){
    if(!state.data)return;
    const {header:h,footer:f}=headerFooterConfig();
    const fields={
      'hf-header-primary':h.brandPrimary,'hf-header-accent':h.brandAccent,'hf-header-home-label':h.homeLabel,'hf-header-explore-label':h.exploreLabel,'hf-header-franchises-label':h.franchisesLabel||'Seri Filmler','hf-header-video-label':h.videoLabel,
      'hf-footer-primary':f.brandPrimary,'hf-footer-accent':f.brandAccent,'hf-footer-description':f.description,'hf-footer-badge-one':f.badgeOne,'hf-footer-badge-two':f.badgeTwo,
      'hf-footer-col-one':f.columnOneTitle,'hf-footer-home-label':f.homeLabel,'hf-footer-explore-label':f.exploreLabel,'hf-footer-library-label':f.libraryLabel,
      'hf-footer-col-two':f.columnTwoTitle,'hf-footer-watchlist-label':f.watchlistLabel,'hf-footer-stats-label':f.statsLabel,'hf-footer-feature-title':f.featureTitle,
      'hf-footer-feature-description':f.featureDescription,'hf-footer-cta-label':f.ctaLabel,'hf-footer-copyright':f.copyright
    };
    Object.entries(fields).forEach(([id,value])=>setField(id,value));
    const checks={
      'hf-header-enabled':h.enabled!==false,'hf-header-sticky':h.sticky!==false,'hf-header-logo-icon':h.showLogoIcon!==false,'hf-header-search':h.showSearch!==false,
      'hf-header-profile':h.showProfile!==false,'hf-header-mobile':h.showMobileMenu!==false,'hf-header-home':h.showHome!==false,'hf-header-explore':h.showExplore!==false,'hf-header-franchises':h.showFranchises!==false,'hf-header-video':h.showVideo!==false,
      'hf-footer-enabled':f.enabled!==false,'hf-footer-badges':f.showBadges!==false,'hf-footer-cta':f.showCta!==false,'hf-footer-backtop':f.showBackToTop!==false
    };
    Object.entries(checks).forEach(([id,value])=>{const el=$('#'+id);if(el)el.checked=value;});
    renderCustomLinkRows('header',h.customLinks);renderCustomLinkRows('footer',f.customLinks);
    renderLogoPreview('header',h.logoImage);renderLogoPreview('footer',f.logoImage);
  }
  async function saveHeaderFooter(event){
    event.preventDefault();
    if(!canWrite())return;
    headerFooterConfig();
    const value=id=>String($('#'+id).value||'').trim();
    const checked=id=>$('#'+id).checked;
    const header={
      enabled:checked('hf-header-enabled'),sticky:checked('hf-header-sticky'),showLogoIcon:checked('hf-header-logo-icon'),
      brandPrimary:value('hf-header-primary'),brandAccent:value('hf-header-accent'),
      logoImage:state.data.headerConfig?.logoImage||'',
      showHome:checked('hf-header-home'),homeLabel:value('hf-header-home-label')||'Ana Sayfa',
      showExplore:checked('hf-header-explore'),exploreLabel:value('hf-header-explore-label')||'Keşfet',
      showFranchises:checked('hf-header-franchises'),franchisesLabel:value('hf-header-franchises-label')||'Seri Filmler',
      showVideo:checked('hf-header-video'),videoLabel:value('hf-header-video-label')||'Video Bağlantıları',
      showSearch:checked('hf-header-search'),showProfile:checked('hf-header-profile'),showMobileMenu:checked('hf-header-mobile'),catalogMenusInitialized:true,customLinks:readCustomLinkRows('header')
    };
    const footer={
      enabled:checked('hf-footer-enabled'),brandPrimary:value('hf-footer-primary'),brandAccent:value('hf-footer-accent'),
      logoImage:state.data.footerConfig?.logoImage||'',
      description:value('hf-footer-description'),showBadges:checked('hf-footer-badges'),badgeOne:value('hf-footer-badge-one'),badgeTwo:value('hf-footer-badge-two'),
      columnOneTitle:value('hf-footer-col-one'),homeLabel:value('hf-footer-home-label'),exploreLabel:value('hf-footer-explore-label'),libraryLabel:value('hf-footer-library-label'),
      columnTwoTitle:value('hf-footer-col-two'),watchlistLabel:value('hf-footer-watchlist-label'),statsLabel:value('hf-footer-stats-label'),
      featureTitle:value('hf-footer-feature-title'),featureDescription:value('hf-footer-feature-description'),ctaLabel:value('hf-footer-cta-label'),
      showCta:checked('hf-footer-cta'),copyright:value('hf-footer-copyright'),showBackToTop:checked('hf-footer-backtop'),customLinks:readCustomLinkRows('footer')
    };
    const ok=await persist({...state.data,headerConfig:header,footerConfig:footer},'Header ve Footer ayarları kaydedildi.');
    if(ok)renderHeaderFooter();
  }
  function setField(id,value){const el=$('#'+id);if(el)el.value=value??'';}
  function openEditor(item=null){
    // Formu salt-okunur durumda da aç: böylece kullanıcı içerik hazırlayabilir;
    // kaydetme sırasında canWrite() güvenlik kontrolü yine uygulanır.
    $('#content-form').reset();$('#edit-id').value=item?String(item.id??''):'';
    state.tmdbSelected=item?{...item}:null;
    $('#tmdb-search-input').value='';$('#tmdb-search-results').hidden=true;$('#tmdb-search-results').innerHTML='';
    $('#tmdb-search-status').textContent=item?'Mevcut kayıt düzenleniyor. İstersen başka bir TMDB sonucu seçerek bilgileri yenileyebilirsin.':'Başlık yazmaya başla; TMDB eşleşmelerini listeleyelim. Manuel giriş de her zaman açık.';
    $('#editor-title').textContent=item?'İçeriği düzenle':'Yeni yapım';
    setField('field-title',item?.title||'');setField('field-type',isSeries(item)?'tv':'movie');
    setField('field-year',item?.year||'');setField('field-rating',item?.rating||item?.tmdbRating||'');
    setField('field-genre',item?.genre||'');setField('field-category',item?.category||item?.tmdbGenres||'');
    setField('field-duration',item?.duration||item?.tmdbRuntime||'');setField('field-country',item?.country||item?.tmdbCountries||'');
    setField('field-director',item?.director||item?.tmdbDirector||'');setField('field-platform',item?.platform||'');setField('field-cast',(item?.cast||item?.tmdbCast||[]).map(x=>typeof x==='string'?x:(x?.name||'')).join(', '));
    setField('field-watch',item?.watchUrl||'');setField('field-note',item?.personalNote||'');
    setField('field-episode-urls',Object.entries(item?.episodeWatchUrls||{}).map(([key,url])=>key.replace(':',':')+' | '+url).join('\n'));
    setField('field-tmdb',item?.tmdbId||'');setField('field-imdb',item?.imdbId||item?.tmdbImdbId||'');
    setField('field-image',item?.image||item?.poster||item?.tmdbPoster||'');setField('field-backdrop',item?.backdrop||item?.tmdbBackdrop||'');
    setField('field-trailer',item?.trailerUrl||item?.tmdbTrailerUrl||'');setField('field-trailer-provider',item?.trailerProvider||'auto');setField('field-seasons',item?.seasons||'');
    setField('field-episodes',item?.episodes||'');setField('field-desc',item?.desc||item?.tmdbOverview||'');
    $('#editor-status').textContent=!state.apiEnabled?'Önizleme ve manuel düzenleme açık. Kaydetmek için GitHub erişim anahtarı yenilenmeli.':(item?'Mevcut katalog kaydı düzenleniyor.':'Yeni katalog kaydı oluşturuluyor.');
    renderContentPreview();
    const dialog=$('#content-dialog');
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  }
  const TMDB_API_KEY='3108265ab3fdbf3af14175edf64a9c7f';
  const TMDB_IMAGE='https://image.tmdb.org/t/p/';
  async function tmdbRequest(path){
    const response=await fetch('https://api.themoviedb.org/3/'+path+(path.includes('?')?'&':'?')+'api_key='+TMDB_API_KEY+'&language=tr-TR');
    if(!response.ok)throw new Error('TMDB yanıt vermedi (HTTP '+response.status+').');
    return response.json();
  }
  function normalizeContentTitle(value){
    return String(value||'').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  }
  function findDuplicateContent(candidate,excludeId=''){
    const tmdbId=String(candidate.tmdbId||'').trim();
    const imdbId=String(candidate.imdbId||candidate.tmdbImdbId||'').trim().toLowerCase();
    const title=normalizeContentTitle(candidate.title||candidate.name);
    const type=candidate.type==='tv'||candidate.media_type==='tv'?'tv':'movie';
    const year=String(candidate.year||(candidate.release_date||candidate.first_air_date||'').slice(0,4)||'').trim();
    return state.catalog.find(item=>{
      if(excludeId&&String(item.id)===String(excludeId))return false;
      if(tmdbId&&String(item.tmdbId||'')===tmdbId)return true;
      const itemImdb=String(item.imdbId||item.tmdbImdbId||'').trim().toLowerCase();
      if(imdbId&&itemImdb&&itemImdb===imdbId)return true;
      if((isSeries(item)?'tv':'movie')!==type||normalizeContentTitle(titleOf(item))!==title)return false;
      const itemYear=String(item.year||item.tmdbReleaseDate?.slice(0,4)||'').trim();
      return !year||!itemYear||year===itemYear;
    })||null;
  }
  function renderTmdbResults(results){
    const host=$('#tmdb-search-results');
    const editingId=$('#edit-id').value;
    host.innerHTML=results.map(item=>{
      const name=item.title||item.name||item.original_title||item.original_name||'İsimsiz yapım';
      const date=item.release_date||item.first_air_date||'';
      const year=date.slice(0,4)||'Yıl bilinmiyor';
      const kind=item.media_type==='tv'?'Dizi':'Film';
      const poster=item.poster_path?TMDB_IMAGE+'w185'+item.poster_path:'';
      const duplicate=findDuplicateContent({tmdbId:item.id,title:name,type:item.media_type,year},editingId);
      return '<button type="button" class="tmdb-result'+(duplicate?' is-added':'')+'" data-tmdb-id="'+Number(item.id)+'" data-tmdb-type="'+item.media_type+'" '+(duplicate?'disabled aria-disabled="true"':'')+'><span class="tmdb-result-poster">'+(poster?'<img src="'+escapeHtml(poster)+'" alt="">':'<i>▣</i>')+'</span><span class="tmdb-result-copy"><b>'+escapeHtml(name)+'</b><small>'+kind+' · '+escapeHtml(year)+' · '+escapeHtml(item.original_title||item.original_name||'')+'</small></span><span class="tmdb-result-state">'+(duplicate?'✓ Yapım eklenmiş':'＋ Ekle')+'</span></button>';
    }).join('');
    host.hidden=!results.length;
  }
  async function searchTmdbTitles(query){
    const request=++state.tmdbSearchRequest;
    const host=$('#tmdb-search-results'),status=$('#tmdb-search-status');
    if(query.length<2){host.hidden=true;host.innerHTML='';status.textContent='En az iki karakter yaz. Manuel giriş de her zaman açık.';return;}
    status.textContent='TMDB kataloğunda aranıyor…';host.hidden=true;
    try{
      const data=await tmdbRequest('search/multi?query='+encodeURIComponent(query)+'&include_adult=false&page=1');
      if(request!==state.tmdbSearchRequest)return;
      const results=(data.results||[]).filter(x=>['movie','tv'].includes(x.media_type)).slice(0,8);
      if(!results.length){status.textContent='Eşleşme bulunamadı. Başlığı manuel girebilirsin.';return;}
      status.textContent=results.length+' eşleşme bulundu. Bilgilerini almak için bir yapım seç.';
      renderTmdbResults(results);
    }catch(error){if(request!==state.tmdbSearchRequest)return;status.textContent='TMDB araması yapılamadı. Bilgileri manuel girebilirsin.';toast(error.message,'error');}
  }
  async function selectTmdbTitle(id,type){
    const status=$('#tmdb-search-status'),host=$('#tmdb-search-results');
    host.hidden=true;status.textContent='Yapım bilgileri, oyuncular ve görseller alınıyor…';
    try{
      const detail=await tmdbRequest((type==='tv'?'tv/':'movie/')+id+'?append_to_response=credits,videos,external_ids');
      const isTv=type==='tv',title=detail.title||detail.name||'';
      const release=detail.release_date||detail.first_air_date||'';
      const genres=(detail.genres||[]).map(x=>x.name).filter(Boolean);
      const countries=(detail.production_countries||[]).map(x=>x.name).filter(Boolean);
      const cast=(detail.credits?.cast||[]).slice(0,20).map((x,index)=>({id:x.id,name:x.name,character:x.character||'',profile:x.profile_path?TMDB_IMAGE+'w185'+x.profile_path:'',order:x.order??index}));
      const directors=isTv?(detail.created_by||[]).map(x=>x.name):(detail.credits?.crew||[]).filter(x=>x.job==='Director').map(x=>x.name);
      const trailer=(detail.videos?.results||[]).find(x=>x.site==='YouTube'&&x.type==='Trailer'&&x.key);
      const runtime=isTv?(detail.episode_run_time||[])[0]:detail.runtime;
      const trailerUrl=trailer?'https://www.youtube.com/watch?v='+trailer.key:'';
      const record={
        tmdbId:Number(detail.id),tmdbTitle:title,tmdbOriginalTitle:detail.original_title||detail.original_name||title,
        tmdbReleaseDate:release,tmdbGenres:genres.join(' / '),tmdbRuntime:runtime?runtime+' dk':'',
        tmdbCountries:countries.join(', '),tmdbDirector:directors.join(', '),tmdbCast:cast,
        tmdbOverview:detail.overview||'',tmdbPoster:detail.poster_path?TMDB_IMAGE+'w500'+detail.poster_path:'',
        tmdbBackdrop:detail.backdrop_path?TMDB_IMAGE+'w1280'+detail.backdrop_path:'',
        tmdbTrailerUrl:trailerUrl,tmdbImdbId:detail.external_ids?.imdb_id||detail.imdb_id||'',
        tmdbRating:detail.vote_average?Number(detail.vote_average).toFixed(1):'',tmdbVoteCount:detail.vote_count||0
      };
      state.tmdbSelected=record;
      setField('field-title',title);setField('field-type',type);setField('field-year',release.slice(0,4));
      setField('field-rating',record.tmdbRating);setField('field-genre',genres[0]||'');
      setField('field-category',record.tmdbGenres);setField('field-duration',record.tmdbRuntime);
      setField('field-country',record.tmdbCountries);setField('field-director',record.tmdbDirector);
      setField('field-cast',cast.map(x=>x.name).join(', '));setField('field-tmdb',record.tmdbId);
      setField('field-imdb',record.tmdbImdbId);setField('field-image',record.tmdbPoster);
      setField('field-backdrop',record.tmdbBackdrop);setField('field-trailer',record.tmdbTrailerUrl);
      setField('field-seasons',isTv?detail.number_of_seasons:'');setField('field-episodes',isTv?detail.number_of_episodes:'');
      setField('field-desc',record.tmdbOverview);
      status.textContent='✓ '+title+' bilgileri alındı. Alanları düzenleyebilir veya eksik bilgileri manuel tamamlayabilirsin.';
      renderContentPreview();
    }catch(error){status.textContent='Yapım bilgileri alınamadı. Alanları manuel doldurabilirsin.';toast(error.message,'error');}
  }
  function renderContentPreview(){
    const value=id=>String($('#'+id)?.value||'').trim();
    const title=value('field-title')||'Yeni yapımın burada görünecek';
    const type=$('#field-type')?.value==='tv'?'Dizi':'Film';
    const year=value('field-year')||'Yıl belirtilmedi',rating=value('field-rating')||'—';
    const poster=value('field-image'),backdrop=value('field-backdrop')||poster;
    const description=value('field-desc')||'TMDB’den bir yapım seç veya bilgileri manuel doldur. Önizleme otomatik güncellenecek.';
    const genres=value('field-category')||'Tür bilgisi eklenmedi';
    $('#content-preview-title').textContent=title;
    $('#content-preview-meta').textContent=type+' · '+year+' · ★ '+rating;
    $('#content-preview-description').textContent=description;
    $('#content-preview-tags').innerHTML=genres.split(/[\\/,;]+/).map(x=>x.trim()).filter(Boolean).slice(0,5).map(x=>'<span>'+escapeHtml(x)+'</span>').join('')||'<span>Tür bilgisi eklenmedi</span>';
    const image=$('#content-preview-poster');
    if(poster){image.src=poster;image.hidden=false;$('#content-preview-poster-empty').hidden=true;}
    else{image.removeAttribute('src');image.hidden=true;$('#content-preview-poster-empty').hidden=false;}
    $('#content-preview-backdrop').style.backgroundImage=backdrop?'linear-gradient(90deg,rgba(8,12,18,.98),rgba(8,12,18,.86) 48%,rgba(8,12,18,.42)),url("'+backdrop.replace(/["\\]/g,'')+'")':'linear-gradient(120deg,#263541,#111923)';
  }
  function parseEpisodeWatchUrls(value){
    const result={};
    const lines=String(value||'').split(/\r?\n/);
    for(let index=0;index<lines.length;index++){
      const line=lines[index].trim();
      if(!line)continue;
      const match=line.match(/^(\d{1,3}):(\d{1,4})\s*\|\s*(https?:\/\/\S+)$/i);
      if(!match)throw new Error('Bölüm bağlantısı '+(index+1)+'. satırda hatalı. Biçim: sezon:bölüm | https://…/bolum.mp4');
      const season=Number(match[1]),episode=Number(match[2]),url=match[3];
      if(season<1||episode<1)throw new Error('Sezon ve bölüm numarası 1 veya daha büyük olmalı.');
      if(!/\.mp4(?:$|[?#])/i.test(url))throw new Error('Şimdilik yalnızca doğrudan MP4 video bağlantıları destekleniyor. ('+index+'. satır)');
      const key=season+':'+episode;
      if(result[key])throw new Error(key+' için birden fazla bağlantı girilmiş.');
      result[key]=url;
    }
    return result;
  }
  async function saveContent(event){
    event.preventDefault();if(!canWrite())return;
    const existingId=$('#edit-id').value,existing=existingId?state.catalog.find(x=>String(x.id)===existingId):null;
    const type=$('#field-type').value;
    let episodeWatchUrls={};
    try{episodeWatchUrls=parseEpisodeWatchUrls($('#field-episode-urls').value);}catch(error){toast(error.message,'error');return;}
    const record={...(existing||{}),...(existing?{}:{addedAt:new Date().toISOString()}),id:existing?.id??('cv-'+Date.now()),title:$('#field-title').value.trim(),type,
      year:$('#field-year').value.trim(),rating:$('#field-rating').value.trim(),genre:$('#field-genre').value.trim(),
      category:$('#field-category').value.trim(),duration:$('#field-duration').value.trim(),country:$('#field-country').value.trim(),
      director:$('#field-director').value.trim(),platform:$('#field-platform').value.trim(),watchUrl:$('#field-watch').value.trim(),
      personalNote:$('#field-note').value.trim(),episodeWatchUrls: type==='tv'?episodeWatchUrls:{},tmdbId:$('#field-tmdb').value.trim()?Number($('#field-tmdb').value):null,
      imdbId:$('#field-imdb').value.trim(),image:$('#field-image').value.trim(),
      backdrop:$('#field-backdrop').value.trim(),trailerUrl:$('#field-trailer').value.trim(),trailerProvider:$('#field-trailer-provider').value||'auto',desc:$('#field-desc').value.trim(),cast:$('#field-cast').value.split(',').map(x=>x.trim()).filter(Boolean)};
    if(state.tmdbSelected&&String(state.tmdbSelected.tmdbId||'')===String(record.tmdbId||'')){
      const source=state.tmdbSelected;
      ['tmdbTitle','tmdbOriginalTitle','tmdbReleaseDate','tmdbGenres','tmdbRuntime','tmdbCountries','tmdbDirector','tmdbCast','tmdbOverview','tmdbPoster','tmdbBackdrop','tmdbTrailerUrl','tmdbImdbId','tmdbRating','tmdbVoteCount'].forEach(key=>{if(source[key]!==undefined)record[key]=source[key];});
    }
    if(state.tmdbSelected&&record.tmdbCast&&Array.isArray(record.tmdbCast)){
      const selectedNames=record.tmdbCast.map(x=>x?.name||'').filter(Boolean).join(', ');
      const manualNames=record.cast.join(', ');
      if(selectedNames.toLocaleLowerCase('tr-TR')!==manualNames.toLocaleLowerCase('tr-TR'))delete record.tmdbCast;
    }
    if(!record.title){toast('Yapım adı zorunludur.');return;}
    const duplicate=findDuplicateContent(record,existing?.id||'');
    if(duplicate){
      toast('Bu yapım katalogda zaten ekli: '+titleOf(duplicate));
      $('#tmdb-search-status').textContent='Bu yapım zaten katalogda kayıtlı. Mevcut kaydı Film & Diziler bölümünden düzenleyebilirsin.';
      return;
    }
    if(type==='tv'){record.seasons=Number($('#field-seasons').value)||1;record.episodes=Number($('#field-episodes').value)||0;}else{delete record.seasons;delete record.episodes;}
    const nextData={...state.data,catalog:[...state.catalog]};
    const index=nextData.catalog.findIndex(x=>String(x.id)===String(record.id));
    if(index>=0)nextData.catalog[index]=record;else nextData.catalog.push(record);
    $('#save-content').disabled=true;$('#save-content').textContent='Kaydediliyor…';
    const ok=await persist(nextData,existing?'Yapım güncellendi.':'Yeni yapım kataloğa eklendi.');
    $('#save-content').disabled=false;$('#save-content').textContent='Kaydet ve yayınla';
    if(ok)$('#content-dialog').close();
  }
  async function deleteContent(id){
    if(!canWrite())return;
    const item=state.catalog.find(x=>String(x.id)===String(id));if(!item)return;
    if(state.catalog.length<=1){toast('Katalogda en az bir yapım kalmalı.');return;}
    if(!confirm('“'+titleOf(item)+'” kaydını katalogdan silmek istiyor musun? Bu işlem yayına yansır.'))return;
    const nextData={...state.data,catalog:state.catalog.filter(x=>String(x.id)!==String(id))};
    if(Array.isArray(nextData.collections))nextData.collections=nextData.collections.map(c=>({...c,items:(c.items||[]).filter(x=>String(x)!==String(id))}));
    if(nextData.homepageConfig?.heroSlides)nextData.homepageConfig={...nextData.homepageConfig,heroSlides:nextData.homepageConfig.heroSlides.filter(x=>String(x.id)!==String(id))};
    await persist(nextData,'Yapım silindi; koleksiyon ve vitrin bağlantıları temizlendi.');
  }
  function openCollectionEditor(id){
    if(!canWrite())return;
    const item=collectionList().find(x=>String(x.id)===String(id));
    $('#collection-form').reset();$('#collection-id').value=item?.id||'';
    $('#collection-title').value=item?.title||'';$('#collection-description').value=item?.description||'';
    $('#collection-active').checked=item?.active!==false;
    const selected=new Set((item?.items||[]).map(String));
    $('#collection-items').innerHTML=state.catalog.map(x=>'<label class="collection-pick"><input type="checkbox" value="'+escapeHtml(x.id)+'" '+(selected.has(String(x.id))?'checked':'')+'><span><b>'+escapeHtml(titleOf(x))+'</b><small>'+(isSeries(x)?'Dizi':'Film')+' · '+escapeHtml(yearOf(x))+'</small></span></label>').join('');
    $('#collection-search').value='';filterCollectionItems();
    $('#collection-dialog-title').textContent=item?'Koleksiyonu düzenle':'Yeni koleksiyon';
    $('#collection-dialog').showModal();
  }
  function filterCollectionItems(){
    const q=$('#collection-search').value.trim().toLocaleLowerCase('tr');
    $$('.collection-pick').forEach(el=>el.hidden=!el.textContent.toLocaleLowerCase('tr').includes(q));
  }
  async function saveCollection(event){
    event.preventDefault();if(!canWrite())return;
    const id=$('#collection-id').value||('collection-'+Date.now());
    const existing=collectionList().find(x=>String(x.id)===String(id));
    const record={...(existing||{}),id,title:$('#collection-title').value.trim(),description:$('#collection-description').value.trim(),
      active:$('#collection-active').checked,items:$$('#collection-items input:checked').map(x=>x.value)};
    if(!record.title){toast('Koleksiyon adı zorunludur.');return;}
    const nextData={...state.data,collections:[...collectionList()]};
    const index=nextData.collections.findIndex(x=>String(x.id)===String(id));
    if(index>=0)nextData.collections[index]=record;else nextData.collections.push(record);
    const ok=await persist(nextData,existing?'Koleksiyon güncellendi.':'Koleksiyon oluşturuldu.');
    if(ok)$('#collection-dialog').close();
  }
  async function deleteCollection(id){
    if(!canWrite())return;const item=collectionList().find(x=>String(x.id)===String(id));if(!item)return;
    if(!confirm('“'+item.title+'” koleksiyonunu silmek istiyor musun?'))return;
    await persist({...state.data,collections:collectionList().filter(x=>String(x.id)!==String(id))},'Koleksiyon silindi.');
  }
  function homepageConfig(){
    if(!state.data.homepageConfig)state.data.homepageConfig={version:2,settings:{desktopCount:10,mobileCount:6,interval:6,autoplay:true,pauseOnHover:true},heroSlides:[]};
    if(!state.data.homepageConfig.settings)state.data.homepageConfig.settings={};
    if(!Array.isArray(state.data.homepageConfig.heroSlides))state.data.homepageConfig.heroSlides=[];
    return state.data.homepageConfig;
  }
  const watchCardDefinitions={
    player:{label:'Video oynatıcı',defaultSide:'left',description:'Film veya bölüm oynatıcısı'},
    season:{label:'Sezon seçimi',defaultSide:'left',description:'Diziler için sezon seçici'},
    episodes:{label:'Sezon bölümleri',defaultSide:'left',description:'Bölüm listesi ve gezinme'},
    synopsis:{label:'Yapım özeti',defaultSide:'left',description:'Başlık, puan ve hikâye'},
    reviews:{label:'Yorumlar ve değerlendirmeler',defaultSide:'left',description:'İzleyici yorumları'},
    credits:{label:'Yapım künyesi',defaultSide:'right',description:'Yönetmen, yıl, tür ve süre'},
    cast:{label:'Oyuncu kadrosu',defaultSide:'right',description:'Oyuncular ve karakterleri'},
    similar:{label:'Benzer yapımlar',defaultSide:'right',description:'Önerilen film ve diziler'}
  };
  const watchCardIds=Object.keys(watchCardDefinitions);
  let watchDemoType='movie';
  function watchLayoutConfig(){
    const saved=state.data?.watchPageConfig||{};
    const left=[],right=[],used=new Set();
    const removed=Array.isArray(saved.removed)?saved.removed.filter(id=>watchCardIds.includes(id)):[];
    const hidden=Array.isArray(saved.hidden)?saved.hidden.filter(id=>watchCardIds.includes(id)):[];
    const append=(source,target)=>{
      if(!Array.isArray(source))return;
      source.forEach(id=>{
        if(watchCardIds.includes(id)&&!removed.includes(id)&&!used.has(id)){target.push(id);used.add(id);}
      });
    };
    append(saved.left,left);append(saved.right,right);
    watchCardIds.forEach(id=>{
      if(!used.has(id)&&!removed.includes(id)){(watchCardDefinitions[id].defaultSide==='left'?left:right).push(id);used.add(id);}
    });
    return {left,right,hidden:hidden.filter(id=>used.has(id)),removed:[...new Set(removed)]};
  }
  function watchDemoSample(){
    return state.catalog.find(item=>isSeries(item)===(watchDemoType==='tv'))||state.catalog[0]||null;
  }
  let watchDemoViewport='desktop';
  function renderWatchDemo(config){
    const sample=watchDemoSample();
    const isTv=watchDemoType==='tv';
    const title=sample?titleOf(sample):(isTv?'Örnek Dizi':'Örnek Film');
    const poster=sample?posterOf(sample):'';
    const backdrop=sample?(sample.backdrop||poster):'';
    const year=sample?yearOf(sample):'2025';
    const rating=sample?(sample.rating||sample.tmdbRating||'—'):'8.2';
    const runtime=sample?(sample.duration||sample.runtime||(isTv?'45 dk / bölüm':'120 dk')):(isTv?'45 dk / bölüm':'120 dk');
    const director=sample?(sample.director||sample.tmdbDirector||'—'):'—';
    const genre=sample?(sample.category||sample.genre||'Drama / Gerilim'):'Drama / Gerilim';
    const description=sample?(sample.desc||sample.tmdbOverview||'Bu yapımın hikâye özeti katalog kaydında bulunmuyor.'):'Bu yapımın hikâye özeti burada görüntülenir.';
    const isDirect=!!(sample?.watchUrl&&/\.mp4(?:$|[?#])/i.test(sample.watchUrl));
    const hasExternal=!!sample?.watchUrl&&!isDirect;
    const posterStyle=backdrop?' style="background-image:linear-gradient(0deg,rgba(0,0,0,.92),rgba(0,0,0,.12) 72%),url(\''+escapeHtml(backdrop)+'\')"':'';
    const player='<div class="watch-real-player"'+posterStyle+'>'+
      '<div class="watch-real-player-shade"></div>'+
      '<div class="watch-real-player-top"><span class="watch-real-brand">CINEVERSE <i>●</i></span><span>'+(isDirect?'YERLEŞİK OYNATICI':hasExternal?'HARİCİ İZLEME KAYNAĞI':'İZLEME KAYNAĞI EKLENMEMİŞ')+'</span></div>'+
      '<div class="watch-real-play"><span>▶</span></div>'+
      '<div class="watch-real-player-bottom"><div class="watch-real-now"><img src="'+escapeHtml(poster||backdrop)+'" alt="" onerror="this.style.display=\'none\'"><div><b>'+escapeHtml(title)+'</b><small>'+(isTv?'SEZON 1 · BÖLÜM 1':'OYNATMAK İÇİN TIKLA')+'</small></div></div>'+
      (hasExternal?'<span class="watch-real-source">KAYNAĞI AÇ ↗</span>':'')+
      '<div class="watch-real-progress"><span></span></div><div class="watch-real-controls"><div><b>▶</b><b>↶ 10</b><b>↷ 10</b><small>00:24 / '+(isTv?'48:12':'02:04:18')+'</small></div><div><b>JENERİĞİ GEÇ</b><b>⚙</b><b>⛶</b></div></div></div></div>';
    const season='<div class="watch-real-card watch-real-season"><div class="watch-real-section-title"><span>▣</span><div><b>SEZON SEÇİMİ</b><small>İzlemek istediğiniz sezonu belirleyin</small></div></div><select aria-label="Sezon seçimi" tabindex="-1"><option>1. Sezon</option><option>2. Sezon</option></select></div>';
    const episodes='<div class="watch-real-card watch-real-episodes"><div class="watch-real-card-head"><b>▣　1. SEZON BÖLÜMLERİ</b><small>Toplam '+(sample?.episodes||8)+' Bölüm</small></div><div class="watch-real-progress-info"><div><b>Bu sezon izleme ilerlemesi</b><strong>25%</strong></div><span><i></i></span><small>2 / '+(sample?.episodes||8)+' bölüm izlendi</small><div class="watch-real-episode-actions"><b>▶ Son izlediğimden devam et</b><b>Sonraki bölüm　›</b></div></div><div class="watch-real-episode-grid">'+[1,2,3,4].map((n)=>'<div class="watch-real-episode"><div class="watch-real-still"'+(backdrop?' style="background-image:url(\''+escapeHtml(backdrop)+'\')"':'')+'><span>'+(n===1?'48:12':'45:36')+'</span></div><div><b>'+String(n).padStart(2,'0')+'. '+(['Yeni bir başlangıç','İlk karşılaşma','Kırılma noktası','Yeni karar'][n-1])+'</b><small>'+(n===1?'✓ İzlendi':n===2?'● Seçili bölüm':'Bölümü seç')+'</small></div></div>').join('')+'</div></div>';
    const synopsis='<div class="watch-real-card"><div class="watch-real-card-head"><b>HİKÂYE</b></div><p class="watch-real-description">'+escapeHtml(description.slice(0,300))+(description.length>300?'…':'')+'</p></div>';
    const reviews='<div class="watch-real-card"><div class="watch-real-card-head"><b>İZLEYİCİ YORUMLARI</b><small>＋ Yorum yaz</small></div><p class="watch-real-muted">Bu yapım hakkındaki değerlendirmeler ve izleyici yorumları.</p></div>';
    const credits='<div class="watch-real-card"><div class="watch-real-card-head"><b>ⓘ　YAPIM KÜNYESİ</b><strong>★ '+escapeHtml(rating)+'/10</strong></div>'+
      [['Orijinal İsim',title],['Yönetmen',director],['Kategori',genre],['Yıl / Süre',year+' • '+runtime],['Ülke',sample?.country||'—']].map(([k,v])=>'<div class="watch-real-detail"><span>'+escapeHtml(k)+'</span><b>'+escapeHtml(v)+'</b></div>').join('')+'</div>';
    const castItems=Array.isArray(sample?.tmdbCast)?sample.tmdbCast.slice(0,5):[];
    const cast='<div class="watch-real-card"><div class="watch-real-card-head"><b>OYUNCU KADROSU</b><span>‹　›</span></div><div class="watch-real-cast">'+(castItems.length?castItems.map(x=>'<div><img src="'+escapeHtml(x.profile||'')+'" alt="" onerror="this.style.display=\'none\'"><b>'+escapeHtml(x.name||'Oyuncu')+'</b><small>'+escapeHtml(x.character||x.role||'')+'</small></div>').join(''):[1,2,3].map((n)=>'<div><i>'+['AK','MY','SD'][n-1]+'</i><b>Oyuncu adı</b><small>Karakter</small></div>').join(''))+'</div></div>';
    const similar='<div class="watch-real-card"><div class="watch-real-card-head"><b>BENZER YAPIMLAR</b><small>Keşfet　›</small></div><div class="watch-real-similar">'+[1,2,3].map((n)=>'<div><span>'+(n===1?'▣':'▧')+'</span><b>Önerilen yapım</b></div>').join('')+'</div></div>';
    const labels={player,season,episodes,synopsis,reviews,credits,cast,similar};
    const renderColumn=side=>config[side].filter(id=>!config.hidden.includes(id)&&(isTv||!['season','episodes'].includes(id))).map(id=>'<div class="watch-real-card-wrap" data-demo-card="'+id+'">'+labels[id]+'</div>').join('');
    $('#watch-demo-left').innerHTML=renderColumn('left')||'<div class="watch-demo-empty">Bu alanda görünür kart yok.</div>';
    $('#watch-demo-right').innerHTML=renderColumn('right')||'<div class="watch-demo-empty">Bu alanda görünür kart yok.</div>';
    $('#watch-preview-title').textContent=title;
    $('#watch-preview-kind').textContent=isTv?'DİZİ İZLE':'FİLM İZLE';
    $('#watch-preview-meta').textContent=year+' · '+(isTv?'Dizi':'Film')+' · '+runtime+' · '+genre;
    $('#watch-preview-score').innerHTML='★ '+escapeHtml(rating)+' <small>/ 10</small>';
    $('#watch-preview-frame').classList.toggle('is-mobile',watchDemoViewport==='mobile');
    $$('[data-demo-type]').forEach(button=>button.classList.toggle('active',button.dataset.demoType===watchDemoType));
    $$('[data-demo-device]').forEach(button=>button.classList.toggle('active',button.dataset.demoDevice===watchDemoViewport));
  }
  function renderWatchLayout(){
    const config=watchLayoutConfig();
    for(const side of ['left','right']){
      const root=$('#watch-'+side+'-list');
      root.innerHTML=config[side].map((id,index)=>{
        const item=watchCardDefinitions[id],target=side==='left'?'right':'left',isHidden=config.hidden.includes(id);
        const action=side==='left'?'Sağ alana taşı':'Sol alana taşı';
        return '<div class="watch-order-item '+(isHidden?'is-hidden':'')+'" data-card="'+id+'" draggable="true" title="Sürükleyerek sıralayabilir veya diğer sütuna taşıyabilirsin">'+
          '<span class="watch-order-number">'+(index+1)+'</span>'+
          '<div class="watch-order-copy"><b>'+escapeHtml(item.label)+'</b><small>'+escapeHtml(item.description)+(isHidden?' · Gizli':'')+'</small></div>'+
          '<div class="watch-order-actions">'+
          '<button type="button" class="watch-order-visibility" data-watch-toggle aria-label="'+(isHidden?'Kartı göster':'Kartı gizle')+'" title="'+(isHidden?'Kartı göster':'Kartı gizle')+'">'+(isHidden?'◉':'◌')+'</button>'+
          '<button type="button" class="watch-order-move" data-move-direction="-1" '+(index===0?'disabled':'')+' aria-label="Yukarı taşı" title="Yukarı taşı">↑</button>'+
          '<button type="button" class="watch-order-move" data-move-direction="1" '+(index===config[side].length-1?'disabled':'')+' aria-label="Aşağı taşı" title="Aşağı taşı">↓</button>'+
          '<button type="button" class="watch-order-transfer" data-target-side="'+target+'" aria-label="'+action+'" title="'+action+'">'+(side==='left'?'→':'←')+' <span>'+action+'</span></button>'+
          '<button type="button" class="watch-order-remove" data-watch-remove aria-label="Düzeninden kaldır" title="Düzeninden kaldır">×</button>'+
          '</div></div>';
      }).join('')||'<div class="watch-demo-empty">Bu sütunda kart bulunmuyor.</div>';
      root.classList.remove('is-drop-target');
    }
    $('#watch-available-list').innerHTML=config.removed.map(id=>{
      const item=watchCardDefinitions[id];
      return '<div class="watch-available-item"><div><b>'+escapeHtml(item.label)+'</b><small>'+escapeHtml(item.description)+'</small></div><div class="watch-available-actions"><button type="button" data-add-side="left" data-add-card="'+id+'">+ Sol</button><button type="button" data-add-side="right" data-add-card="'+id+'">+ Sağ</button></div></div>';
    }).join('')||'<div class="watch-demo-empty">Tüm kartlar şu anda düzende. İstersen kartları buraya kaldırabilirsin.</div>';
    renderWatchDemo(config);
    $('#watch-demo-left').setAttribute('aria-live','polite');
    $('#watch-demo-right').setAttribute('aria-live','polite');
  }
  function toggleWatchCard(id){
    const config=watchLayoutConfig();
    config.hidden=config.hidden.includes(id)?config.hidden.filter(x=>x!==id):[...config.hidden,id];
    state.data.watchPageConfig=config;renderWatchLayout();
  }
  function removeWatchCard(side,id){
    const config=watchLayoutConfig();
    config[side]=config[side].filter(x=>x!==id);config.hidden=config.hidden.filter(x=>x!==id);
    config.removed=[...new Set([...config.removed,id])];
    state.data.watchPageConfig=config;renderWatchLayout();
  }
  function addWatchCard(side,id){
    if(!['left','right'].includes(side)||!watchCardIds.includes(id))return;
    const config=watchLayoutConfig();if(!config.removed.includes(id))return;
    config.removed=config.removed.filter(x=>x!==id);config[side].push(id);
    state.data.watchPageConfig=config;renderWatchLayout();
  }
  function moveWatchCard(side,id,targetSide,index){
    if(!['left','right'].includes(side)||!['left','right'].includes(targetSide))return;
    const config=watchLayoutConfig(),source=config[side],from=source.indexOf(id);
    if(from<0)return;
    if(side===targetSide){
      source.splice(from,1);
      let destination=Number.isInteger(index)?index:source.length;
      if(from<destination)destination--;
      destination=Math.max(0,Math.min(destination,source.length));
      source.splice(destination,0,id);
    }else{
      if(config[targetSide].includes(id))return;
      source.splice(from,1);
      let destination=Number.isInteger(index)?index:config[targetSide].length;
      destination=Math.max(0,Math.min(destination,config[targetSide].length));
      config[targetSide].splice(destination,0,id);
    }
    state.data.watchPageConfig=config;
    renderWatchLayout();
  }
  async function saveWatchLayout(){
    const config=watchLayoutConfig();
    const ok=await persist({...state.data,watchPageConfig:config},'İzleme sayfası düzeni kaydedildi ve yayın kuyruğuna alındı.');
    if(ok)renderWatchLayout();
  }
  function heroRating(item){return Number(item.tmdbRating||item.rating)||0;}
  function heroVotes(item){return Number(item.tmdbVoteCount||item.voteCount||0);}
  function hasHeroVideoUrl(item){
    const urls=[item?.watchUrl,...Object.values(item?.episodeWatchUrls||{})];
    return urls.some(value=>{
      try{const url=new URL(String(value||'').trim());return (url.protocol==='http:'||url.protocol==='https:')&&!!url.hostname;}
      catch(_){return false;}
    });
  }
  function autoHeroItems(category,count){
    let items=state.catalog.filter(item=>posterOf(item));
    if(category==='video-url')items=items.filter(hasHeroVideoUrl);
    if(['user-watchlist','user-watched','user-favorites'].includes(category))return [];
    if(category==='new-arrivals')return items.slice().reverse().slice(0,Math.max(1,Number(count)||10));
    if(category==='movies')items=items.filter(item=>!isSeries(item));
    if(category==='series')items=items.filter(item=>isSeries(item));
    if(category==='random'){
      // Fisher-Yates: her manşet için katalogdan tekrarsız rastgele yapımlar seç.
      items=items.slice();
      for(let i=items.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [items[i],items[j]]=[items[j],items[i]];
      }
    }else if(category==='top-rated')items.sort((a,b)=>heroRating(b)-heroRating(a)||heroVotes(b)-heroVotes(a));
    else if(category==='popular')items.sort((a,b)=>{
      const score=x=>Number(x.popularity||x.tmdbPopularity)||heroVotes(x)*Math.max(heroRating(x),1);
      return score(b)-score(a)||heroRating(b)-heroRating(a);
    });
    else if(category==='most-watched')items.sort((a,b)=>heroVotes(b)-heroVotes(a)||heroRating(b)-heroRating(a));
    else if(category!=='random')items.sort((a,b)=>heroRating(b)-heroRating(a)||heroVotes(b)-heroVotes(a));
    return items.slice(0,Math.max(1,Number(count)||10));
  }
  function homepageLayoutConfig(){
    const config=homepageConfig();
    if(!config.layout||typeof config.layout!=='object')config.layout={};
    if(!Array.isArray(config.layout.order))config.layout.order=[...HOMEPAGE_LAYOUT_DEFAULTS];
    const known=new Set(HOMEPAGE_LAYOUT_DEFAULTS);
    config.layout.order=config.layout.order.filter(key=>known.has(key));
    HOMEPAGE_LAYOUT_DEFAULTS.forEach(key=>{if(!config.layout.order.includes(key))config.layout.order.push(key);});
    if(!config.layout.visibility||typeof config.layout.visibility!=='object')config.layout.visibility={};
    if(!config.layout.labels||typeof config.layout.labels!=='object')config.layout.labels={};
    return config.layout;
  }
  function renderHomepageLayout(){
    if(!state.data)return;
    const layout=homepageLayoutConfig();
    const list=$('#homepage-layout-list');
    if(!list)return;
    const visibleCount=HOMEPAGE_LAYOUT_DEFAULTS.filter(key=>key==='hero'||layout.visibility[key]!==false).length;
    $('#homepage-layout-count').textContent=visibleCount+' / '+HOMEPAGE_LAYOUT_DEFAULTS.length+' açık';
    const draftStatus=$('#homepage-layout-draft');if(draftStatus){draftStatus.dataset.state=state.homepageLayoutDirty?'draft':'saved';draftStatus.textContent=state.homepageLayoutDirty?'● Yayınlanmamış değişiklikler':'● Yayındaki düzen';}
    list.innerHTML=layout.order.map((key,index)=>{
      const item=HOMEPAGE_LAYOUT_ITEMS[key];
      if(!item)return '';
      const locked=!!item.locked;
      const active=locked||layout.visibility[key]!==false;
      const position=index+1;
      const label=layout.labels[key]||{};
      const title=label.title??item.title;
      const description=label.description??item.description;
      return '<div class="homepage-layout-row'+(active?'':' is-disabled')+'" data-layout-key="'+escapeHtml(key)+'">'+
        '<span class="homepage-layout-row-icon">'+item.icon+'</span>'+
        '<div class="homepage-layout-row-copy">'+
          (locked?'<b>'+escapeHtml(title)+'</b><small>'+escapeHtml(description)+'</small>':
          '<label class="homepage-layout-field"><span>Başlık</span><input type="text" maxlength="70" data-layout-label="title" value="'+escapeHtml(title)+'" aria-label="'+escapeHtml(item.title)+' bölüm başlığı"></label>'+
          '<label class="homepage-layout-field"><span>Alt metin</span><input type="text" maxlength="180" data-layout-label="description" value="'+escapeHtml(description)+'" aria-label="'+escapeHtml(item.title)+' bölüm alt metni"></label>')+
        '</div>'+
        '<span class="homepage-layout-state '+(locked?'is-locked':(active?'is-active':'is-hidden'))+'">'+(locked?'SABİT':(active?'AÇIK':'GİZLİ'))+'</span>'+
        '<div class="homepage-layout-actions">'+
          '<span class="homepage-layout-position">'+String(position).padStart(2,'0')+'</span>'+
          '<button type="button" data-layout-action="up" aria-label="'+escapeHtml(item.title)+' bölümünü yukarı taşı" '+(locked||index<=1?'disabled':'')+'>↑</button>'+
          '<button type="button" data-layout-action="down" aria-label="'+escapeHtml(item.title)+' bölümünü aşağı taşı" '+(locked||index===layout.order.length-1?'disabled':'')+'>↓</button>'+
          (locked?'<span class="homepage-layout-lock" title="Manşet bu ekrandan değiştirilemez">🔒</span>':'<button type="button" class="homepage-layout-toggle" data-layout-action="toggle" aria-label="'+(active?'Bölümü gizle':'Bölümü göster')+'">'+(active?'◉':'○')+'</button>')+
        '</div></div>';
    }).join('');
  }
  function moveHomepageSection(key,direction){
    const layout=homepageLayoutConfig();
    const index=layout.order.indexOf(key);
    const target=index+direction;
    if(index<1||target<1||target>=layout.order.length)return;
    [layout.order[index],layout.order[target]]=[layout.order[target],layout.order[index]];
    state.homepageLayoutDirty=true;
    renderHomepageLayout();
  }
  function toggleHomepageSection(key){
    const layout=homepageLayoutConfig();
    if(!HOMEPAGE_LAYOUT_ITEMS[key]||HOMEPAGE_LAYOUT_ITEMS[key].locked)return;
    layout.visibility[key]=layout.visibility[key]===false;
    state.homepageLayoutDirty=true;
    renderHomepageLayout();
  }
  async function saveHomepageLayout(){
    const config=homepageConfig();
    const layout=homepageLayoutConfig();
    const nextLayout={order:[...layout.order],visibility:{...layout.visibility},labels:{...layout.labels}};
    const ok=await persist({...state.data,homepageConfig:{...config,layout:nextLayout}},'Ana sayfa bölümleri ve sıralaması kaydedildi.');
    if(ok){state.homepageLayoutDirty=false;renderHomepageLayout();}
  }
  function renderPersonalizedSection(){
    if(!state.data)return;
    const config=homepageConfig();
    const section={eyebrow:'SANA ÖZEL',title:'İzleme Zevkine Göre',description:'İzleme alışkanlıklarından ilham alan, sana özel seçkiler',discoveryModes:{taste:true,surprise:true,series:true,gems:true},excludeWatched:true,excludeWatchlist:true,excludeFavorites:true,...(config.personalizedSection||{})};
    const layout=homepageLayoutConfig();
    $('#personalized-enabled').checked=layout.visibility.personalized!==false;
    $('#personalized-eyebrow').value=section.eyebrow;
    $('#personalized-title').value=section.title;
    $('#personalized-description').value=section.description;
    ['taste','surprise','series','gems'].forEach(mode=>{const input=$('#personalized-mode-'+mode);if(input)input.checked=section.discoveryModes?.[mode]!==false;});
    ['excludeWatched','excludeWatchlist','excludeFavorites'].forEach(key=>{const input=$('#personalized-'+key);if(input)input.checked=section[key]!==false;});
  }
  async function savePersonalizedSection(event){
    event.preventDefault();
    if(!canWrite())return;
    const config=homepageConfig();
    const layout=homepageLayoutConfig();
    const visibility={...layout.visibility};
    if($('#personalized-enabled').checked)delete visibility.personalized;
    else visibility.personalized=false;
    const existing={discoveryModes:{taste:true,surprise:true,series:true,gems:true},excludeWatched:true,excludeWatchlist:true,excludeFavorites:true,...(config.personalizedSection||{})};
    const discoveryModes={};
    ['taste','surprise','series','gems'].forEach(mode=>{discoveryModes[mode]=$('#personalized-mode-'+mode)?.checked!==false;});
    if(!Object.values(discoveryModes).some(Boolean))discoveryModes.taste=true;
    const personalizedSection={
      ...existing,
      eyebrow:$('#personalized-eyebrow').value.trim()||'SANA ÖZEL',
      title:$('#personalized-title').value.trim()||'İzleme Zevkine Göre',
      description:$('#personalized-description').value.trim(),
      discoveryModes,
      excludeWatched:$('#personalized-excludeWatched')?.checked!==false,
      excludeWatchlist:$('#personalized-excludeWatchlist')?.checked!==false,
      excludeFavorites:$('#personalized-excludeFavorites')?.checked!==false
    };
    const nextConfig={...config,personalizedSection,layout:{order:[...layout.order],visibility}};
    const ok=await persist({...state.data,homepageConfig:nextConfig},'İzleme Zevkine Göre ayarları kaydedildi.');
    if(ok)renderPersonalizedSection();
  }
  function refreshHeroSelection(device){
    const mode=$('#hero-'+device+'-mode').value;
    const category=$('#hero-'+device+'-category').value;
    if(mode!=='auto'||!['random','video-url'].includes(category))return;
    const limit=device==='desktop'
      ?Math.max(5,Math.min(15,Number($('#hero-desktop-count').value)||10))
      :Math.max(1,Math.min(12,Number($('#hero-mobile-count').value)||6));
    const list=$('#hero-'+device+'-slide-list');
    const currentIds=new Set($$('#hero-'+device+'-slide-list input:checked').map(input=>String(input.value)));
    const eligible=autoHeroItems(category,Math.max(state.catalog.length,limit));
    const fresh=eligible.filter(item=>!currentIds.has(String(item.id)));
    let next=fresh.slice(0,limit);
    if(next.length<limit)next=next.concat(eligible.filter(item=>currentIds.has(String(item.id))).slice(0,limit-next.length));
    const unchanged=next.length===currentIds.size&&next.every(item=>currentIds.has(String(item.id)));
    if(!next.length||unchanged){
      toast('Bu seçim için gösterilebilecek farklı yapım bulunamadı.','info');
      return;
    }
    state.heroRefreshDraft=state.heroRefreshDraft||{};
    state.heroRefreshDraft[device]=next.map(item=>({id:item.id,active:true}));
    state.heroDraft=state.heroDraft||{};
    state.heroDraft[device]=next.map(item=>({id:item.id,active:true}));
    renderHomepage();
    toast((device==='desktop'?'Masaüstü':'Mobil')+' manşet yapımları yenilendi.','success');
  }
  function heroCategoryIcon(value){
    const paths={
      'top-rated':'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
      popular:'<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
      'most-watched':'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
      random:'<path d="m16 3 5 5-5 5"/><path d="M4 7h3c5 0 5 10 10 10h4"/><path d="m16 16 5 1-5 4"/><path d="M4 17h3c1.6 0 2.7-1.4 3.7-3"/>',
      movies:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4m-4 6h4m10-6h4m-4 6h4"/>',
      series:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m10 9 5 3-5 3V9Z"/>',
      all:'<path d="M3 7h18v13H3zM3 7l3-4h4L7 7m3 0 3-4h4l-3 4m3 0 3-4h2l-3 4"/>',
      'user-watchlist':'<path d="M6 4h12v17l-6-4-6 4V4Z"/>',
      'user-watched':'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
      'user-favorites':'<path d="M20.8 8.8c0 5-8.8 10.2-8.8 10.2S3.2 13.8 3.2 8.8A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z"/>',
      'new-arrivals':'<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/>',
      'video-url':'<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4V8Z"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(paths[value]||paths.movies)+'</svg>';
  }
  function syncHeroCategorySelects(){
    ['desktop','mobile'].forEach(device=>{
      const select=$('#hero-'+device+'-category');
      const shell=select?.closest('.hero-category-select');
      if(!shell)return;
      const option=select.options[select.selectedIndex];
      const trigger=shell.querySelector('.hero-category-trigger');
      if(!option||!trigger)return;
      trigger.querySelector('.hero-category-current-icon').innerHTML=heroCategoryIcon(option.value);
      trigger.querySelector('.hero-category-value').textContent=option.textContent;
      shell.querySelectorAll('.hero-category-option').forEach(button=>{
        const active=button.dataset.value===select.value;
        button.classList.toggle('is-selected',active);
        button.setAttribute('aria-selected',active?'true':'false');
      });
    });
  }
  function enhanceHeroCategorySelects(){
    if(!$('#hero-category-dropdown-style')){
      const style=document.createElement('style');
      style.id='hero-category-dropdown-style';
      style.textContent='.hero-category-select{position:relative;width:100%;min-width:0}.hero-category-native{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;clip-path:inset(50%)!important}.hero-category-trigger{display:flex;align-items:center;gap:10px;width:100%;min-height:42px;padding:0 12px;border:1px solid #354354;border-radius:10px;background:linear-gradient(145deg,#182331,#111923);color:#edf2f7;text-align:left;font:600 12px Inter,sans-serif;cursor:pointer;transition:border-color .14s,background .14s}.hero-category-trigger:hover,.hero-category-select.is-open .hero-category-trigger{border-color:rgba(218,177,99,.72);background:#1b2735}.hero-category-current-icon{display:grid;place-items:center;width:19px;height:19px;color:#d7b46c;flex:0 0 19px}.hero-category-current-icon svg,.hero-category-option-icon svg,.hero-category-chevron{display:block;width:18px;height:18px}.hero-category-value{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hero-category-chevron{width:15px;height:15px;color:#8c9aaa;transition:transform .14s}.hero-category-select.is-open .hero-category-chevron{transform:rotate(180deg)}.hero-category-menu{position:absolute;z-index:80;top:calc(100% + 6px);left:0;right:0;max-height:min(320px,52vh);overflow-y:auto;padding:5px;border:1px solid #3a4859;border-radius:12px;background:#111a25;box-shadow:0 14px 34px rgba(0,0,0,.42)}.hero-category-menu[hidden]{display:none}.hero-category-option{display:flex;align-items:center;gap:10px;width:100%;min-height:38px;padding:7px 9px;border:0;border-radius:8px;background:transparent;color:#c7d1dc;text-align:left;font:500 11px Inter,sans-serif;cursor:pointer}.hero-category-option:hover,.hero-category-option:focus-visible{outline:0;background:#202d3c;color:#fff}.hero-category-option-icon{display:grid;place-items:center;width:19px;height:19px;color:#8795a5;flex:0 0 19px}.hero-category-option.is-selected{background:rgba(214,174,99,.12);color:#f2d28f}.hero-category-option.is-selected .hero-category-option-icon{color:#e2bd73}.hero-category-option-check{width:14px;height:14px;margin-left:auto;color:#e2bd73;opacity:0}.hero-category-option.is-selected .hero-category-option-check{opacity:1}.hero-category-select:focus-within .hero-category-trigger:focus-visible{outline:2px solid #d7b46c;outline-offset:2px}@media(prefers-reduced-motion:reduce){.hero-category-trigger,.hero-category-chevron{transition:none}}';
      document.head.appendChild(style);
    }
    ['desktop','mobile'].forEach(device=>{
      const select=$('#hero-'+device+'-category');
      if(!select||select.dataset.heroCategoryEnhanced==='true')return;
      if(!Array.from(select.options).some(option=>option.value==='video-url')){
        const option=document.createElement('option');option.value='video-url';option.textContent='Video Bağlantısı Olanlar';select.appendChild(option);
      }
      const shell=document.createElement('div');shell.className='hero-category-select';
      select.parentNode.insertBefore(shell,select);shell.appendChild(select);select.classList.add('hero-category-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
      const trigger=document.createElement('button');trigger.type='button';trigger.className='hero-category-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
      trigger.innerHTML='<span class="hero-category-current-icon"></span><span class="hero-category-value"></span><svg class="hero-category-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
      const menu=document.createElement('div');menu.className='hero-category-menu';menu.setAttribute('role','listbox');menu.hidden=true;
      menu.innerHTML=Array.from(select.options).map(option=>'<button type="button" class="hero-category-option" role="option" data-value="'+escapeHtml(option.value)+'" aria-selected="false"><span class="hero-category-option-icon">'+heroCategoryIcon(option.value)+'</span><span>'+escapeHtml(option.textContent)+'</span><svg class="hero-category-option-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button>').join('');
      shell.append(trigger,menu);
      trigger.addEventListener('click',()=>{
        const open=menu.hidden;menu.hidden=!open;shell.classList.toggle('is-open',open);trigger.setAttribute('aria-expanded',String(open));
        if(open)menu.querySelector('[aria-selected="true"]')?.focus();
      });
      menu.addEventListener('click',event=>{
        const choice=event.target.closest('.hero-category-option');if(!choice)return;
        select.value=choice.dataset.value;menu.hidden=true;shell.classList.remove('is-open');trigger.setAttribute('aria-expanded','false');
        select.dispatchEvent(new Event('change',{bubbles:true}));trigger.focus();
      });
      trigger.addEventListener('keydown',event=>{
        if(event.key==='ArrowDown'){event.preventDefault();if(menu.hidden)trigger.click();}
      });
      menu.addEventListener('keydown',event=>{
        const choices=Array.from(menu.querySelectorAll('.hero-category-option'));
        const index=choices.indexOf(document.activeElement);
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){
          event.preventDefault();choices[Math.max(0,Math.min(choices.length-1,index+(event.key==='ArrowDown'?1:-1))) ]?.focus();
        }else if(event.key==='Escape'){
          event.preventDefault();menu.hidden=true;shell.classList.remove('is-open');trigger.setAttribute('aria-expanded','false');trigger.focus();
        }
      });
      select.dataset.heroCategoryEnhanced='true';
    });
    if(!document.documentElement.dataset.heroCategoryOutsideBound){
      document.addEventListener('click',event=>{
        if(event.target.closest('.hero-category-select'))return;
        $$('.hero-category-select.is-open').forEach(shell=>{
          const menu=shell.querySelector('.hero-category-menu'),trigger=shell.querySelector('.hero-category-trigger');
          if(menu)menu.hidden=true;shell.classList.remove('is-open');trigger?.setAttribute('aria-expanded','false');
        });
      });
      document.documentElement.dataset.heroCategoryOutsideBound='true';
    }
    syncHeroCategorySelects();
  }
  function ensureHeroRefreshControl(device,mode,category){
    const hint=$('#hero-'+device+'-hint');
    if(!hint)return;
    let row=$('#hero-'+device+'-refresh-row');
    if(!row){
      if(!$('#hero-refresh-styles')){
        const style=document.createElement('style');
        style.id='hero-refresh-styles';
        style.textContent='.hero-refresh-row{display:flex;justify-content:flex-end;margin:8px 0 2px}.hero-refresh-row[hidden]{display:none}.hero-refresh-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:34px;padding:0 12px;border:1px solid rgba(214,168,75,.38);border-radius:9px;background:linear-gradient(135deg,rgba(214,168,75,.13),rgba(214,168,75,.05));color:#e5c477;font:800 10px Inter,sans-serif;letter-spacing:.09em;cursor:pointer;transition:background .18s,border-color .18s,transform .18s}.hero-refresh-button:hover{border-color:#d6a84b;background:rgba(214,168,75,.2);transform:translateY(-1px)}.hero-refresh-button:focus-visible{outline:2px solid #e5c477;outline-offset:3px}.hero-refresh-button .refresh-symbol{font-size:15px;line-height:1}';
        document.head.appendChild(style);
      }
      row=document.createElement('div');
      row.id='hero-'+device+'-refresh-row';
      row.className='hero-refresh-row';
      hint.insertAdjacentElement('beforebegin',row);
    }
    row.hidden=mode!=='auto'||!['random','video-url'].includes(category);
    row.innerHTML='<button class="hero-refresh-button" type="button" aria-label="'+(device==='desktop'?'Masaüstü':'Mobil')+' manşet yapımlarını yenile"><span class="refresh-symbol" aria-hidden="true">↻</span> YENİLE</button>';
    row.querySelector('button').addEventListener('click',()=>refreshHeroSelection(device));
  }
  function mobileDescriptionLimit(){
    const mode=$('#hero-description-length-mode').value||'220';
    if(mode==='custom')return Math.max(80,Math.min(5000,Number($('#hero-description-length-custom-value').value)||750));
    return Math.max(80,Math.min(5000,Number(mode)||220));
  }
  function renderHomepage(){
    enhanceHeroCategorySelects();
    const config=homepageConfig(),settings=config.settings;
    $('#hero-desktop-count').value=Math.max(5,Math.min(15,Number(settings.desktopCount)||10));
    $('#hero-mobile-count').value=settings.mobileCount??6;
    $('#hero-interval').value=settings.interval??6;
    const savedDescriptionLength=Math.max(80,Math.min(5000,Number(settings.descriptionLength)||220));
    const savedDescriptionMode=settings.descriptionLengthMode||([120,220,360,500].includes(savedDescriptionLength)?String(savedDescriptionLength):'custom');
    $('#hero-description-length-mode').value=savedDescriptionMode;
    $('#hero-description-length-custom-value').value=Math.max(80,Math.min(5000,Number(settings.descriptionLengthCustom)||(savedDescriptionMode==='custom'?savedDescriptionLength:750)));
    $('#hero-description-length-custom').hidden=savedDescriptionMode!=='custom';
    $('#hero-description-length-count').textContent='Uygulanacak sınır: '+$('#hero-description-length-custom-value').value+' karakter';
    $('#hero-desktop-description-mode').value=settings.desktopDescriptionMode||'medium';
    $('#hero-desktop-description-lines').value=Math.max(1,Math.min(8,Number(settings.desktopDescriptionLines)||3));
    $('#hero-desktop-description-custom').hidden=$('#hero-desktop-description-mode').value!=='custom';
    $('#hero-desktop-description-width').value=settings.desktopDescriptionWidthMode||'medium';
    $('#hero-desktop-description-width-px').value=Math.max(360,Math.min(1200,Number(settings.desktopDescriptionWidthPx)||720));
    $('#hero-desktop-description-width-custom').hidden=$('#hero-desktop-description-width').value!=='custom';
    $('#hero-autoplay').checked=settings.autoplay!==false;
    $('#hero-pause').checked=settings.pauseOnHover!==false;
    const draft=state.heroDraft||{};
    const devices=['desktop','mobile'];
    devices.forEach(device=>{
      const mode=config[device+'Mode']||'manual';
      const category=config[device+'Category']||'top-rated';
      $('#hero-'+device+'-mode').value=mode;
      $('#hero-'+device+'-category').value=category;
      const rawLimit=Number($('#hero-'+device+'-count').value)||(device==='desktop'?10:6);
      const limit=device==='desktop'?Math.max(5,Math.min(15,rawLimit)):Math.max(1,Math.min(12,rawLimit));
      $('#hero-'+device+'-count').value=limit;
      const saved=Array.isArray(draft[device])?draft[device]:(Array.isArray(config[device+'HeroSlides'])?config[device+'HeroSlides']:config.heroSlides);
      const personalCategory=mode==='auto'&&['user-watchlist','user-watched','user-favorites'].includes(category);
      let pool=personalCategory?[]:state.catalog;
      if(mode==='auto'&&category==='random'){
        const source=Array.isArray(draft[device])?draft[device]:saved;
        const savedIds=source.map(x=>String(typeof x==='object'?x.id:x));
        const savedRandom=savedIds.length===limit?savedIds.map(id=>state.catalog.find(item=>String(item.id)===id)).filter(item=>item&&posterOf(item)):[];
        if(savedRandom.length===limit)pool=savedRandom;
        else{
          pool=autoHeroItems('random',limit);
          state.heroDraft=state.heroDraft||{};
          state.heroDraft[device]=pool.map(item=>({id:item.id,active:true}));
        }
      }else if(mode==='auto'){
        const refreshed=Array.isArray(state.heroRefreshDraft?.[device])?state.heroRefreshDraft[device].map(entry=>state.catalog.find(item=>String(item.id)===String(typeof entry==='object'?entry.id:entry))).filter(item=>item&&posterOf(item)):[];
        pool=refreshed.length?refreshed:autoHeroItems(category,limit);
      }
      const selectedIds=(mode==='auto'?pool.map(x=>String(x.id)):saved.map(x=>String(typeof x==='object'?x.id:x))).slice(0,limit);
      const selected=new Set(selectedIds);
      const list=$('#hero-'+device+'-slide-list');
      list.innerHTML=pool.map(item=>{
        const checked=selected.has(String(item.id));
        return '<label class="hero-pick" data-search="'+escapeHtml((titleOf(item)+' '+yearOf(item)).toLocaleLowerCase('tr-TR'))+'"><input type="checkbox" value="'+escapeHtml(item.id)+'" '+(checked?'checked ':'')+(mode==='auto'?'disabled ':'')+'><img src="'+escapeHtml(posterOf(item))+'" alt=""><span><b>'+escapeHtml(titleOf(item))+'</b><small>'+(isSeries(item)?'Dizi':'Film')+' · '+escapeHtml(yearOf(item))+' · ★ '+escapeHtml(item.tmdbRating||item.rating||'—')+'</small></span></label>';
      }).join('');
      const count=()=>$('#hero-'+device+'-selected-count').textContent=$$('#hero-'+device+'-slide-list input:checked').length+' yapım seçildi';
      const preview=()=>{
        const firstId=$$('#hero-'+device+'-slide-list input:checked')[0]?.value;
        const item=state.catalog.find(x=>String(x.id)===String(firstId));
        const host=$('#hero-'+device+'-preview');
        if(personalCategory){
          const label={'user-watchlist':'ziyaretçinin izleme listesi','user-watched':'izledikleri','user-favorites':'favorileri'}[category];
          host.innerHTML='<div class="hero-preview-empty"><b>Kişiye özel canlı vitrin</b><br>Bu alan her ziyaretçide kendi '+label+' kayıtlarından oluşur.<br><small>Yönetici önizlemesinde kişisel kayıtlar görüntülenmez.</small></div>';
          return;
        }
        if(!item){host.innerHTML='<div class="hero-preview-empty">Henüz manşet yapımı seçilmedi.</div>';return;}
        const max=mobileDescriptionLimit();
        const desc=String(item.desc||item.tmdbOverview||'');
        const excerpt=desc.length>max?desc.slice(0,max).trimEnd()+'…':desc;
        host.innerHTML='<div class="hero-preview-art" style="background-image:linear-gradient(90deg,rgba(5,7,12,.96),rgba(5,7,12,.62) 58%,rgba(5,7,12,.12)),url(\''+escapeHtml(item.backdrop||posterOf(item))+'\')"><div class="hero-preview-copy"><span class="hero-preview-kicker">● ÖNE ÇIKAN YAPIM</span><h3>'+escapeHtml(titleOf(item))+'</h3><div class="hero-preview-meta">★ '+escapeHtml(item.tmdbRating||item.rating||'—')+'　·　'+escapeHtml(yearOf(item))+'　·　'+(isSeries(item)?'DİZİ':'FİLM')+'</div><p>'+escapeHtml(excerpt)+'</p><small class="hero-preview-character-count">Metin: '+desc.length+' · Gösterilen: '+Math.min(desc.length,max)+' / '+max+' karakter</small></div></div>';
      };
      count();preview();
      $$('#hero-'+device+'-slide-list input').forEach(input=>input.addEventListener('change',()=>{
        if(device==='desktop'&&input.checked){
          const checked=$$('#hero-desktop-slide-list input:checked');
          const max=Number($('#hero-desktop-count').value)||10;
          if(checked.length>max){input.checked=false;toast('Masaüstü manşetinde en fazla '+max+' yapım seçebilirsin.');}
        }
        count();preview();
      }));
      $('#hero-'+device+'-search').value='';
      $('#hero-'+device+'-search').oninput=event=>{
        const q=event.target.value.trim().toLocaleLowerCase('tr-TR');
        $$('#hero-'+device+'-slide-list .hero-pick').forEach(row=>{row.hidden=!!q&&!row.dataset.search.includes(q);});
      };
      $('#hero-'+device+'-hint').textContent=mode==='auto'
        ?(personalCategory
          ?'Canlı sitede her ziyaretçinin yalnızca kendi '+({'user-watchlist':'izleme listesi','user-watched':'izledikleri','user-favorites':'favorileri'}[category])+' gösterilir. Herkes için aynı katalog listesini kullanmaz.'
          :(category==='new-arrivals'?'Kataloğa en son eklenen yapımlar, en yeni kayıt üstte olacak şekilde getirilir.':category==='random'?'Katalogdan belirlenen sayı kadar tekrarsız rastgele yapım seçildi.':'Seçilen ölçüte göre katalogdan otomatik '+pool.length+' yapım getirildi.'))
        :'Katalogda ara; kutucuğu işaretleyerek manşete ekle, işareti kaldırarak çıkar.';
      ensureHeroRefreshControl(device,mode,category);
    });
    syncHeroCategorySelects();
  }
  async function saveHomepage(event){
    event.preventDefault();if(!canWrite())return;
    const previous=homepageConfig();
    const legacyById=new Map(previous.heroSlides.map(x=>[String(x.id),x]));
    const buildSlides=device=>{
      const listId='#hero-'+device+'-slide-list';
      const oldEntries=Array.isArray(previous[device+'HeroSlides'])?previous[device+'HeroSlides']:previous.heroSlides;
      const oldMap=new Map(oldEntries.map(x=>[String(x.id),x]));
      const selectedInputs=$$(listId+' input:checked');
      const max=device==='desktop'?Math.max(5,Math.min(15,Number($('#hero-desktop-count').value)||10)):12;
      return selectedInputs.slice(0,max).map(input=>{
        const id=input.value,old=oldMap.get(String(id))||legacyById.get(String(id))||{};
        return {...old,id,active:true,headline:old.headline||'',description:old.description||''};
      });
    };
    const desktopHeroSlides=buildSlides('desktop'),mobileHeroSlides=buildSlides('mobile');
    const config={...previous,version:4,desktopMode:$('#hero-desktop-mode').value,desktopCategory:$('#hero-desktop-category').value,
      mobileMode:$('#hero-mobile-mode').value,mobileCategory:$('#hero-mobile-category').value,
      settings:{...previous.settings,desktopCount:Math.max(5,Math.min(15,Number($('#hero-desktop-count').value)||10)),mobileCount:Number($('#hero-mobile-count').value)||6,
        interval:Number($('#hero-interval').value)||6,descriptionLength:mobileDescriptionLimit(),descriptionLengthMode:$('#hero-description-length-mode').value||'220',descriptionLengthCustom:Math.max(80,Math.min(5000,Number($('#hero-description-length-custom-value').value)||750)),
        desktopDescriptionMode:$('#hero-desktop-description-mode').value||'medium',
        desktopDescriptionLines:Math.max(1,Math.min(8,Number($('#hero-desktop-description-lines').value)||3)),
        desktopDescriptionWidthMode:$('#hero-desktop-description-width').value||'medium',
        desktopDescriptionWidthPx:Math.max(360,Math.min(1200,Number($('#hero-desktop-description-width-px').value)||720)),
        autoplay:$('#hero-autoplay').checked,pauseOnHover:$('#hero-pause').checked},
      desktopHeroSlides,mobileHeroSlides,heroSlides:desktopHeroSlides};
    const ok=await persist({...state.data,homepageConfig:config},'Manşet ayarları kaydedildi.');
    if(ok){state.heroDraft=null;state.heroRefreshDraft=null;renderHomepage();}
  }
  const BACKUP_STORAGE_PREFIXES=['cine_','perde_'];
  const PERSONAL_BACKUP_SITE_ORIGIN='https://megamrtklc.github.io';
  const PERSONAL_BACKUP_BRIDGE_URL='https://megamrtklc.github.io/mrtklc/backup-bridge.html';
  let selectedBackup=null;
  let remotePersonalStorage=null;
  function collectBrowserStorage(storage){
    const values={};
    try{for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key&&BACKUP_STORAGE_PREFIXES.some(prefix=>key.startsWith(prefix)))values[key]=storage.getItem(key);}}catch(error){console.warn('Tarayıcı kayıtları okunamadı.',error);}
    return values;
  }
  function backupStorageCount(data){
    return Object.keys(data.localStorage||{}).length+Object.keys(data.sessionStorage||{}).length;
  }
  function requestMainSiteBackup(action,payload={}){
    const popup=window.open(PERSONAL_BACKUP_BRIDGE_URL,'perdePersonalBackup','popup=yes,width=440,height=220,resizable=yes');
    if(!popup) return Promise.reject(new Error('Yedek aktarım penceresi engellendi. Tarayıcıda bu site için açılır pencerelere izin verip tekrar dene.'));
    return new Promise((resolve,reject)=>{
      const requestId='perde-backup-'+Date.now()+'-'+Math.random().toString(36).slice(2);
      const requestType='PERDE_BACKUP_'+action+'_REQUEST';
      const responseType='PERDE_BACKUP_'+action+'_RESPONSE';
      let settled=false,requestSent=false;
      const cleanup=()=>{window.removeEventListener('message',onMessage);clearTimeout(timeout);};
      const finish=(error,value)=>{if(settled)return;settled=true;cleanup();try{if(!popup.closed)popup.close();}catch(_){}error?reject(error):resolve(value);};
      const onMessage=event=>{
        if(event.origin!==PERSONAL_BACKUP_SITE_ORIGIN||event.source!==popup)return;
        if(event.data?.type==='PERDE_BACKUP_BRIDGE_READY'&&!requestSent){
          requestSent=true;
          popup.postMessage({type:requestType,requestId,...payload},PERSONAL_BACKUP_SITE_ORIGIN);
          return;
        }
        if(event.data?.type!==responseType||event.data?.requestId!==requestId)return;
        if(event.data.error){finish(new Error(String(event.data.error)));return;}
        if(action==='EXPORT'){
          const data=event.data.browserData;
          if(!data||typeof data.localStorage!=='object'||typeof data.sessionStorage!=='object'){finish(new Error('Ana siteden geçerli kişisel kayıt yanıtı alınamadı.'));return;}
          finish(null,data);
        }else{
          const previous=event.data.previousBrowserData;
          if(event.data.ok!==true||!previous||typeof previous.localStorage!=='object'||typeof previous.sessionStorage!=='object'){finish(new Error('Ana site kişisel kayıtları geri yükleyemedi.'));return;}
          finish(null,previous);
        }
      };
      const timeout=setTimeout(()=>finish(new Error('Ana siteyle bağlantı kurulamadı. Açılır pencerenin yüklenmesine izin verip tekrar dene.')),15000);
      window.addEventListener('message',onMessage);
    });
  }
  function readMainSitePersonalStorage(){
    return requestMainSiteBackup('EXPORT');
  }
  function restoreMainSitePersonalStorage(browserData){
    return requestMainSiteBackup('RESTORE',{browserData});
  }
  function setSystemStatus(id,detailId,status,detail,type='neutral'){
    const value=$('#'+id),copy=$('#'+detailId);
    if(value){value.textContent=status;value.dataset.state=type;}
    if(copy)copy.textContent=detail;
  }
  async function refreshSystemDiagnostics(){
    const button=$('#system-refresh'),note=$('#system-check-note');
    if(button){button.disabled=true;button.textContent='↻  Kontrol ediliyor…';}
    if(note)note.textContent='Bağlantılar ve katalog verisi kontrol ediliyor…';
    setSystemStatus('system-api-status','system-api-detail','Kontrol ediliyor','/api/catalog yanıtı bekleniyor.');
    setSystemStatus('system-auth-status','system-auth-detail','Kontrol ediliyor','/api/session yanıtı bekleniyor.');
    try{
      const response=await fetchWithTimeout('/api/catalog',{cache:'no-store',credentials:'same-origin'});
      if(!response.ok)throw new Error('Katalog servisi HTTP '+response.status);
      const payload=await response.json();
      const catalog=Array.isArray(payload?.data?.catalog)?payload.data.catalog:[];
      const valid=catalog.filter(item=>item&&typeof item==='object'&&!Array.isArray(item));
      const ids=valid.map(item=>String(item.id??item.tmdbId??'').trim()).filter(Boolean);
      const duplicates=ids.filter((id,index)=>ids.indexOf(id)!==index);
      const duplicateCount=new Set(duplicates).size;
      setSystemStatus('system-api-status','system-api-detail','Bağlandı','Katalog servisi yanıt verdi.','good');
      $('#system-catalog-count').textContent=catalog.length+' yapım';
      $('#system-valid-count').textContent=valid.length+' kayıt';
      $('#system-duplicate-count').textContent=duplicateCount+' kimlik';
      $('#system-data-version').textContent=String(payload.data.version??'Belirtilmemiş');
      $('#system-json-status').textContent=valid.length===catalog.length&&duplicateCount===0?'Kontrol temiz':'İnceleme gerekli';
      $('#system-json-status').className=valid.length===catalog.length&&duplicateCount===0?'state-ready':'state-warning';
      setSystemStatus('system-write-status','system-write-detail',payload.writable===false?'Salt okunur':'Yazma erişimi mevcut',payload.readOnlyReason|| (payload.writable===false?'Sunucu yazma izni vermiyor.':'Katalog API yazılabilir olarak bildirildi.'),payload.writable===false?'warn':'good');
    }catch(error){
      setSystemStatus('system-api-status','system-api-detail','Bağlantı yok',error.message,'bad');
      setSystemStatus('system-write-status','system-write-detail','Doğrulanamadı','Katalog servisi yanıt vermedi.','warn');
      $('#system-json-status').textContent='Kontrol edilemedi';
      $('#system-json-status').className='state-warning';
    }
    try{
      const response=await fetchWithTimeout('/api/session',{cache:'no-store',credentials:'same-origin'},10000);
      if(!response.ok)throw new Error('Oturum doğrulaması HTTP '+response.status);
      const session=await response.json();
      setSystemStatus('system-auth-status','system-auth-detail','Aktif',session.email||'Yetkili yönetici oturumu doğrulandı.','good');
    }catch(error){
      setSystemStatus('system-auth-status','system-auth-detail','Doğrulanamadı',error.message,'warn');
    }
    const checked=new Date().toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'});
    $('#system-last-check').textContent=checked;
    if(note)note.textContent='Kontrol tamamlandı: '+checked+'. Bu işlem katalog verilerini değiştirmedi.';
    if(button){button.disabled=false;button.textContent='↻  Kontrolleri yenile';}
  }
  function refreshBackupSummary(){
    const catalogCount=Array.isArray(state.data?.catalog)?state.data.catalog.length:0;
    $('#backup-catalog-count').textContent=catalogCount+' yapım';
    const count=$('#backup-storage-count'),diagnostic=$('#backup-origin-status');
    const total=remotePersonalStorage?backupStorageCount(remotePersonalStorage):null;
    if(count)count.textContent=total===null?'Kontrol edilmedi':total+' kayıt';
    if(diagnostic){
      diagnostic.textContent=total===null
        ? 'Kişisel kayıt sayısı, indirme sırasında ana Perde sitesinden güvenli şekilde okunur.'
        : total
          ? 'Kaynak: '+PERSONAL_BACKUP_SITE_ORIGIN+' · Ana sitede '+total+' Perde kaydı bulundu.'
          : 'Ana site kontrol edildi; Perde kişisel kaydı bulunamadı.';
      diagnostic.classList.toggle('state-warning',total===0);
    }
  }
  function downloadBackupJson(payload,filename,successMessage){
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download=filename;
    document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast(successMessage);
  }
  function downloadSiteBackup(){
    if(!state.data||!Array.isArray(state.data.catalog)){toast('Katalog yüklenmeden yedek oluşturulamaz.');return;}
    const date=new Date().toISOString().slice(0,10);
    downloadBackupJson({format:'perde-site-backup',version:1,exportedAt:new Date().toISOString(),siteData:state.data},'perde-yapimlar-ve-site-verileri-'+date+'.json','Yapımlar ve site verileri yedeklendi.');
  }
  async function downloadPersonalBackup(){
    const button=$('#download-personal-backup');
    if(button)button.disabled=true;
    try{
      const browserData=await readMainSitePersonalStorage();
      remotePersonalStorage=browserData;
      const count=backupStorageCount(browserData);
      const status=$('#backup-storage-count'),diagnostic=$('#backup-origin-status');
      if(status)status.textContent=count+' kayıt';
      if(!count){
        if(diagnostic){diagnostic.textContent='Ana siteye bağlanıldı ancak kişisel kayıt bulunamadı. Ana sitede İzleme Listem, Favorilerim veya izleme ilerlemesi kayıtlı mı kontrol et.';diagnostic.classList.add('state-warning');}
        toast('Ana sitede kişisel kayıt bulunamadı. Eksik yedek oluşturmamak için indirme durduruldu.');
        return;
      }
      const date=new Date().toISOString().slice(0,10);
      downloadBackupJson({format:'perde-personal-backup',version:1,exportedAt:new Date().toISOString(),origin:PERSONAL_BACKUP_SITE_ORIGIN,browserData},'perde-kisisel-tarayici-verileri-'+date+'.json','Ana sitedeki '+count+' kişisel kayıt yedeklendi.');
    }catch(error){
      toast(error.message||'Ana site kişisel kayıtları okunamadı.');
    }finally{if(button)button.disabled=false;}
  }
  function inspectBackupFile(file){
    selectedBackup=null;
    const button=$('#restore-full-backup'),summary=$('#restore-backup-summary');
    button.disabled=true;
    if(!file){summary.innerHTML='<span>Dosya durumu</span><b>Henüz dosya seçilmedi</b>';return;}
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const data=JSON.parse(String(reader.result||''));
        const isSite=data.format==='perde-site-backup'&&data.siteData&&Array.isArray(data.siteData.catalog);
        const isPersonal=data.format==='perde-personal-backup'&&data.browserData&&typeof data.browserData.localStorage==='object'&&typeof data.browserData.sessionStorage==='object';
        const isLegacy=data.format==='perde-full-backup'&&data.siteData&&Array.isArray(data.siteData.catalog)&&data.browserData&&typeof data.browserData.localStorage==='object';
        if(data.version!==1||(!isSite&&!isPersonal&&!isLegacy))throw new Error('Bu dosya geçerli bir Perde yedek dosyası değil.');
        selectedBackup=data;
        const count=data.siteData?.catalog?.length||0;
        const personal=data.browserData?backupStorageCount(data.browserData):0;
        const date=data.exportedAt?new Date(data.exportedAt).toLocaleString('tr-TR'):'Tarih bilgisi yok';
        const kind=isSite?'Yapım ve site verileri':isPersonal?'Kişisel tarayıcı verileri':'Eski tip tam yedek';
        summary.innerHTML='<span>Dosya doğrulandı</span><b>'+escapeHtml(kind)+' · '+(isSite?count+' yapım':isPersonal?personal+' kişisel kayıt':count+' yapım · '+personal+' kişisel kayıt')+' · '+escapeHtml(date)+'</b>';
        button.disabled=isSite&&!state.apiEnabled||isLegacy&&!state.apiEnabled;
        if((isSite||isLegacy)&&!state.apiEnabled)summary.innerHTML+='<small class="helper-text">Sunucu yazma bağlantısı hazır değil; bu yedek şu an geri yüklenemiyor.</small>';
      }catch(error){summary.innerHTML='<span>Dosya durumu</span><b class="state-warning">'+escapeHtml(error.message)+'</b>';selectedBackup=null;}
    };
    reader.onerror=()=>{summary.innerHTML='<span>Dosya durumu</span><b class="state-warning">Dosya okunamadı.</b>';};
    reader.readAsText(file);
  }
  async function restoreFullBackup(){
    const data=selectedBackup;
    if(!data){toast('Önce geçerli bir yedek dosyası seçmelisin.');return;}
    const isSite=data.format==='perde-site-backup';
    const isPersonal=data.format==='perde-personal-backup';
    const isLegacy=data.format==='perde-full-backup';
    if((isSite||isLegacy)&&!state.apiEnabled){toast('Site verilerini geri yüklemek için sunucu bağlantısı gerekli.');return;}
    const catalogCount=data.siteData?.catalog?.length||0,personalCount=data.browserData?backupStorageCount(data.browserData):0;
    const description=isSite?catalogCount+' yapım ve site ayarı':isPersonal?personalCount+' kişisel kayıt':catalogCount+' yapım ve '+personalCount+' kişisel kayıt';
    if(!confirm(description+' geri yüklenecek. İlgili mevcut verilerin üzerine yazılacak. Devam edilsin mi?'))return;
    let previousBrowserData=null;
    try{
      if(data.browserData)previousBrowserData=await restoreMainSitePersonalStorage(data.browserData);
      if(data.siteData){
        const ok=await persist(data.siteData,'Site verileri başarıyla geri yüklendi. Sayfa yenileniyor…');
        if(!ok)throw new Error('Site verileri sunucuya kaydedilemedi; ana sitenin kişisel kayıtları eski hâline getiriliyor.');
      }else{
        toast('Kişisel kayıtlar ana Perde sitesine geri yüklendi. Açık ana site sekmesini yenile.');
      }
      setTimeout(()=>window.location.reload(),900);
    }catch(error){
      if(previousBrowserData){
        try{await restoreMainSitePersonalStorage(previousBrowserData);}
        catch(rollbackError){console.error('Ana site kişisel kayıtları geri alınamadı:',rollbackError);}
      }
      toast(error.message||'Geri yükleme tamamlanamadı.','error');
    }
  }
  function initBackupTools(){
    $('#download-site-backup')?.addEventListener('click',downloadSiteBackup);
    $('#download-personal-backup')?.addEventListener('click',downloadPersonalBackup);
    $('#restore-backup-file')?.addEventListener('change',event=>inspectBackupFile(event.target.files?.[0]));
    $('#restore-full-backup')?.addEventListener('click',restoreFullBackup);
    refreshBackupSummary();
  }
  async function init(){
    applyAdminPreferences();
    loadPreferenceDraft();
    applyAdminTheme();
    const formattedDate=new Intl.DateTimeFormat('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());$('#today-date').textContent=formattedDate;
    $('#last-check').textContent=new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
    try{
      const apiResponse=await fetchWithTimeout('/api/catalog',{cache:'no-store',credentials:'same-origin'});
      if(!apiResponse.ok){const p=await apiResponse.json().catch(()=>({}));throw new Error(p.error||'Yönetim API hatası: '+apiResponse.status);}
      const payload=await apiResponse.json();state.data=payload.data;state.sha=payload.sha||null;state.apiEnabled=!!state.sha&&payload.writable!==false;
      if(!Array.isArray(state.data?.catalog))throw new Error('Katalog listesi bulunamadı.');
      state.catalog=state.data.catalog.filter(x=>x&&typeof x==='object');
      refreshBackupSummary();
      if(selectedBackup)$('#restore-full-backup').disabled=!state.apiEnabled;
      renderWelcomePosters();
      $('.environment').innerHTML='<i></i> KORUMALI YÖNETİM';
      // Render the catalog immediately after the data API succeeds. A secondary
      // session/profile endpoint must never prevent the catalog from appearing.
      $('#health-catalog').textContent='Bağlandı';$('#health-json').textContent='Geçerli';
      const versionLabel=$('#system-data-version');if(versionLabel)versionLabel.textContent=String(state.data.version??'Belirtilmemiş');
      $('#add-content').disabled=false;$('#catalog-add').disabled=false;$('#collection-add').disabled=false;
      const writeHint=state.apiEnabled?'Yeni yapım ekle':'Form açılır; kaydetmek için GitHub yazma bağlantısı gerekir.';
      $('#add-content').title=writeHint;$('#catalog-add').title=writeHint;$('#collection-add').title=state.apiEnabled?'Yeni koleksiyon ekle':'Kayıt için GitHub yazma bağlantısı gerekir.';
      updateMetrics();refreshYearFilter();renderRecent();renderCatalog();renderCollections();renderAnalytics();renderHomepage();renderHomepageLayout();renderOverviewInsights();renderAdminProfile();renderWatchLayout();renderHeaderFooter();
      $('#last-check').textContent=new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
      $('.notice b').textContent='Katalog verileri yüklendi';
      $('.notice p').textContent=payload.readOnlyReason||'Katalog bağlantısı aktif. Yönetim işlemleri güvenli API üzerinden yürütülüyor.';
      $('.notice-tag').textContent=state.apiEnabled?'CONNECTED':'READ ONLY';
      const sideStatus=$('.sidebar-status small');if(sideStatus)sideStatus.textContent='Katalog yüklendi';
      const sidePulse=$('.status-pulse');if(sidePulse)sidePulse.style.background='var(--green)';
      $('#health-api').textContent='Aktif';
      // Session status is supplemental: report a problem without hiding valid catalog data.
      try{
        const sessionResponse=await fetchWithTimeout('/api/session',{cache:'no-store',credentials:'same-origin'},10000);
        if(!sessionResponse.ok)throw new Error('Oturum durumu doğrulanamadı ('+sessionResponse.status+').');
        const session=await sessionResponse.json();
        $('#health-auth').textContent='Aktif';
        if(!payload.readOnlyReason)$('.notice p').textContent='Yönetici oturumu etkin: '+(session.email||'Yetkili hesap')+'. Değişiklikler güvenli API üzerinden GitHub kataloğuna kaydedilir.';
      }catch(sessionError){
        $('#health-auth').textContent='Kontrol edilemedi';
        console.warn('Oturum durumu kontrol edilemedi; katalog görünür durumda bırakıldı:',sessionError);
      }
      loadProfilePhoto();
      loadQualityHistory();
    }catch(error){
      showStartupError(error.message||'Katalog yüklenemedi.');
      console.error('Admin yükleme hatası:',error);
      $('#health-catalog').textContent='Bağlantı yok';$('#health-json').textContent='Okunamadı';$('#metric-total').textContent='—';
      $('#recent-list').innerHTML='<div class="loading-line">'+escapeHtml(error.message||'Katalog yüklenemedi.')+'</div>';
      $('#catalog-rows').innerHTML='<tr><td colspan="6" class="empty-cell">Katalog yüklenemedi.</td></tr>';
      toast(error.message||'Katalog yüklenemedi.','error');
    }
  }
  // Tema seçici kaldırıldı: yeni yönetim arayüzü tek ve tutarlı bir tasarım sistemidir.
  $$('.nav-link').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.view)));
  $$('[data-go]').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.go)));
  function setMobileSidebar(open){const sidebar=$('#sidebar'),toggle=$('#mobile-menu'),backdrop=$('#sidebar-backdrop');sidebar.classList.toggle('open',!!open);backdrop?.classList.toggle('visible',!!open);toggle?.setAttribute('aria-expanded',String(!!open));toggle?.setAttribute('aria-label',open?'Menüyü kapat':'Menüyü aç');document.body.classList.toggle('sidebar-menu-open',!!open);}
  $('#mobile-menu').addEventListener('click',()=>setMobileSidebar(!$('#sidebar').classList.contains('open')));
  $('#sidebar-close')?.addEventListener('click',()=>setMobileSidebar(false));
  $('#sidebar-backdrop')?.addEventListener('click',()=>setMobileSidebar(false));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('#sidebar').classList.contains('open'))setMobileSidebar(false);});
  const shell=$('.app-shell');
  const sidebarToggle=$('#sidebar-toggle');
  const setSidebarCollapsed=collapsed=>{
    const desktop=window.innerWidth>760;
    shell.classList.toggle('sidebar-collapsed',!!collapsed&&desktop);
    if(sidebarToggle){
      const label=collapsed?'Menüyü genişlet':'Menüyü daralt';
      sidebarToggle.title=label;sidebarToggle.setAttribute('aria-label',label);
      sidebarToggle.setAttribute('aria-expanded',String(!collapsed));
    }
    try{localStorage.setItem('cv-admin-sidebar-collapsed',collapsed&&desktop?'1':'0');}catch(error){}
  };
  setSidebarCollapsed(window.innerWidth>760&&localStorage.getItem('cv-admin-sidebar-collapsed')==='1');
  sidebarToggle?.addEventListener('click',()=>{
    const collapsed=!shell.classList.contains('sidebar-collapsed');
    setSidebarCollapsed(collapsed);
  });
  window.addEventListener('resize',()=>{
    if(window.innerWidth<=760){shell.classList.remove('sidebar-collapsed');}
    else if(localStorage.getItem('cv-admin-sidebar-collapsed')==='1'){shell.classList.add('sidebar-collapsed');}
  });
  $('#profile-photo-button').addEventListener('click',()=>$('#profile-dialog').showModal());
  $('#profile-change-button').addEventListener('click',()=>$('#profile-dialog').showModal());
  $('#admin-profile-form').addEventListener('submit',saveAdminProfile);
  $('#profile-form').addEventListener('submit',saveProfilePhoto);
  $('#profile-close').addEventListener('click',()=>$('#profile-dialog').close());
  $('#profile-cancel').addEventListener('click',()=>$('#profile-dialog').close());
  $('#profile-file').addEventListener('change',()=>{
    const file=$('#profile-file').files[0];if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>716800){toast('JPG, PNG veya WebP seç; en fazla 700 KB.');$('#profile-file').value='';return;}
    const reader=new FileReader();reader.onload=()=>{const url=String(reader.result);$('#profile-dialog-preview').src=url;$('#profile-dialog-preview').hidden=false;$('#profile-dialog-initials').hidden=true;};
    reader.readAsDataURL(file);$('#profile-upload-status').textContent=file.name;
  });
  $('#logout-button')?.addEventListener('click',async()=>{try{await fetch('/api/logout',{method:'POST',credentials:'same-origin'});}finally{window.location.reload();}});
  $('#catalog-search').addEventListener('input',()=>{state.page=1;renderCatalog();});
  $('#type-filter').addEventListener('change',()=>{state.page=1;renderCatalog();});
  $('#year-filter').addEventListener('change',()=>{state.page=1;renderCatalog();});
  $('#catalog-sort').addEventListener('change',()=>{state.page=1;renderCatalog();});
  $('#missing-trailer-search').addEventListener('input',()=>{state.missingTrailerPage=1;renderMissingTrailers();});
  $('#quality-search').addEventListener('input',()=>{state.qualityPage=1;renderQualityAudit();});
  $('#quality-filter').addEventListener('change',()=>{state.qualityPage=1;renderQualityAudit();});
  $('#quality-refresh').addEventListener('click',()=>{renderQualityAudit();renderQualityHistory();});
  $('#quality-prev')?.addEventListener('click',()=>{state.qualityPage=Math.max(1,state.qualityPage-1);renderQualityAudit();});
  $('#quality-next')?.addEventListener('click',()=>{state.qualityPage++;renderQualityAudit();});
  $('#quality-snapshot-save')?.addEventListener('click',saveQualitySnapshot);
  $('#missing-trailer-prev').addEventListener('click',()=>{state.missingTrailerPage=Math.max(1,state.missingTrailerPage-1);renderMissingTrailers();});
  $('#missing-trailer-next').addEventListener('click',()=>{state.missingTrailerPage++;renderMissingTrailers();});
  $('#prev-page').addEventListener('click',()=>{state.page=Math.max(1,state.page-1);renderCatalog();});
  $('#next-page').addEventListener('click',()=>{state.page++;renderCatalog();});
  // Yeni yapım düğmeleri üstteki delege edilmiş olay dinleyicisiyle yönetilir.
  $('#content-form').addEventListener('submit',saveContent);
  $('#tmdb-search-input').addEventListener('input',event=>{clearTimeout(state.tmdbSearchTimer);const query=event.target.value.trim();state.tmdbSearchTimer=setTimeout(()=>searchTmdbTitles(query),320);});
  $('#tmdb-search-results').addEventListener('click',event=>{const result=event.target.closest('[data-tmdb-id]');if(result)selectTmdbTitle(result.dataset.tmdbId,result.dataset.tmdbType);});
  $('#content-form').addEventListener('input',event=>{if(event.target.closest('.editor-grid'))renderContentPreview();});
  $('#content-form').addEventListener('change',event=>{if(event.target.closest('.editor-grid'))renderContentPreview();});
  $('#close-editor').addEventListener('click',()=>$('#content-dialog').close());$('#cancel-editor').addEventListener('click',()=>$('#content-dialog').close());
  // Koleksiyon ekleme düğmesi de üstteki delege edilmiş olay dinleyicisiyle yönetilir.
  $('#collection-form').addEventListener('submit',saveCollection);
  $('#collection-search').addEventListener('input',filterCollectionItems);
  $('#collection-close').addEventListener('click',()=>$('#collection-dialog').close());$('#collection-cancel').addEventListener('click',()=>$('#collection-dialog').close());
  $('#franchise-form').addEventListener('submit',saveFranchise);
  $('#franchise-search').addEventListener('input',filterFranchiseItems);
  $('#franchise-close').addEventListener('click',()=>$('#franchise-dialog').close());
  $('#franchise-cancel').addEventListener('click',()=>$('#franchise-dialog').close());
  $('#homepage-form').addEventListener('submit',saveHomepage);
  $('#header-footer-form').addEventListener('submit',saveHeaderFooter);
  ['header','footer'].forEach(kind=>{
    $('#hf-'+kind+'-logo-file')?.addEventListener('change',async event=>{
      const file=event.target.files?.[0];if(!file)return;
      try{const data=await readLogoFile(file);state.data[kind==='header'?'headerConfig':'footerConfig'].logoImage=data;renderLogoPreview(kind,data);toast('Logo yüklendi. Değişikliği uygulamak için ayarları kaydet.');}
      catch(error){toast(error.message,'error');}finally{event.target.value='';}
    });
    $('[data-remove-logo="'+kind+'"]')?.addEventListener('click',()=>{
      state.data[kind==='header'?'headerConfig':'footerConfig'].logoImage='';renderLogoPreview(kind,'');toast('Logo kaldırıldı. Değişikliği uygulamak için ayarları kaydet.');
    });
  });
  $('#header-footer-form').addEventListener('click',event=>{
    const add=event.target.closest('[data-add-custom-link]');
    if(add){const kind=add.dataset.addCustomLink;const root=$('#hf-'+kind+'-custom-links');const current=readCustomLinkRows(kind);current.push({label:'',page:'home'});renderCustomLinkRows(kind,current);const inputs=root.querySelectorAll('[data-custom-link-label]');if(inputs.length)inputs[inputs.length-1].focus();return;}
    const remove=event.target.closest('[data-remove-custom-link]');
    if(remove){const row=remove.closest('[data-custom-link-row]');const kind=row.dataset.customLinkRow;const current=$('#hf-'+kind+'-custom-links [data-custom-link-row]').filter(item=>item!==row).map(item=>({label:item.querySelector('[data-custom-link-label]').value.trim(),page:item.querySelector('[data-custom-link-page]').value}));renderCustomLinkRows(kind,current);}
  });
  $('#homepage-layout-save').addEventListener('click',saveHomepageLayout);
  $('#system-refresh')?.addEventListener('click',refreshSystemDiagnostics);
  $('#personalized-section-form').addEventListener('submit',savePersonalizedSection);
  $('#homepage-layout-list').addEventListener('input',event=>{
    const field=event.target.closest('[data-layout-label]');
    const row=event.target.closest('[data-layout-key]');
    if(!field||!row)return;
    const layout=homepageLayoutConfig();
    layout.labels[row.dataset.layoutKey]={...(layout.labels[row.dataset.layoutKey]||{}),[field.dataset.layoutLabel]:field.value};
    state.homepageLayoutDirty=true;
    const draftStatus=$('#homepage-layout-draft');if(draftStatus){draftStatus.dataset.state='draft';draftStatus.textContent='● Yayınlanmamış değişiklikler';}
  });
  $('#homepage-layout-list').addEventListener('click',event=>{
    const button=event.target.closest('[data-layout-action]');
    const row=event.target.closest('[data-layout-key]');
    if(!button||!row)return;
    const key=row.dataset.layoutKey;
    if(button.dataset.layoutAction==='up')moveHomepageSection(key,-1);
    if(button.dataset.layoutAction==='down')moveHomepageSection(key,1);
    if(button.dataset.layoutAction==='toggle')toggleHomepageSection(key);
  });
  $('#homepage-layout-reset').addEventListener('click',()=>{
    const layout=homepageLayoutConfig();
    layout.order=[...HOMEPAGE_LAYOUT_DEFAULTS];
    layout.visibility={};
    state.homepageLayoutDirty=true;
    renderHomepageLayout();
    toast('Varsayılan sıra taslağa alındı. Kalıcı olması için Düzeni yayınla.');
  });
  $('#hero-desktop-mode').addEventListener('change',event=>{state.heroRefreshDraft=null;state.heroDraft=state.heroDraft||{};state.heroDraft.desktop=event.target.value==='auto'&&$('#hero-desktop-category').value==='random'?[]:Array.from(document.querySelectorAll('#hero-desktop-slide-list input:checked')).map(x=>({id:x.value,active:true}));homepageConfig().desktopMode=event.target.value;renderHomepage();});
  $('#hero-desktop-category').addEventListener('change',event=>{state.heroRefreshDraft=null;state.heroDraft=state.heroDraft||{};state.heroDraft.desktop=[];homepageConfig().desktopCategory=event.target.value;renderHomepage();});
  $('#hero-desktop-count').addEventListener('change',event=>{
    const next=Math.max(5,Math.min(15,Number(event.target.value)||10));
    event.target.value=next;
    state.heroDraft=state.heroDraft||{};
    state.heroDraft.desktop=Array.from(document.querySelectorAll('#hero-desktop-slide-list input:checked')).slice(0,next).map(x=>({id:x.value,active:true}));
    state.heroRefreshDraft=null;
    homepageConfig().settings.desktopCount=next;
    renderHomepage();
  });
  $('#hero-mobile-mode').addEventListener('change',event=>{state.heroRefreshDraft=null;state.heroDraft=state.heroDraft||{};state.heroDraft.mobile=event.target.value==='auto'&&$('#hero-mobile-category').value==='random'?[]:Array.from(document.querySelectorAll('#hero-mobile-slide-list input:checked')).map(x=>({id:x.value,active:true}));homepageConfig().mobileMode=event.target.value;renderHomepage();});
  $('#hero-mobile-category').addEventListener('change',event=>{state.heroRefreshDraft=null;state.heroDraft=state.heroDraft||{};state.heroDraft.mobile=[];homepageConfig().mobileCategory=event.target.value;renderHomepage();});
  $('#hero-mobile-count').addEventListener('change',event=>{state.heroRefreshDraft=null;homepageConfig().settings.mobileCount=Number(event.target.value)||6;renderHomepage();});
  $('#hero-description-length-mode').addEventListener('change',event=>{
    const mode=event.target.value;
    const limit=mode==='custom'?Math.max(80,Math.min(5000,Number($('#hero-description-length-custom-value').value)||750)):Number(mode)||220;
    homepageConfig().settings.descriptionLengthMode=mode;
    homepageConfig().settings.descriptionLength=limit;
    $('#hero-description-length-custom').hidden=mode!=='custom';
    renderHomepage();
  });
  $('#hero-description-length-custom-value').addEventListener('input',event=>{
    const value=Math.max(80,Math.min(5000,Number(event.target.value)||750));
    $('#hero-description-length-count').textContent='Uygulanacak sınır: '+value+' karakter';
  });
  $('#hero-description-length-custom-value').addEventListener('change',event=>{
    const value=Math.max(80,Math.min(5000,Number(event.target.value)||750));
    homepageConfig().settings.descriptionLengthCustom=value;
    if($('#hero-description-length-mode').value==='custom')homepageConfig().settings.descriptionLength=value;
    renderHomepage();
  });
  $('#hero-desktop-description-mode').addEventListener('change',event=>{homepageConfig().settings.desktopDescriptionMode=event.target.value;$('#hero-desktop-description-custom').hidden=event.target.value!=='custom';});
  $('#hero-desktop-description-lines').addEventListener('change',event=>{homepageConfig().settings.desktopDescriptionLines=Math.max(1,Math.min(8,Number(event.target.value)||3));});
  $('#hero-desktop-description-width').addEventListener('change',event=>{homepageConfig().settings.desktopDescriptionWidthMode=event.target.value;$('#hero-desktop-description-width-custom').hidden=event.target.value!=='custom';});
  $('#hero-desktop-description-width-px').addEventListener('change',event=>{homepageConfig().settings.desktopDescriptionWidthPx=Math.max(360,Math.min(1200,Number(event.target.value)||720));});

  $('#watch-layout-save').addEventListener('click',saveWatchLayout);
  $('#watch-available-list').addEventListener('click',event=>{
    const button=event.target.closest('[data-add-card]');
    if(button)addWatchCard(button.dataset.addSide,button.dataset.addCard);
  });
  let draggedWatchCard=null;
  ['left','right'].forEach(side=>{
    const list=$('#watch-'+side+'-list');
    list.addEventListener('click',event=>{
      const item=event.target.closest('[data-card]');
      if(!item)return;
      const id=item.dataset.card;
      const transfer=event.target.closest('[data-target-side]');
      if(transfer){moveWatchCard(side,id,transfer.dataset.targetSide);return;}
      if(event.target.closest('[data-watch-toggle]')){toggleWatchCard(id);return;}
      if(event.target.closest('[data-watch-remove]')){removeWatchCard(side,id);return;}
      const move=event.target.closest('[data-move-direction]');
      if(move&&!move.disabled){
        const config=watchLayoutConfig(),index=config[side].indexOf(id);
        moveWatchCard(side,id,side,index+Number(move.dataset.moveDirection)+(Number(move.dataset.moveDirection)>0?1:0));
      }
    });
    list.addEventListener('dragstart',event=>{
      const item=event.target.closest('[data-card]');
      if(!item)return;
      draggedWatchCard={side,id:item.dataset.card};
      item.classList.add('is-dragging');
      event.dataTransfer.effectAllowed='move';
      event.dataTransfer.setData('text/plain',item.dataset.card);
    });
    list.addEventListener('dragover',event=>{
      if(!draggedWatchCard)return;
      event.preventDefault();
      event.dataTransfer.dropEffect='move';
      list.classList.add('is-drop-target');
      $$('.watch-order-item',list).forEach(row=>row.classList.remove('drop-target'));
      const over=event.target.closest('[data-card]');
      if(over&&over.dataset.card!==draggedWatchCard.id)over.classList.add('drop-target');
    });
    list.addEventListener('dragleave',event=>{
      if(!list.contains(event.relatedTarget)){
        list.classList.remove('is-drop-target');
        $$('.watch-order-item',list).forEach(row=>row.classList.remove('drop-target'));
      }
    });
    list.addEventListener('drop',event=>{
      if(!draggedWatchCard)return;
      event.preventDefault();
      const over=event.target.closest('[data-card]');
      const config=watchLayoutConfig();
      const destination=over?config[side].indexOf(over.dataset.card):config[side].length;
      moveWatchCard(draggedWatchCard.side,draggedWatchCard.id,side,destination);
      draggedWatchCard=null;
      $$('.watch-order-item').forEach(row=>row.classList.remove('is-dragging','drop-target'));
      $$('.watch-order-list').forEach(root=>root.classList.remove('is-drop-target'));
    });
    list.addEventListener('dragend',()=>{
      draggedWatchCard=null;
      $$('.watch-order-item').forEach(row=>row.classList.remove('is-dragging','drop-target'));
      $$('.watch-order-list').forEach(root=>root.classList.remove('is-drop-target'));
    });
  });
  $$('[data-demo-type]').forEach(button=>button.addEventListener('click',()=>{
    watchDemoType=button.dataset.demoType;
    renderWatchLayout();
  }));
  $$('[data-demo-device]').forEach(button=>button.addEventListener('click',()=>{
    watchDemoViewport=button.dataset.demoDevice;
    renderWatchLayout();
  }));
  $$('input[name="panel-density"],input[name="panel-theme"],input[name="panel-sidebar"],input[name="panel-page-size"]').forEach(input=>input.addEventListener('change',renderPreferenceDraftStatus));
  $('#panel-reduce-motion')?.addEventListener('change',renderPreferenceDraftStatus);
  $('#panel-notifications')?.addEventListener('change',renderPreferenceDraftStatus);
  document.addEventListener('click',event=>{const info=event.target.closest('[data-pref-info]');if(info)openPreferenceGuide(info.dataset.prefInfo);});
  $('#preferences-info-close')?.addEventListener('click',()=>$('#preferences-info-dialog').close());
  $('#preferences-info-done')?.addEventListener('click',()=>$('#preferences-info-dialog').close());
  $('#preferences-info-dialog')?.addEventListener('click',event=>{if(event.target===$('#preferences-info-dialog'))$('#preferences-info-dialog').close();});
  $('#preferences-save')?.addEventListener('click',saveAdminPreferences);
  $('#preferences-discard')?.addEventListener('click',()=>{loadPreferenceDraft();toast('Bekleyen değişikliklerden vazgeçildi.','info');});
  $('#preferences-reset')?.addEventListener('click',()=>{loadPreferenceDraft({density:'comfortable',reduceMotion:false,theme:'dark',sidebar:'normal',pageSize:12,notifications:true});toast('Varsayılan tercihler taslağa yüklendi. Kaydetmeden uygulanmaz.','info');});
  $('#analytics-export')?.addEventListener('click',exportAnalyticsCsv);
  $('#year-chart-more')?.addEventListener('click',()=>{const button=$('#year-chart-more');button.dataset.expanded=String(button.dataset.expanded!=='true');renderAnalytics();});
  $('#genre-chart-more')?.addEventListener('click',()=>{const button=$('#genre-chart-more');button.dataset.expanded=String(button.dataset.expanded!=='true');renderAnalytics();});
  $('#year-chart-all')?.addEventListener('click',()=>openAnalyticsDetail('years'));
  $('#genre-chart-all')?.addEventListener('click',()=>openAnalyticsDetail('genres'));
  ['#rating-chart','#year-chart','#genre-chart','#analytics-detail-results'].forEach(selector=>$(selector)?.addEventListener('click',event=>{const button=event.target.closest('[data-report-action]');if(button)handleAnalyticsAction(button.dataset.reportAction,button.dataset.reportValue);}));
  $('#analytics-detail-back')?.addEventListener('click',()=>navigate('analytics'));
  $('#analytics-detail-export')?.addEventListener('click',exportAnalyticsDetailCsv);
  ['#analytics-detail-search','#analytics-detail-type','#analytics-detail-sort','#analytics-detail-page-size'].forEach(selector=>$(selector)?.addEventListener(selector==='#analytics-detail-search'?'input':'change',()=>{state.analyticsDetailPage=1;renderAnalyticsDetail();}));
  $('#analytics-detail-prev')?.addEventListener('click',()=>{state.analyticsDetailPage=Math.max(1,state.analyticsDetailPage-1);renderAnalyticsDetail();});
  $('#analytics-detail-next')?.addEventListener('click',()=>{state.analyticsDetailPage++;renderAnalyticsDetail();});
  initBackupTools();
  init();
})();