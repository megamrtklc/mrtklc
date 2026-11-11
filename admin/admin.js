(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const state = { data:null, catalog:[], filtered:[], page:1, pageSize:12, view:'overview', sha:null };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const titleOf = item => item.title || item.tmdbTitle || item.originalTitle || item.tmdbOriginalTitle || 'Başlıksız yapım';
  const posterOf = item => item.image || item.poster || '';
  const isSeries = item => item.type === 'tv' || item.type === 'series' || item.type === 'dizi';
  const yearOf = item => Number(item.year || item.releaseYear || (item.tmdbReleaseDate || '').slice(0,4)) || '—';
  const toast = message => { const el=$('#toast'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2600); };
  function navigate(view){
    state.view=view;
    $$('.view').forEach(el=>el.classList.toggle('active',el.id===`view-${view}`));
    $$('.nav-link').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
    const active=$(`.nav-link[data-view="${view}"]`);
    $('#crumb-current').textContent=active?active.textContent.trim().replace(/\s+/g,' '):'Genel Bakış';
    $('#sidebar').classList.remove('open');
    if(view==='catalog') renderCatalog();
  }
  function renderRecent(){
    const recent=[...state.catalog].slice(-5).reverse();
    $('#recent-list').innerHTML=recent.length?recent.map(item=>`<div class="recent-item"><img class="poster-thumb" loading="lazy" src="${escapeHtml(posterOf(item))}" alt="" onerror="this.style.visibility='hidden'"><div class="recent-meta"><b>${escapeHtml(titleOf(item))}</b><small>${isSeries(item)?'Dizi':'Film'} · ${escapeHtml(yearOf(item))}</small></div><span class="rating-pill">★ ${escapeHtml(item.rating || item.tmdbRating || '—')}</span></div>`).join(''):'<div class="loading-line">Katalogda içerik bulunamadı.</div>';
  }
  function renderCatalog(){
    const query=$('#catalog-search').value.trim().toLocaleLowerCase('tr');
    const type=$('#type-filter').value, year=$('#year-filter').value;
    state.filtered=state.catalog.filter(item=>{
      const searchable=[titleOf(item),item.director,item.tmdbDirector,...(item.cast||[]).map(x=>typeof x==='string'?x:x.name),...(item.tmdbCast||[]).map(x=>x.name)].join(' ').toLocaleLowerCase('tr');
      return (!query||searchable.includes(query))&&(type==='all'||(type==='tv'?isSeries(item):!isSeries(item)))&&(year==='all'||String(yearOf(item))===year);
    });
    const pages=Math.max(1,Math.ceil(state.filtered.length/state.pageSize)); state.page=Math.min(state.page,pages);
    const start=(state.page-1)*state.pageSize;
    const rows=state.filtered.slice(start,start+state.pageSize);
    $('#catalog-rows').innerHTML=rows.length?rows.map(item=>`<tr><td><div class="catalog-title"><img loading="lazy" src="${escapeHtml(posterOf(item))}" alt="" onerror="this.style.visibility='hidden'"><div><b>${escapeHtml(titleOf(item))}</b><small>${escapeHtml(item.director||item.tmdbDirector||'Yönetmen bilgisi yok')}</small></div></div></td><td><span class="type-chip">${isSeries(item)?'Dizi':'Film'}</span></td><td>${escapeHtml(yearOf(item))}</td><td><span class="score">★ ${escapeHtml(item.rating||item.tmdbRating||'—')}</span></td><td>${escapeHtml(item.tmdbId||'—')}</td><td><button class="row-action" data-item="${escapeHtml(item.id||'')}" title="Kayıt bilgisi">Detay</button></td></tr>`).join(''):'<tr><td colspan="6" class="empty-cell">Aramanızla eşleşen kayıt bulunamadı.</td></tr>';
    $('#result-count').textContent=`${state.filtered.length.toLocaleString('tr-TR')} kayıt`;
    $('#page-info').textContent=`Sayfa ${state.page} / ${pages}`;
    $('#prev-page').disabled=state.page<=1; $('#next-page').disabled=state.page>=pages;
    $('#catalog-rows [data-item]').forEach(btn=>btn.addEventListener('click',()=>{const item=state.catalog.find(x=>String(x.id||'')===btn.dataset.item);if(item)openEditor(item);}));
  }
  function renderCollections(){
    const raw=state.data?.collections;
    const list=Array.isArray(raw)?raw:(raw&&typeof raw==='object'?Object.entries(raw).map(([key,value])=>({id:key,...(typeof value==='object'?value:{title:String(value)})})):[]);
    $('#metric-collections').textContent=list.length.toLocaleString('tr-TR');
    $('#collection-grid').innerHTML=list.length?list.map(item=>{const name=item.title||item.name||item.label||'İsimsiz koleksiyon';const ids=item.items||item.catalogIds||item.ids||[];return `<article class="collection-card"><h3>${escapeHtml(name)}</h3><p>${escapeHtml(item.description||'Özel içerik koleksiyonu')}</p><strong>${Array.isArray(ids)?ids.length:'—'}</strong><small>İçerik kaydı</small></article>`}).join(''):'<article class="panel-card empty-state"><span>▧</span><h2>Henüz koleksiyon bulunamadı</h2><p>Veri dosyasında koleksiyon tanımı yer almıyor.</p></article>';
  }
  function renderAnalytics(){
    const movies=state.catalog.filter(x=>!isSeries(x)).length, series=state.catalog.length-movies;
    const max=Math.max(movies,series,1);
    $('#type-chart').innerHTML=[['Film',movies],['Dizi',series]].map(([name,n])=>`<div class="bar-row"><span>${name}</span><div class="bar-track"><div class="bar-fill" style="width:${n/max*100}%"></div></div><b>${n}</b></div>`).join('');
    const counts={};state.catalog.forEach(x=>{const y=yearOf(x);if(y!=='—')counts[y]=(counts[y]||0)+1});
    const top=Object.entries(counts).sort((a,b)=>Number(b[0])-Number(a[0])).slice(0,8).sort((a,b)=>Number(a[0])-Number(b[0]));
    const maxYear=Math.max(1,...top.map(x=>x[1]));
    $('#year-chart').innerHTML=top.map(([y,n])=>`<div class="bar-row"><span>${escapeHtml(y)}</span><div class="bar-track"><div class="bar-fill" style="width:${n/maxYear*100}%"></div></div><b>${n}</b></div>`).join('')||'<small>Yıl verisi bulunamadı.</small>';
  }
  function setField(id,value){const el=$('#'+id);if(el)el.value=value??'';}
  function openEditor(item=null){
    if(!state.apiEnabled||!state.sha){toast('Düzenleme için korumalı Worker adresini açmalısınız.');return;}
    $('#content-form').reset();
    $('#edit-id').value=item?String(item.id??''):'';
    $('#editor-title').textContent=item?'İçeriği düzenle':'Yeni içerik';
    setField('field-title',item?.title||'');
    setField('field-type',item?.type==='tv'?'tv':'movie');
    setField('field-year',item?.year||'');
    setField('field-rating',item?.rating||'');
    setField('field-genre',item?.genre||'');
    setField('field-category',item?.category||'');
    setField('field-duration',item?.duration||'');
    setField('field-country',item?.country||'');
    setField('field-director',item?.director||'');
    setField('field-platform',item?.platform||'');
    setField('field-image',item?.image||'');
    setField('field-backdrop',item?.backdrop||'');
    setField('field-trailer',item?.trailerUrl||'');
    setField('field-seasons',item?.seasons||'');
    setField('field-episodes',item?.episodes||'');
    setField('field-desc',item?.desc||'');
    $('#editor-status').textContent=item?'Mevcut katalog kaydı düzenleniyor.':'Yeni katalog kaydı oluşturuluyor.';
    $('#content-dialog').showModal();
  }
  async function saveContent(event){
    event.preventDefault();
    if(!state.apiEnabled||!state.sha){toast('Güvenli katalog bağlantısı bulunamadı.');return;}
    const save=$('#save-content');save.disabled=true;save.textContent='Kaydediliyor…';
    $('#editor-status').textContent='GitHub kataloğuna güvenli bağlantı kuruluyor…';
    try{
      const existingId=$('#edit-id').value;
      const existing=existingId?state.catalog.find(item=>String(item.id??'')===existingId):null;
      const type=$('#field-type').value;
      const record={
        ...(existing||{}),
        id:existing?.id??('cv-'+Date.now()),
        title:$('#field-title').value.trim(),
        type,
        year:$('#field-year').value.trim(),
        rating:$('#field-rating').value.trim(),
        genre:$('#field-genre').value.trim(),
        category:$('#field-category').value.trim(),
        duration:$('#field-duration').value.trim(),
        country:$('#field-country').value.trim(),
        director:$('#field-director').value.trim(),
        platform:$('#field-platform').value.trim(),
        image:$('#field-image').value.trim(),
        backdrop:$('#field-backdrop').value.trim(),
        trailerUrl:$('#field-trailer').value.trim(),
        desc:$('#field-desc').value.trim()
      };
      if(type==='tv'){
        record.seasons=Number($('#field-seasons').value)||1;
        record.episodes=Number($('#field-episodes').value)||0;
      }else{
        delete record.seasons;delete record.episodes;
      }
      const nextData={...state.data,catalog:[...state.catalog]};
      const index=nextData.catalog.findIndex(item=>String(item.id??'')===String(record.id));
      if(index>=0)nextData.catalog[index]=record;else nextData.catalog.push(record);
      const response=await fetch('/api/catalog',{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({data:nextData,sha:state.sha})});
      const result=await response.json().catch(()=>({}));
      if(response.status===409){throw new Error('Katalog başka bir yerde değişmiş. Sayfayı yenileyip tekrar deneyin.');}
      if(!response.ok)throw new Error(result.error||'Kayıt yayınlanamadı.');
      state.data=nextData;state.catalog=nextData.catalog;state.sha=result.sha;
      $('#metric-total').textContent=state.catalog.length.toLocaleString('tr-TR');
      $('#metric-movies').textContent=state.catalog.filter(x=>!isSeries(x)).length.toLocaleString('tr-TR');
      $('#metric-series').textContent=state.catalog.filter(isSeries).length.toLocaleString('tr-TR');
      $('#nav-count').textContent=state.catalog.length.toLocaleString('tr-TR');
      renderRecent();renderCatalog();renderCollections();renderAnalytics();
      $('#homepage-config').textContent=JSON.stringify(state.data.homepageConfig??{},null,2);
      $('#content-dialog').close();toast('Katalog kaydı GitHub deposuna yayınlandı.');
    }catch(error){
      $('#editor-status').textContent=error.message;
      toast(error.message);
    }finally{
      save.disabled=false;save.textContent='Kaydet ve yayınla';
    }
  }
  async function init(){
    $('#today-date').textContent=new Intl.DateTimeFormat('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
    $('#last-check').textContent=new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
    try{
      let data, response;
      const apiResponse=await fetch('/api/catalog',{cache:'no-store',credentials:'same-origin'});
      if(apiResponse.ok){
        const apiPayload=await apiResponse.json();
        data=apiPayload.data;
        state.sha=apiPayload.sha||null;
        state.apiEnabled=!!state.sha;
        $('#add-content').disabled=!state.apiEnabled;
        $('#add-content').title=state.apiEnabled?'Yeni film veya dizi ekle':'Katalog bağlantısı gerekli';
        $('.environment').innerHTML='<i></i> KORUMALI YÖNETİM';
        const sessionResponse=await fetch('/api/session',{cache:'no-store',credentials:'same-origin'});
        if(!sessionResponse.ok)throw new Error('Yönetici oturumu doğrulanamadı.');
        const session=await sessionResponse.json();
        $('.notice p').textContent='Yönetici oturumu etkin: '+(session.email||'Yetkili hesap')+'. Katalog sunucu üzerinden güvenli biçimde okunuyor.';
        $('.notice-tag').textContent='PROTECTED';
      }else if(apiResponse.status===404){
        response=await fetch('../filmvediziler.json',{cache:'no-store'});
        if(!response.ok)throw new Error('HTTP '+response.status);
        data=await response.json();
        $('.notice p').textContent='Bu, GitHub Pages üzerinde salt okunur önizlemedir. Gerçek yönetim işlemleri için Cloudflare Access korumalı Worker adresini kullanın.';
        $('.notice-tag').textContent='READ ONLY';
      }else{
        const apiError=await apiResponse.json().catch(()=>({}));
        throw new Error(apiError.error||('Yönetim API hatası: '+apiResponse.status));
      }
      const catalog=Array.isArray(data)?data:data?.catalog;
      if(!Array.isArray(catalog))throw new Error('Katalog listesi bulunamadı');
      state.data=data;state.catalog=catalog.filter(x=>x&&typeof x==='object');
      $('#metric-total').textContent=state.catalog.length.toLocaleString('tr-TR');
      $('#metric-movies').textContent=state.catalog.filter(x=>!isSeries(x)).length.toLocaleString('tr-TR');
      $('#metric-series').textContent=state.catalog.filter(isSeries).length.toLocaleString('tr-TR');
      $('#nav-count').textContent=state.catalog.length.toLocaleString('tr-TR');
      $('#health-catalog').textContent='Bağlandı';$('#health-json').textContent='Geçerli';
      $('#data-version').textContent=String(data.version??'Belirtilmemiş');
      const years=[...new Set(state.catalog.map(yearOf).filter(y=>y!=='—'))].sort((a,b)=>Number(b)-Number(a));
      $('#year-filter').insertAdjacentHTML('beforeend',years.map(y=>`<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`).join(''));
      renderRecent();renderCatalog();renderCollections();renderAnalytics();
      $('#homepage-config').textContent=JSON.stringify(data.homepageConfig??{},null,2);
    }catch(error){
      console.error('Yönetim paneli katalog yükleme hatası:',error);
      $('#health-catalog').textContent='Bağlantı yok';$('#health-catalog').style.color='#c65b5b';
      $('#health-json').textContent='Okunamadı';$('#metric-total').textContent='—';
      $('#recent-list').innerHTML='<div class="loading-line">Katalog yüklenemedi. Ana site veri yolunu kontrol edin.</div>';
      $('#catalog-rows').innerHTML='<tr><td colspan="6" class="empty-cell">Katalog yüklenemedi.</td></tr>';
      $('#homepage-config').textContent='Yapılandırma okunamadı.';
    }
  }
  $$('.nav-link').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.view)));
  $$('[data-go]').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.go)));
  $('#mobile-menu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
  $('#logout-button')?.addEventListener('click',async()=>{try{await fetch('/api/logout',{method:'POST',credentials:'same-origin'});}finally{window.location.reload();}});
  $('#catalog-search').addEventListener('input',()=>{state.page=1;renderCatalog()});
  $('#type-filter').addEventListener('change',()=>{state.page=1;renderCatalog()});
  $('#year-filter').addEventListener('change',()=>{state.page=1;renderCatalog()});
  $('#prev-page').addEventListener('click',()=>{state.page=Math.max(1,state.page-1);renderCatalog()});
  $('#next-page').addEventListener('click',()=>{state.page++;renderCatalog()});
  $('#add-content').addEventListener('click',()=>openEditor());
  $('#content-form').addEventListener('submit',saveContent);
  $('#close-editor').addEventListener('click',()=>$('#content-dialog').close());
  $('#cancel-editor').addEventListener('click',()=>$('#content-dialog').close());
  init();
})();