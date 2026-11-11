(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const state = { data:null, catalog:[], filtered:[], page:1, pageSize:12, view:'overview' };
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
    $$('#catalog-rows [data-item]').forEach(btn=>btn.addEventListener('click',()=>{const item=state.catalog.find(x=>String(x.id||'')===btn.dataset.item);if(item)toast(titleOf(item)+' · düzenleme bağlantısı henüz etkin değil');}));
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
  async function init(){
    $('#today-date').textContent=new Intl.DateTimeFormat('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
    $('#last-check').textContent=new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
    try{
      const response=await fetch('../filmvediziler.json',{cache:'no-store'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const data=await response.json();
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
  $('#catalog-search').addEventListener('input',()=>{state.page=1;renderCatalog()});
  $('#type-filter').addEventListener('change',()=>{state.page=1;renderCatalog()});
  $('#year-filter').addEventListener('change',()=>{state.page=1;renderCatalog()});
  $('#prev-page').addEventListener('click',()=>{state.page=Math.max(1,state.page-1);renderCatalog()});
  $('#next-page').addEventListener('click',()=>{state.page++;renderCatalog()});
  init();
})();