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
  function canWrite(){ if(!state.apiEnabled||!state.sha){toast('Katalog şu anda salt okunur. GitHub erişim bağlantısı doğrulanınca düzenleme açılacak.');return false;} return true; }
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
    if(view==='watch-layout')renderWatchLayout();
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
      state.sha=result.sha;refreshYearFilter();updateMetrics();renderRecent();renderCatalog();renderCollections();renderAnalytics();renderHomepage();renderOverviewInsights();
      $('#homepage-config').textContent=JSON.stringify(state.data.homepageConfig||{},null,2);
      renderWatchLayout();renderAdminProfile();
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
    const left=Array.isArray(saved.left)?saved.left.filter((id,index)=>watchCardIds.includes(id)&&saved.left.indexOf(id)===index):[];
    const right=Array.isArray(saved.right)?saved.right.filter((id,index)=>watchCardIds.includes(id)&&saved.right.indexOf(id)===index):[];
    const used=new Set([...left,...right]);
    watchCardIds.forEach(id=>{if(!used.has(id)){(watchCardDefinitions[id].defaultSide==='left'?left:right).push(id);used.add(id);}});
    return {left,right};
  }
  function watchDemoSample(){
    return state.catalog.find(item=>isSeries(item)===(watchDemoType==='tv'))||state.catalog[0]||null;
  }
  function renderWatchDemo(config){
    const sample=watchDemoSample();
    const title=sample?titleOf(sample):(watchDemoType==='tv'?'Örnek Dizi':'Örnek Film');
    const poster=sample?posterOf(sample):'';
    const year=sample?yearOf(sample):'2026';
    const rating=sample?(sample.rating||sample.tmdbRating||'8.2'):'8.2';
    const description=sample?(sample.desc||sample.tmdbOverview||'Sürükleyici bir hikâye, unutulmaz karakterler ve sinematik bir deneyim.'):'Sürükleyici bir hikâye, unutulmaz karakterler ve sinematik bir deneyim.';
    const labels={
      player:'<div class="demo-player-screen">'+(poster?'<img src="'+escapeHtml(poster)+'" alt="">':'')+'<div class="demo-player-overlay"><span class="demo-play-icon">▶</span><b>'+escapeHtml(title)+'</b><small>OYNATMAK İÇİN TIKLA</small></div><span class="demo-player-controls">▶　 ━━━━━━━━━━━━━　 ⚙ ⛶</span></div>',
      season:'<div class="demo-card-head">SEZON SEÇİMİ <b>1. Sezon　⌄</b></div><p class="demo-muted">Sezonlar arasında geçiş yap</p>',
      episodes:'<div class="demo-card-head">BÖLÜMLER <b>12 bölüm</b></div><div class="demo-episode-row"><span>01</span><b>Yeni bir başlangıç</b><small>48 dk</small></div><div class="demo-episode-row"><span>02</span><b>İlk karşılaşma</b><small>52 dk</small></div>',
      synopsis:'<div class="demo-title-line"><b>'+escapeHtml(title)+'</b><span>★ '+escapeHtml(rating)+'</span></div><p class="demo-muted">'+escapeHtml(description.slice(0,170))+(description.length>170?'…':'')+'</p><small class="demo-meta">'+escapeHtml(year)+'　·　'+(watchDemoType==='tv'?'DİZİ':'FİLM')+'　·　 Dram / Gerilim</small>',
      reviews:'<div class="demo-card-head">YORUMLAR <b>＋ Yorum yaz</b></div><p class="demo-muted">İzleyici değerlendirmeleri ve yorumlar burada görünür.</p>',
      credits:'<div class="demo-card-head">YAPIM KÜNYESİ</div><div class="demo-detail-row"><span>Yönetmen</span><b>'+(sample?escapeHtml(sample.director||sample.tmdbDirector||'—'):'Örnek Yönetmen')+'</b></div><div class="demo-detail-row"><span>Yıl</span><b>'+escapeHtml(year)+'</b></div><div class="demo-detail-row"><span>Tür</span><b>Drama / Gerilim</b></div><div class="demo-detail-row"><span>Tür</span><b>'+(watchDemoType==='tv'?'Dizi':'Film')+'</b></div>',
      cast:'<div class="demo-card-head">OYUNCU KADROSU</div><div class="demo-cast-row"><i>AK</i><span><b>Oyuncu adı</b><small>Karakter adı</small></span><i>MY</i><span><b>Oyuncu adı</b><small>Karakter adı</small></span></div>',
      similar:'<div class="demo-card-head">BENZER YAPIMLAR</div><div class="demo-similar-row"><span>▣</span><span>Önerilen yapımlar　 ·　 Keşfet</span></div>'
    };
    const renderColumn=(side)=>config[side].filter(id=>watchDemoType==='tv'||(id!=='season'&&id!=='episodes')).map(id=>'<div class="watch-demo-card demo-'+id+'" data-demo-card="'+id+'"><div class="demo-card-label">'+escapeHtml(watchCardDefinitions[id].label)+'</div>'+labels[id]+'</div>').join('');
    $('#watch-demo-left').innerHTML=renderColumn('left')||'<div class="watch-demo-empty">Bu sütunda kart yok. Soldaki listeden kart taşı.</div>';
    $('#watch-demo-right').innerHTML=renderColumn('right')||'<div class="watch-demo-empty">Bu sütunda kart yok. Soldaki listeden kart taşı.</div>';
    $('#watch-demo-left').classList.toggle('is-empty',!config.left.length);
    $('#watch-demo-right').classList.toggle('is-empty',!config.right.length);
    $$('[data-demo-type]').forEach(button=>button.classList.toggle('active',button.dataset.demoType===watchDemoType));
  }
  function renderWatchLayout(){
    const config=watchLayoutConfig();
    for(const side of ['left','right']){
      const root=$('#watch-'+side+'-list');
      root.innerHTML=config[side].map((id,index)=>{
        const item=watchCardDefinitions[id],target=side==='left'?'right':'left';
        const action=side==='left'?'Sağ alana taşı':'Sol alana taşı';
        return '<div class="watch-order-item" data-card="'+id+'" draggable="true" title="Sürükleyerek sıralayabilir veya diğer sütuna taşıyabilirsin">'+
          '<span class="watch-order-number">'+(index+1)+'</span>'+
          '<div class="watch-order-copy"><b>'+escapeHtml(item.label)+'</b><small>'+escapeHtml(item.description)+'</small></div>'+
          '<div class="watch-order-actions">'+
          '<button type="button" class="watch-order-move" data-move-direction="-1" '+(index===0?'disabled':'')+' aria-label="Yukarı taşı" title="Yukarı taşı">↑</button>'+
          '<button type="button" class="watch-order-move" data-move-direction="1" '+(index===config[side].length-1?'disabled':'')+' aria-label="Aşağı taşı" title="Aşağı taşı">↓</button>'+
          '<button type="button" class="watch-order-transfer" data-target-side="'+target+'" aria-label="'+action+'" title="'+action+'">'+(side==='left'?'→':'←')+' <span>'+action+'</span></button>'+
          '</div></div>';
      }).join('')||'<div class="watch-demo-empty">Bu sütunda kart bulunmuyor.</div>';
      root.classList.remove('is-drop-target');
    }
    renderWatchDemo(config);
    $('#watch-demo-left').setAttribute('aria-live','polite');
    $('#watch-demo-right').setAttribute('aria-live','polite');
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
    $$('#hero-slide-list input').forEach(input=>input.addEventListener('change',updateCount));
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
    const formattedDate=new Intl.DateTimeFormat('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());$('#today-date').textContent=formattedDate;const dashboardDate=$('#dashboard-date');if(dashboardDate)dashboardDate.textContent=formattedDate;
    $('#last-check').textContent=new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
    try{
      const apiResponse=await fetch('/api/catalog',{cache:'no-store',credentials:'same-origin'});
      if(!apiResponse.ok){const p=await apiResponse.json().catch(()=>({}));throw new Error(p.error||'Yönetim API hatası: '+apiResponse.status);}
      const payload=await apiResponse.json();state.data=payload.data;state.sha=payload.sha||null;state.apiEnabled=!!state.sha&&payload.writable!==false;
      if(!Array.isArray(state.data?.catalog))throw new Error('Katalog listesi bulunamadı.');
      state.catalog=state.data.catalog.filter(x=>x&&typeof x==='object');
      $('.environment').innerHTML='<i></i> KORUMALI YÖNETİM';
      const sessionResponse=await fetch('/api/session',{cache:'no-store',credentials:'same-origin'});
      if(!sessionResponse.ok)throw new Error('Yönetici oturumu doğrulanamadı.');
      const session=await sessionResponse.json();
      $('.notice b').textContent='Yönetim bağlantısı aktif';
      $('.notice p').textContent=payload.readOnlyReason||('Yönetici oturumu etkin: '+(session.email||'Yetkili hesap')+'. Değişiklikler güvenli API üzerinden GitHub kataloğuna kaydedilir.');
      $('.notice-tag').textContent='CONNECTED';
      $('#health-catalog').textContent='Bağlandı';$('#health-json').textContent='Geçerli';
      $('#health-auth').textContent='Aktif';$('#health-api').textContent='Aktif';
      $('#data-version').textContent=String(state.data.version??'Belirtilmemiş');
      $('#add-content').disabled=!state.apiEnabled;$('#catalog-add').disabled=!state.apiEnabled;$('#collection-add').disabled=!state.apiEnabled;
      updateMetrics();refreshYearFilter();renderRecent();renderCatalog();renderCollections();renderAnalytics();renderHomepage();renderOverviewInsights();renderAdminProfile();renderWatchLayout();loadProfilePhoto();
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
  const shell=$('.app-shell');
  if(window.innerWidth>760&&localStorage.getItem('cv-admin-sidebar-collapsed')==='1')shell.classList.add('sidebar-collapsed');
  $('#sidebar-toggle').addEventListener('click',()=>{
    shell.classList.toggle('sidebar-collapsed');
    const collapsed=shell.classList.contains('sidebar-collapsed');
    localStorage.setItem('cv-admin-sidebar-collapsed',collapsed?'1':'0');
    $('#sidebar-toggle').title=collapsed?'Menüyü genişlet':'Menüyü daralt';
    $('#sidebar-toggle').setAttribute('aria-label',collapsed?'Menüyü genişlet':'Menüyü daralt');
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
  $('#watch-layout-save').addEventListener('click',saveWatchLayout);
  let draggedWatchCard=null;
  ['left','right'].forEach(side=>{
    const list=$('#watch-'+side+'-list');
    list.addEventListener('click',event=>{
      const item=event.target.closest('[data-card]');
      if(!item)return;
      const id=item.dataset.card;
      const transfer=event.target.closest('[data-target-side]');
      if(transfer){moveWatchCard(side,id,transfer.dataset.targetSide);return;}
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
  init();
})();