(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const state = { data:null, catalog:[], filtered:[], page:1, pageSize:12, view:'overview', sha:null, apiEnabled:false, saving:false };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const titleOf = item => item.title || item.tmdbTitle || item.originalTitle || item.tmdbOriginalTitle || 'Başlıksız yapım';
  const posterOf = item => item.image || item.poster || item.tmdbPoster || '';
  const isSeries = item => ['tv','series','dizi'].includes(String(item.type||'').toLowerCase());
  const yearOf = item => Number(item.year || item.releaseYear || (item.tmdbReleaseDate || '').slice(0,4)) || '—';
  const collectionList = () => Array.isArray(state.data?.collections) ? state.data.collections : [];
  const toast = message => { const el=$('#toast'); if(!el)return; el.textContent=message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),3000); };
  function canWrite(){ if(!state.apiEnabled||!state.sha){toast('Düzenleme için korumalı yönetim adresini kullanın.');return false;} return true; }
  function navigate(view){
    state.view=view;
    $$('.view').forEach(el=>el.classList.toggle('active',el.id==='view-'+view));
    $$('.nav-link').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
    const active=$('.nav-link[data-view="'+view+'"]');
    $('#crumb-current').textContent=active?active.textContent.trim().replace(/\s+/g,' '):'Genel Bakış';
    $('#sidebar').classList.remove('open');
    if(view==='catalog')renderCatalog();
    if(view==='collections')renderCollections();
    if(view==='homepage')renderHomepage();
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
    $('#catalog-rows [data-edit]').forEach(btn=>btn.addEventListener('click',()=>{const item=state.catalog.find(x=>String(x.id)===btn.dataset.edit);if(item)openEditor(item);}));
    $('#catalog-rows [data-delete]').forEach(btn=>btn.addEventListener('click',()=>deleteContent(btn.dataset.delete)));
  }
  function renderCollections(){
    const list=collectionList();
    $('#collection-grid').innerHTML=list.length?list.map(item=>{
      const count=Array.isArray(item.items)?item.items.length:0;
      return '<article class="collection-card"><div class="collection-card-top"><span class="collection-status '+(item.active===false?'inactive':'')+'">'+(item.active===false?'Pasif':'Yayında')+'</span><span class="collection-id">'+escapeHtml(item.id||'')+'</span></div><h3>'+escapeHtml(item.title||item.name||'İsimsiz koleksiyon')+'</h3><p>'+escapeHtml(item.description||'Açıklama eklenmemiş')+'</p><strong>'+count+'</strong><small>İçerik kaydı</small><div class="collection-actions"><button class="row-action" data-collection-edit="'+escapeHtml(item.id)+'">Düzenle</button><button class="row-action danger-action" data-collection-delete="'+escapeHtml(item.id)+'">Sil</button></div></article>';
    }).join(''):'<article class="panel-card empty-state"><span>▧</span><h2>Henüz koleksiyon bulunamadı</h2><p>Yeni koleksiyon oluşturarak seçkilerini yönetebilirsin.</p></article>';
    $('#collection-grid [data-collection-edit]').forEach(btn=>btn.addEventListener('click',()=>openCollectionEditor(btn.dataset.collectionEdit)));
    $('#collection-grid [data-collection-delete]').forEach(btn=>btn.addEventListener('click',()=>deleteCollection(btn.dataset.collectionDelete)));
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
      state.sha=result.sha;refreshYearFilter();updateMetrics();renderRecent();renderCatalog();renderCollections();renderAnalytics();renderHomepage();
      $('#homepage-config').textContent=JSON.stringify(state.data.homepageConfig||{},null,2);
      toast(successMessage||'Değişiklikler GitHub kataloğuna kaydedildi.');
      return true;
    }catch(error){toast(error.message);console.error(error);return false;}
    finally{state.saving=false;}
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
    setField('field-tmdb',item?.tmdbId||'');setField('field-imdb',item?.imdbId||item?.tmdbImdbId||'');
    setField('field-image',item?.image||item?.poster||item?.tmdbPoster||'');setField('field-backdrop',item?.backdrop||item?.tmdbBackdrop||'');
    setField('field-trailer',item?.trailerUrl||item?.tmdbTrailerUrl||'');setField('field-seasons',item?.seasons||'');
    setField('field-episodes',item?.episodes||'');setField('field-desc',item?.desc||item?.tmdbOverview||'');
    $('#editor-status').textContent=item?'Mevcut katalog kaydı düzenleniyor.':'Yeni katalog kaydı oluşturuluyor.';
    $('#content-dialog').showModal();
  }
  async function saveContent(event){
    event.preventDefault();if(!canWrite())return;
    const existingId=$('#edit-id').value,existing=existingId?state.catalog.find(x=>String(x.id)===existingId):null;
    const type=$('#field-type').value;
    const record={...(existing||{}),id:existing?.id??('cv-'+Date.now()),title:$('#field-title').value.trim(),type,
      year:$('#field-year').value.trim(),rating:$('#field-rating').value.trim(),genre:$('#field-genre').value.trim(),
      category:$('#field-category').value.trim(),duration:$('#field-duration').value.trim(),country:$('#field-country').value.trim(),
      director:$('#field-director').value.trim(),platform:$('#field-platform').value.trim(),watchUrl:$('#field-watch').value.trim(),
      personalNote:$('#field-note').value.trim(),tmdbId:$('#field-tmdb').value.trim()?Number($('#field-tmdb').value):null,
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
  function renderHomepage(){
    const config=homepageConfig(),settings=config.settings;
    $('#hero-desktop-count').value=settings.desktopCount??10;
    $('#hero-mobile-count').value=settings.mobileCount??6;
    $('#hero-interval').value=settings.interval??6;
    $('#hero-autoplay').checked=settings.autoplay!==false;
    $('#hero-pause').checked=settings.pauseOnHover!==false;
    const current=new Map(config.heroSlides.map(x=>[String(x.id),x]));
    $('#hero-slide-list').innerHTML=state.catalog.map(item=>{
      const entry=current.get(String(item.id)),active=entry?entry.active!==false:false;
      return '<label class="hero-pick"><input type="checkbox" value="'+escapeHtml(item.id)+'" '+(active?'checked':'')+'><img src="'+escapeHtml(posterOf(item))+'" alt="" onerror="this.style.visibility=\'hidden\'"><span><b>'+escapeHtml(titleOf(item))+'</b><small>'+(isSeries(item)?'Dizi':'Film')+' · '+escapeHtml(yearOf(item))+'</small></span></label>';
    }).join('');
    const updateCount=()=>$('#hero-selected-count').textContent=$('#hero-slide-list input:checked').length+' yapım seçildi';
    $('#hero-slide-list input').forEach(input=>input.addEventListener('change',updateCount));
    updateCount();
    $('#homepage-config').textContent=JSON.stringify(config,null,2);
  }
  async function saveHomepage(event){
    event.preventDefault();if(!canWrite())return;
    const previous=homepageConfig(),byId=new Map(previous.heroSlides.map(x=>[String(x.id),x]));
    const ids=$$('#hero-slide-list input:checked').map(x=>x.value);
    const config={...previous,version:2,settings:{...previous.settings,
      desktopCount:Number($('#hero-desktop-count').value)||10,mobileCount:Number($('#hero-mobile-count').value)||6,
      interval:Number($('#hero-interval').value)||6,autoplay:$('#hero-autoplay').checked,pauseOnHover:$('#hero-pause').checked},
      heroSlides:ids.map(id=>({...byId.get(String(id)),id,active:true,headline:byId.get(String(id))?.headline||'',description:byId.get(String(id))?.description||''}))};
    const ok=await persist({...state.data,homepageConfig:config},'Vitrin ayarları kaydedildi.');
    if(ok)renderHomepage();
  }
  async function init(){
    $('#today-date').textContent=new Intl.DateTimeFormat('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
    $('#last-check').textContent=new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
    try{
      const apiResponse=await fetch('/api/catalog',{cache:'no-store',credentials:'same-origin'});
      if(!apiResponse.ok){const p=await apiResponse.json().catch(()=>({}));throw new Error(p.error||'Yönetim API hatası: '+apiResponse.status);}
      const payload=await apiResponse.json();state.data=payload.data;state.sha=payload.sha||null;state.apiEnabled=!!state.sha;
      if(!Array.isArray(state.data?.catalog))throw new Error('Katalog listesi bulunamadı.');
      state.catalog=state.data.catalog.filter(x=>x&&typeof x==='object');
      $('.environment').innerHTML='<i></i> KORUMALI YÖNETİM';
      const sessionResponse=await fetch('/api/session',{cache:'no-store',credentials:'same-origin'});
      if(!sessionResponse.ok)throw new Error('Yönetici oturumu doğrulanamadı.');
      const session=await sessionResponse.json();
      $('.notice b').textContent='Yönetim bağlantısı aktif';
      $('.notice p').textContent='Yönetici oturumu etkin: '+(session.email||'Yetkili hesap')+'. Değişiklikler güvenli API üzerinden GitHub kataloğuna kaydedilir.';
      $('.notice-tag').textContent='CONNECTED';
      $('#health-catalog').textContent='Bağlandı';$('#health-json').textContent='Geçerli';
      $('#health-auth').textContent='Aktif';$('#health-api').textContent='Aktif';
      $('#data-version').textContent=String(state.data.version??'Belirtilmemiş');
      $('#add-content').disabled=!state.apiEnabled;$('#catalog-add').disabled=!state.apiEnabled;
      updateMetrics();refreshYearFilter();renderRecent();renderCatalog();renderCollections();renderAnalytics();renderHomepage();
      $('#last-check').textContent=new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
      $('#homepage-config').textContent=JSON.stringify(state.data.homepageConfig||{},null,2);
    }catch(error){
      console.error('Admin yükleme hatası:',error);
      $('#health-catalog').textContent='Bağlantı yok';$('#health-json').textContent='Okunamadı';$('#metric-total').textContent='—';
      $('#recent-list').innerHTML='<div class="loading-line">'+escapeHtml(error.message||'Katalog yüklenemedi.')+'</div>';
      $('#catalog-rows').innerHTML='<tr><td colspan="6" class="empty-cell">Katalog yüklenemedi.</td></tr>';
      toast(error.message||'Katalog yüklenemedi.');
    }
  }
  $$('.nav-link').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.view)));
  $$('[data-go]').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.go)));
  $('#mobile-menu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
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
  init();
})();