(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const state = { data:null, catalog:[], filtered:[], page:1, pageSize:12, view:'overview', sha:null, apiEnabled:false, saving:false, heroDraft:null };
  const HOMEPAGE_LAYOUT_DEFAULTS = ['hero','personalized','continue','watchlist','new-arrivals','series-tracking','genre-discovery','published-collections','catalog'];
  const HOMEPAGE_LAYOUT_ITEMS = {
    hero:{title:'Manşet',description:'Masaüstü ve mobil ana görsel alanı',icon:'▣',locked:true},
    personalized:{title:'İzleme Zevkine Göre',description:'Kişiselleştirilmiş film ve dizi önerileri',icon:'✦'},
    continue:{title:'İzlemeye Devam Et',description:'Kaldığın yerden devam ettiğin yapımlar',icon:'▷'},
    watchlist:{title:'İzleme Listem',description:'Daha sonra izlemek için kaydettiklerin',icon:'♡'},
    'new-arrivals':{title:'Son Eklenenler',description:'Kataloğa en son eklenen yapımlar',icon:'＋'},
    'series-tracking':{title:'Dizi Takibi',description:'Sezon ve bölüm ilerlemen',icon:'▤'},
    'genre-discovery':{title:'Türlere Göre Keşfet',description:'Tür kartları ve keşif filtreleri',icon:'⌕'},
    'published-collections':{title:'Yayınlanan Koleksiyonlar',description:'Admin panelinde hazırlanan özel seçkiler',icon:'▧'},
    catalog:{title:'Tüm Yapımlar & Trendler',description:'Katalogdan seçilen genel yapım rafı',icon:'▥'}
  };
  function applyAdminTheme(){ document.body.classList.remove('admin-theme-ivory','admin-theme-slate','admin-theme-dark'); const meta=document.querySelector('meta[name="theme-color"]'); if(meta)meta.content='#f4f3ef'; }
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const titleOf = item => item.title || item.tmdbTitle || item.originalTitle || item.tmdbOriginalTitle || 'Başlıksız yapım';
  const posterOf = item => item.image || item.poster || item.tmdbPoster || '';
  const isSeries = item => ['tv','series','dizi'].includes(String(item.type||'').toLowerCase());
  const yearOf = item => Number(item.year || item.releaseYear || (item.tmdbReleaseDate || '').slice(0,4)) || '—';
  const collectionList = () => Array.isArray(state.data?.collections) ? state.data.collections : [];
  const toast = message => { const el=$('#toast'); if(!el)return; el.textContent=message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),3000); };
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
  function canWrite(){ if(!state.apiEnabled||!state.sha){toast('Katalog şu anda salt okunur. GitHub erişim bağlantısı doğrulanınca düzenleme açılacak.');return false;} return true; }
  function navigate(view){
    state.view=view;
    $$('.view').forEach(el=>el.classList.toggle('active',el.id==='view-'+view));
    $$('.nav-link').forEach(el=>{const active=el.dataset.view===view;el.classList.toggle('active',active);el.setAttribute('aria-current',active?'page':'false');});
    const active=$('.nav-link[data-view="'+view+'"]');
    $('#crumb-current').textContent=active?active.textContent.trim().replace(/\s+/g,' '):'Genel Bakış';
    setMobileSidebar(false);
    if(view==='catalog')renderCatalog();
    if(view==='collections')renderCollections();
    if(view==='homepage')renderHomepage();
    if(view==='homepage-layout')renderHomepageLayout();
    if(view==='watch-layout')renderWatchLayout();
    if(view==='header-footer')renderHeaderFooter();
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
    }catch(error){$('#profile-upload-status').textContent=error.message;toast(error.message);}
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
    const pages=Math.max(1,Math.ceil(state.filtered.length/state.pageSize));state.page=Math.min(state.page,pages);
    const rows=state.filtered.slice((state.page-1)*state.pageSize,state.page*state.pageSize);
    $('#catalog-rows').innerHTML=rows.length?rows.map(item=>'<tr><td><div class="catalog-title"><img loading="lazy" src="'+escapeHtml(posterOf(item))+'" alt="" onerror="this.style.visibility=\'hidden\'"><div><b>'+escapeHtml(titleOf(item))+'</b><small>'+escapeHtml(item.director||item.tmdbDirector||'Yönetmen bilgisi yok')+'</small></div></div></td><td><span class="type-chip">'+(isSeries(item)?'Dizi':'Film')+'</span></td><td>'+escapeHtml(yearOf(item))+'</td><td><span class="score">★ '+escapeHtml(item.rating||item.tmdbRating||'—')+'</span></td><td>'+escapeHtml(item.tmdbId||'—')+'</td><td class="row-actions"><button class="row-action" data-edit="'+escapeHtml(item.id)+'">Düzenle</button><button class="row-action danger-action" data-delete="'+escapeHtml(item.id)+'">Sil</button></td></tr>').join(''):'<tr><td colspan="6" class="empty-cell">Aramanızla eşleşen kayıt bulunamadı.</td></tr>';
    $('#result-count').textContent=state.filtered.length.toLocaleString('tr-TR')+' kayıt';
    $('#page-info').textContent='Sayfa '+state.page+' / '+pages;
    $('#prev-page').disabled=state.page<=1;$('#next-page').disabled=state.page>=pages;
    $$('#catalog-rows [data-edit]').forEach(btn=>btn.addEventListener('click',()=>{const item=state.catalog.find(x=>String(x.id)===btn.dataset.edit);if(item)openEditor(item);}));
    $$('#catalog-rows [data-delete]').forEach(btn=>btn.addEventListener('click',()=>deleteContent(btn.dataset.delete)));
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
  function renderAnalytics(){
    const movies=state.catalog.filter(x=>!isSeries(x)).length,series=state.catalog.length-movies,max=Math.max(movies,series,1);
    $('#type-chart').innerHTML=[['Film',movies],['Dizi',series]].map(([name,n])=>'<div class="bar-row"><span>'+name+'</span><div class="bar-track"><div class="bar-fill" style="width:'+(n/max*100)+'%"></div></div><b>'+n+'</b></div>').join('');
    const counts={};state.catalog.forEach(x=>{const y=yearOf(x);if(y!=='—')counts[y]=(counts[y]||0)+1;});
    const top=Object.entries(counts).sort((a,b)=>Number(b[0])-Number(a[0])).slice(0,10).sort((a,b)=>Number(a[0])-Number(b[0]));
    const maxYear=Math.max(1,...top.map(x=>x[1]));
    $('#year-chart').innerHTML=top.map(([y,n])=>'<div class="bar-row"><span>'+escapeHtml(y)+'</span><div class="bar-track"><div class="bar-fill" style="width:'+(n/maxYear*100)+'%"></div></div><b>'+n+'</b></div>').join('')||'<small>Yıl verisi bulunamadı.</small>';
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
      state.sha=result.sha;refreshYearFilter();updateMetrics();renderRecent();renderCatalog();renderCollections();renderAnalytics();renderHomepage();renderHomepageLayout();renderOverviewInsights();
      $('#homepage-config').textContent=JSON.stringify(state.data.homepageConfig||{},null,2);
      renderWatchLayout();renderAdminProfile();
      toast(successMessage||'Değişiklikler GitHub kataloğuna kaydedildi.');
      return true;
    }catch(error){toast(error.message);console.error(error);return false;}
    finally{state.saving=false;}
  }
  function headerFooterDefaults(){
    return {
      header:{enabled:true,sticky:true,showLogoIcon:true,brandPrimary:'CINE',brandAccent:'VERSE',showHome:true,homeLabel:'Ana Sayfa',showExplore:true,exploreLabel:'Keşfet',showVideo:true,videoLabel:'Video Bağlantıları',showSearch:true,showProfile:true,showMobileMenu:true},
      footer:{enabled:true,brandPrimary:'CINE',brandAccent:'VERSE',description:'Filmlerini keşfet, dizilerini takip et, izleme yolculuğunu kendi kütüphanende biriktir.',showBadges:true,badgeOne:'KİŞİSEL KÜTÜPHANE',badgeTwo:'DİZİ TAKİBİ',columnOneTitle:'CineVerse',homeLabel:'Ana Sayfa',exploreLabel:'Keşfet',libraryLabel:'Kütüphanem',columnTwoTitle:'İzleme Alanım',watchlistLabel:'İzleme Listem',statsLabel:'İstatistikler',featureTitle:'İzleme keyfini kişiselleştir',featureDescription:'Listeni oluştur, kaldığın yerden devam et ve izleme geçmişini tek yerde düzenle.',ctaLabel:'Kütüphaneme Git',showCta:true,copyright:'© 2026 CineVerse. Tüm hakları saklıdır.',showBackToTop:true}
    };
  }
  function headerFooterConfig(){
    const defaults=headerFooterDefaults();
    state.data.headerConfig={...defaults.header,...(state.data.headerConfig||{})};
    state.data.footerConfig={...defaults.footer,...(state.data.footerConfig||{})};
    return {header:state.data.headerConfig,footer:state.data.footerConfig};
  }
  function renderHeaderFooter(){
    if(!state.data)return;
    const {header:h,footer:f}=headerFooterConfig();
    const fields={
      'hf-header-primary':h.brandPrimary,'hf-header-accent':h.brandAccent,'hf-header-home-label':h.homeLabel,'hf-header-explore-label':h.exploreLabel,'hf-header-video-label':h.videoLabel,
      'hf-footer-primary':f.brandPrimary,'hf-footer-accent':f.brandAccent,'hf-footer-description':f.description,'hf-footer-badge-one':f.badgeOne,'hf-footer-badge-two':f.badgeTwo,
      'hf-footer-col-one':f.columnOneTitle,'hf-footer-home-label':f.homeLabel,'hf-footer-explore-label':f.exploreLabel,'hf-footer-library-label':f.libraryLabel,
      'hf-footer-col-two':f.columnTwoTitle,'hf-footer-watchlist-label':f.watchlistLabel,'hf-footer-stats-label':f.statsLabel,'hf-footer-feature-title':f.featureTitle,
      'hf-footer-feature-description':f.featureDescription,'hf-footer-cta-label':f.ctaLabel,'hf-footer-copyright':f.copyright
    };
    Object.entries(fields).forEach(([id,value])=>setField(id,value));
    const checks={
      'hf-header-enabled':h.enabled!==false,'hf-header-sticky':h.sticky!==false,'hf-header-logo-icon':h.showLogoIcon!==false,'hf-header-search':h.showSearch!==false,
      'hf-header-profile':h.showProfile!==false,'hf-header-mobile':h.showMobileMenu!==false,'hf-header-home':h.showHome!==false,'hf-header-explore':h.showExplore!==false,'hf-header-video':h.showVideo!==false,
      'hf-footer-enabled':f.enabled!==false,'hf-footer-badges':f.showBadges!==false,'hf-footer-cta':f.showCta!==false,'hf-footer-backtop':f.showBackToTop!==false
    };
    Object.entries(checks).forEach(([id,value])=>{const el=$('#'+id);if(el)el.checked=value;});
  }
  async function saveHeaderFooter(event){
    event.preventDefault();
    if(!canWrite())return;
    headerFooterConfig();
    const value=id=>String($('#'+id).value||'').trim();
    const checked=id=>$('#'+id).checked;
    const header={
      enabled:checked('hf-header-enabled'),sticky:checked('hf-header-sticky'),showLogoIcon:checked('hf-header-logo-icon'),
      brandPrimary:value('hf-header-primary')||'CINE',brandAccent:value('hf-header-accent')||'VERSE',
      showHome:checked('hf-header-home'),homeLabel:value('hf-header-home-label')||'Ana Sayfa',
      showExplore:checked('hf-header-explore'),exploreLabel:value('hf-header-explore-label')||'Keşfet',
      showVideo:checked('hf-header-video'),videoLabel:value('hf-header-video-label')||'Video Bağlantıları',
      showSearch:checked('hf-header-search'),showProfile:checked('hf-header-profile'),showMobileMenu:checked('hf-header-mobile')
    };
    const footer={
      enabled:checked('hf-footer-enabled'),brandPrimary:value('hf-footer-primary')||'CINE',brandAccent:value('hf-footer-accent')||'VERSE',
      description:value('hf-footer-description'),showBadges:checked('hf-footer-badges'),badgeOne:value('hf-footer-badge-one'),badgeTwo:value('hf-footer-badge-two'),
      columnOneTitle:value('hf-footer-col-one'),homeLabel:value('hf-footer-home-label'),exploreLabel:value('hf-footer-explore-label'),libraryLabel:value('hf-footer-library-label'),
      columnTwoTitle:value('hf-footer-col-two'),watchlistLabel:value('hf-footer-watchlist-label'),statsLabel:value('hf-footer-stats-label'),
      featureTitle:value('hf-footer-feature-title'),featureDescription:value('hf-footer-feature-description'),ctaLabel:value('hf-footer-cta-label'),
      showCta:checked('hf-footer-cta'),copyright:value('hf-footer-copyright'),showBackToTop:checked('hf-footer-backtop')
    };
    const ok=await persist({...state.data,headerConfig:header,footerConfig:footer},'Header ve Footer ayarları kaydedildi.');
    if(ok)renderHeaderFooter();
  }
  function setField(id,value){const el=$('#'+id);if(el)el.value=value??'';}
  function openEditor(item=null){
    if(!canWrite())return;
    $('#content-form').reset();$('#edit-id').value=item?String(item.id??''):'';
    $('#editor-title').textContent=item?'İçeriği düzenle':'Yeni içerik';
    setField('field-title',item?.title||'');setField('field-type',isSeries(item)?'tv':'movie');
    setField('field-year',item?.year||'');setField('field-rating',item?.rating||item?.tmdbRating||'');
    setField('field-genre',item?.genre||'');setField('field-category',item?.category||item?.tmdbGenres||'');
    setField('field-duration',item?.duration||item?.tmdbRuntime||'');setField('field-country',item?.country||item?.tmdbCountries||'');
    setField('field-director',item?.director||item?.tmdbDirector||'');setField('field-platform',item?.platform||'');
    setField('field-watch',item?.watchUrl||'');setField('field-note',item?.personalNote||'');
    setField('field-episode-urls',Object.entries(item?.episodeWatchUrls||{}).map(([key,url])=>key.replace(':',':')+' | '+url).join('\n'));
    setField('field-tmdb',item?.tmdbId||'');setField('field-imdb',item?.imdbId||item?.tmdbImdbId||'');
    setField('field-image',item?.image||item?.poster||item?.tmdbPoster||'');setField('field-backdrop',item?.backdrop||item?.tmdbBackdrop||'');
    setField('field-trailer',item?.trailerUrl||item?.tmdbTrailerUrl||'');setField('field-seasons',item?.seasons||'');
    setField('field-episodes',item?.episodes||'');setField('field-desc',item?.desc||item?.tmdbOverview||'');
    $('#editor-status').textContent=item?'Mevcut katalog kaydı düzenleniyor.':'Yeni katalog kaydı oluşturuluyor.';
    $('#content-dialog').showModal();
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
    try{episodeWatchUrls=parseEpisodeWatchUrls($('#field-episode-urls').value);}catch(error){toast(error.message);return;}
    const record={...(existing||{}),id:existing?.id??('cv-'+Date.now()),title:$('#field-title').value.trim(),type,
      year:$('#field-year').value.trim(),rating:$('#field-rating').value.trim(),genre:$('#field-genre').value.trim(),
      category:$('#field-category').value.trim(),duration:$('#field-duration').value.trim(),country:$('#field-country').value.trim(),
      director:$('#field-director').value.trim(),platform:$('#field-platform').value.trim(),watchUrl:$('#field-watch').value.trim(),
      personalNote:$('#field-note').value.trim(),episodeWatchUrls: type==='tv'?episodeWatchUrls:{},tmdbId:$('#field-tmdb').value.trim()?Number($('#field-tmdb').value):null,
      imdbId:$('#field-imdb').value.trim(),image:$('#field-image').value.trim(),
      backdrop:$('#field-backdrop').value.trim(),trailerUrl:$('#field-trailer').value.trim(),desc:$('#field-desc').value.trim()};
    if(!record.title){toast('Yapım adı zorunludur.');return;}
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
  function autoHeroItems(category,count){
    let items=state.catalog.filter(item=>posterOf(item));
    if(category==='movies')items=items.filter(item=>!isSeries(item));
    if(category==='series')items=items.filter(item=>isSeries(item));
    if(category==='top-rated')items.sort((a,b)=>heroRating(b)-heroRating(a)||heroVotes(b)-heroVotes(a));
    else if(category==='popular')items.sort((a,b)=>{
      const score=x=>Number(x.popularity||x.tmdbPopularity)||heroVotes(x)*Math.max(heroRating(x),1);
      return score(b)-score(a)||heroRating(b)-heroRating(a);
    });
    else if(category==='most-watched')items.sort((a,b)=>heroVotes(b)-heroVotes(a)||heroRating(b)-heroRating(a));
    else items.sort((a,b)=>heroRating(b)-heroRating(a)||heroVotes(b)-heroVotes(a));
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
    return config.layout;
  }
  function renderHomepageLayout(){
    if(!state.data)return;
    const layout=homepageLayoutConfig();
    const list=$('#homepage-layout-list');
    if(!list)return;
    const visibleCount=HOMEPAGE_LAYOUT_DEFAULTS.filter(key=>key==='hero'||layout.visibility[key]!==false).length;
    $('#homepage-layout-count').textContent=visibleCount+' / '+HOMEPAGE_LAYOUT_DEFAULTS.length+' açık';
    list.innerHTML=layout.order.map((key,index)=>{
      const item=HOMEPAGE_LAYOUT_ITEMS[key];
      if(!item)return '';
      const locked=!!item.locked;
      const active=locked||layout.visibility[key]!==false;
      const position=index+1;
      return '<div class="homepage-layout-row'+(active?'':' is-disabled')+'" data-layout-key="'+escapeHtml(key)+'">'+
        '<span class="homepage-layout-row-icon">'+item.icon+'</span>'+
        '<div class="homepage-layout-row-copy"><b>'+escapeHtml(item.title)+'</b><small>'+escapeHtml(item.description)+'</small></div>'+
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
    renderHomepageLayout();
  }
  function toggleHomepageSection(key){
    const layout=homepageLayoutConfig();
    if(!HOMEPAGE_LAYOUT_ITEMS[key]||HOMEPAGE_LAYOUT_ITEMS[key].locked)return;
    layout.visibility[key]=layout.visibility[key]===false;
    renderHomepageLayout();
  }
  async function saveHomepageLayout(){
    const config=homepageConfig();
    const layout=homepageLayoutConfig();
    const nextLayout={order:[...layout.order],visibility:{...layout.visibility}};
    const ok=await persist({...state.data,homepageConfig:{...config,layout:nextLayout}},'Ana sayfa bölümleri ve sıralaması kaydedildi.');
    if(ok)renderHomepageLayout();
  }
  function renderHomepage(){
    const config=homepageConfig(),settings=config.settings;
    $('#hero-desktop-count').value=settings.desktopCount??10;
    $('#hero-mobile-count').value=settings.mobileCount??6;
    $('#hero-interval').value=settings.interval??6;
    $('#hero-description-length').value=settings.descriptionLength??220;
    $('#hero-autoplay').checked=settings.autoplay!==false;
    $('#hero-pause').checked=settings.pauseOnHover!==false;
    const draft=state.heroDraft||{};
    const devices=['desktop','mobile'];
    devices.forEach(device=>{
      const mode=config[device+'Mode']||'manual';
      const category=config[device+'Category']||'top-rated';
      $('#hero-'+device+'-mode').value=mode;
      $('#hero-'+device+'-category').value=category;
      const limit=Number($('#hero-'+device+'-count').value)|| (device==='desktop'?10:6);
      const saved=Array.isArray(draft[device])?draft[device]:(Array.isArray(config[device+'HeroSlides'])?config[device+'HeroSlides']:config.heroSlides);
      const selectedIds=mode==='auto'?autoHeroItems(category,limit).map(x=>String(x.id)):saved.map(x=>String(typeof x==='object'?x.id:x));
      const selected=new Set(selectedIds);
      const list=$('#hero-'+device+'-slide-list');
      const pool=mode==='auto'?autoHeroItems(category,limit):state.catalog;
      list.innerHTML=pool.map(item=>{
        const checked=selected.has(String(item.id));
        return '<label class="hero-pick" data-search="'+escapeHtml((titleOf(item)+' '+yearOf(item)).toLocaleLowerCase('tr-TR'))+'"><input type="checkbox" value="'+escapeHtml(item.id)+'" '+(checked?'checked ':'')+(mode==='auto'?'disabled ':'')+'><img src="'+escapeHtml(posterOf(item))+'" alt=""><span><b>'+escapeHtml(titleOf(item))+'</b><small>'+(isSeries(item)?'Dizi':'Film')+' · '+escapeHtml(yearOf(item))+' · ★ '+escapeHtml(item.tmdbRating||item.rating||'—')+'</small></span></label>';
      }).join('');
      const count=()=>$('#hero-'+device+'-selected-count').textContent=$$('#hero-'+device+'-slide-list input:checked').length+' yapım seçildi';
      const preview=()=>{
        const firstId=$$('#hero-'+device+'-slide-list input:checked')[0]?.value;
        const item=state.catalog.find(x=>String(x.id)===String(firstId));
        const host=$('#hero-'+device+'-preview');
        if(!item){host.innerHTML='<div class="hero-preview-empty">Henüz manşet yapımı seçilmedi.</div>';return;}
        const max=Math.max(80,Math.min(500,Number($('#hero-description-length').value)||220));
        const desc=String(item.desc||item.tmdbOverview||'');
        const excerpt=desc.length>max?desc.slice(0,max).trimEnd()+'…':desc;
        host.innerHTML='<div class="hero-preview-art" style="background-image:linear-gradient(90deg,rgba(5,7,12,.96),rgba(5,7,12,.62) 58%,rgba(5,7,12,.12)),url(\''+escapeHtml(item.backdrop||posterOf(item))+'\')"><div class="hero-preview-copy"><span class="hero-preview-kicker">● ÖNE ÇIKAN YAPIM</span><h3>'+escapeHtml(titleOf(item))+'</h3><div class="hero-preview-meta">★ '+escapeHtml(item.tmdbRating||item.rating||'—')+'　·　'+escapeHtml(yearOf(item))+'　·　'+(isSeries(item)?'DİZİ':'FİLM')+'</div><p>'+escapeHtml(excerpt)+'</p></div></div>';
      };
      count();preview();
      $$('#hero-'+device+'-slide-list input').forEach(input=>input.addEventListener('change',()=>{count();preview();}));
      $('#hero-'+device+'-search').value='';
      $('#hero-'+device+'-search').oninput=event=>{
        const q=event.target.value.trim().toLocaleLowerCase('tr-TR');
        $$('#hero-'+device+'-slide-list .hero-pick').forEach(row=>{row.hidden=!!q&&!row.dataset.search.includes(q);});
      };
      $('#hero-'+device+'-hint').textContent=mode==='auto'
        ?(category==='most-watched'?'En çok izlenen sıralaması, katalogdaki TMDB oy sayısı üzerinden hesaplanır; platform içi oynatma sayacı henüz bulunmuyor.':'Seçilen ölçüte göre katalogdan otomatik '+pool.length+' yapım getirildi.')
        :'Katalogda ara; kutucuğu işaretleyerek manşete ekle, işareti kaldırarak çıkar.';
    });
    $('#homepage-config').textContent=JSON.stringify(config,null,2);
  }
  async function saveHomepage(event){
    event.preventDefault();if(!canWrite())return;
    const previous=homepageConfig();
    const legacyById=new Map(previous.heroSlides.map(x=>[String(x.id),x]));
    const buildSlides=device=>{
      const listId='#hero-'+device+'-slide-list';
      const oldEntries=Array.isArray(previous[device+'HeroSlides'])?previous[device+'HeroSlides']:previous.heroSlides;
      const oldMap=new Map(oldEntries.map(x=>[String(x.id),x]));
      return $$(listId+' input:checked').map(input=>{
        const id=input.value,old=oldMap.get(String(id))||legacyById.get(String(id))||{};
        return {...old,id,active:true,headline:old.headline||'',description:old.description||''};
      });
    };
    const desktopHeroSlides=buildSlides('desktop'),mobileHeroSlides=buildSlides('mobile');
    const config={...previous,version:4,desktopMode:$('#hero-desktop-mode').value,desktopCategory:$('#hero-desktop-category').value,
      mobileMode:$('#hero-mobile-mode').value,mobileCategory:$('#hero-mobile-category').value,
      settings:{...previous.settings,desktopCount:Number($('#hero-desktop-count').value)||10,mobileCount:Number($('#hero-mobile-count').value)||6,
        interval:Number($('#hero-interval').value)||6,descriptionLength:Math.max(80,Math.min(500,Number($('#hero-description-length').value)||220)),
        autoplay:$('#hero-autoplay').checked,pauseOnHover:$('#hero-pause').checked},
      desktopHeroSlides,mobileHeroSlides,heroSlides:desktopHeroSlides};
    const ok=await persist({...state.data,homepageConfig:config},'Manşet ayarları kaydedildi.');
    if(ok){state.heroDraft=null;renderHomepage();}
  }
  async function init(){
    applyAdminTheme();
    const formattedDate=new Intl.DateTimeFormat('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());$('#today-date').textContent=formattedDate;
    $('#last-check').textContent=new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
    try{
      const apiResponse=await fetchWithTimeout('/api/catalog',{cache:'no-store',credentials:'same-origin'});
      if(!apiResponse.ok){const p=await apiResponse.json().catch(()=>({}));throw new Error(p.error||'Yönetim API hatası: '+apiResponse.status);}
      const payload=await apiResponse.json();state.data=payload.data;state.sha=payload.sha||null;state.apiEnabled=!!state.sha&&payload.writable!==false;
      if(!Array.isArray(state.data?.catalog))throw new Error('Katalog listesi bulunamadı.');
      state.catalog=state.data.catalog.filter(x=>x&&typeof x==='object');
      renderWelcomePosters();
      $('.environment').innerHTML='<i></i> KORUMALI YÖNETİM';
      // Render the catalog immediately after the data API succeeds. A secondary
      // session/profile endpoint must never prevent the catalog from appearing.
      $('#health-catalog').textContent='Bağlandı';$('#health-json').textContent='Geçerli';
      $('#data-version').textContent=String(state.data.version??'Belirtilmemiş');
      $('#add-content').disabled=!state.apiEnabled;$('#catalog-add').disabled=!state.apiEnabled;$('#collection-add').disabled=!state.apiEnabled;
      updateMetrics();refreshYearFilter();renderRecent();renderCatalog();renderCollections();renderAnalytics();renderHomepage();renderHomepageLayout();renderOverviewInsights();renderAdminProfile();renderWatchLayout();renderHeaderFooter();renderHeaderFooter();
      $('#homepage-config').textContent=JSON.stringify(state.data.homepageConfig||{},null,2);
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
    }catch(error){
      showStartupError(error.message||'Katalog yüklenemedi.');
      console.error('Admin yükleme hatası:',error);
      $('#health-catalog').textContent='Bağlantı yok';$('#health-json').textContent='Okunamadı';$('#metric-total').textContent='—';
      $('#recent-list').innerHTML='<div class="loading-line">'+escapeHtml(error.message||'Katalog yüklenemedi.')+'</div>';
      $('#catalog-rows').innerHTML='<tr><td colspan="6" class="empty-cell">Katalog yüklenemedi.</td></tr>';
      toast(error.message||'Katalog yüklenemedi.');
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
  $('#prev-page').addEventListener('click',()=>{state.page=Math.max(1,state.page-1);renderCatalog();});
  $('#next-page').addEventListener('click',()=>{state.page++;renderCatalog();});
  $('#add-content').addEventListener('click',()=>openEditor());$('#catalog-add').addEventListener('click',()=>openEditor());
  $('#content-form').addEventListener('submit',saveContent);
  $('#close-editor').addEventListener('click',()=>$('#content-dialog').close());$('#cancel-editor').addEventListener('click',()=>$('#content-dialog').close());
  $('#collection-add').addEventListener('click',()=>openCollectionEditor(null));
  $('#collection-form').addEventListener('submit',saveCollection);
  $('#collection-search').addEventListener('input',filterCollectionItems);
  $('#collection-close').addEventListener('click',()=>$('#collection-dialog').close());$('#collection-cancel').addEventListener('click',()=>$('#collection-dialog').close());
  $('#homepage-form').addEventListener('submit',saveHomepage);
  $('#header-footer-form').addEventListener('submit',saveHeaderFooter);
  $('#homepage-layout-save').addEventListener('click',saveHomepageLayout);
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
    renderHomepageLayout();
    toast('Varsayılan sıra taslağa alındı. Kalıcı olması için Düzeni yayınla.');
  });
  $('#hero-desktop-mode').addEventListener('change',event=>{state.heroDraft=state.heroDraft||{};state.heroDraft.desktop=Array.from(document.querySelectorAll('#hero-desktop-slide-list input:checked')).map(x=>({id:x.value,active:true}));homepageConfig().desktopMode=event.target.value;renderHomepage();});
  $('#hero-desktop-category').addEventListener('change',event=>{homepageConfig().desktopCategory=event.target.value;renderHomepage();});
  $('#hero-desktop-count').addEventListener('change',event=>{homepageConfig().settings.desktopCount=Number(event.target.value)||10;renderHomepage();});
  $('#hero-mobile-mode').addEventListener('change',event=>{state.heroDraft=state.heroDraft||{};state.heroDraft.mobile=Array.from(document.querySelectorAll('#hero-mobile-slide-list input:checked')).map(x=>({id:x.value,active:true}));homepageConfig().mobileMode=event.target.value;renderHomepage();});
  $('#hero-mobile-category').addEventListener('change',event=>{homepageConfig().mobileCategory=event.target.value;renderHomepage();});
  $('#hero-mobile-count').addEventListener('change',event=>{homepageConfig().settings.mobileCount=Number(event.target.value)||6;renderHomepage();});
  $('#hero-description-length').addEventListener('change',event=>{homepageConfig().settings.descriptionLength=Number(event.target.value)||220;renderHomepage();});

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
  init();
})();