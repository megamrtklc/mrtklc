const TYPE_PATHS = new Set(["film", "dizi", "oyuncu", "yonetmen", "izle"]);
const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[ch]);
const clean = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
const array = (value) => Array.isArray(value) ? value : [];
const titleOf = (item) => clean(item.title || item.tmdbTitle || item.originalTitle || item.tmdbOriginalTitle || "İsimsiz yapım");
const typeOf = (item) => item.type === "tv" || item.type === "series" ? "tv" : "movie";
const itemId = (item) => String(item.id != null ? item.id : item.tmdbId != null ? item.tmdbId : titleOf(item));
const posterOf = (item) => clean(item.poster || item.tmdbPoster || item.image);
const yearOf = (item) => clean(item.year || item.tmdbReleaseDate || item.releaseDate).slice(0, 4);
const descriptionOf = (item) => clean(item.desc || item.tmdbOverview || item.overview || "");
const genresOf = (item) => clean(item.tmdbGenres || item.genre || item.category).split(/\s*\/\s*|,\s*/).map(clean).filter(Boolean);
const ratingOf = (item) => { const n = Number.parseFloat(item.tmdbRating != null ? item.tmdbRating : item.rating); return Number.isFinite(n) && n > 0 ? n : null; };
const TURKISH = { "ı":"i", "İ":"i", "ğ":"g", "Ğ":"g", "ü":"u", "Ü":"u", "ş":"s", "Ş":"s", "ö":"o", "Ö":"o", "ç":"c", "Ç":"c" };
function slugify(value) {
  let s = Array.from(clean(value), (ch) => TURKISH[ch] || ch).join("");
  s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "icerik";
}
function uniqueSlugs(entries, getName, getId) {
  const counts = new Map();
  for (const entry of entries) { const base = slugify(getName(entry)); counts.set(base, (counts.get(base) || 0) + 1); }
  const used = new Set();
  return new Map(entries.map((entry, index) => {
    const base = slugify(getName(entry));
    let slug = base;
    if (counts.get(base) > 1 || used.has(slug)) slug = base + "-" + slugify(getId(entry) || String(index + 1));
    let candidate = slug, serial = 2;
    while (used.has(candidate)) candidate = slug + "-" + serial++;
    used.add(candidate);
    return [entry, candidate];
  }));
}
function directorsOf(item) {
  const raw = clean(item.tmdbDirector || item.director);
  if (!raw || raw.toLocaleLowerCase("tr") === "bilinmiyor") return [];
  return raw.split(/\s*[,;|]\s*/).map(clean).filter(Boolean);
}
function shell({ title, description, canonical, image, schema, body, robots }) {
  const imageMeta = image ? '<meta property="og:image" content="' + esc(image) + '">' : "";
  return '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(title) + '</title><meta name="description" content="' + esc(description) + '">' +
    '<meta name="robots" content="' + esc(robots || (new URL(canonical).hostname.endsWith(".workers.dev") ? "noindex,nofollow" : "index,follow,max-image-preview:large")) + '">' +
    '<link rel="canonical" href="' + esc(canonical) + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="MRTSINEMA">' +
    '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(description) + '">' + imageMeta +
    '<meta name="twitter:card" content="' + (image ? "summary_large_image" : "summary") + '">' +
    '<script type="application/ld+json">' + JSON.stringify(schema).replace(/</g, "\\u003c") + '</script>' +
    '<style>:root{color-scheme:dark;--bg:#0b0b0d;--panel:#151518;--line:#2b2926;--text:#f5f2ed;--muted:#aaa49b;--gold:#d6ad62;--link:#e8c47d}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 50% -20%,#332819 0,transparent 46%),var(--bg);color:var(--text);font:16px/1.65 system-ui,-apple-system,Segoe UI,sans-serif}a{color:var(--link);text-decoration:none}a:hover{text-decoration:underline}.wrap{width:min(1100px,calc(100% - 36px));margin:auto}header{border-bottom:1px solid var(--line);background:#0b0b0de8}.top{height:68px;display:flex;align-items:center;justify-content:space-between;gap:18px}.brand{font-size:24px;font-weight:900;letter-spacing:.08em;color:var(--text)}.brand span{color:var(--gold)}.back{font-size:14px;color:var(--muted)}main{padding:34px 0 64px}.crumb{font-size:13px;color:var(--muted);margin-bottom:22px}.hero{display:grid;grid-template-columns:minmax(180px,270px) 1fr;gap:32px;align-items:start}.poster{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:14px;background:#222;box-shadow:0 18px 50px #0008}.placeholder{aspect-ratio:2/3;border-radius:14px;background:var(--panel);display:grid;place-items:center;color:var(--muted)}h1{font-size:clamp(30px,5vw,48px);line-height:1.12;margin:0 0 12px}.eyebrow{color:var(--gold);font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.meta{display:flex;flex-wrap:wrap;gap:9px 16px;color:var(--muted);font-size:14px;margin:18px 0}.rating{color:var(--gold);font-weight:800}.summary{font-size:17px;color:#d6d1c9;max-width:760px}.panel{margin-top:30px;padding:22px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(145deg,#19191c,#111113)}h2{font-size:20px;margin:0 0 16px}.chips{display:flex;flex-wrap:wrap;gap:9px}.chip{display:inline-flex;padding:7px 11px;border:1px solid #484034;border-radius:999px;background:#211d17;font-size:13px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:16px}.card{display:block;color:var(--text);min-width:0}.card img{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:10px;background:#222}.card strong{display:block;margin-top:8px;font-size:14px;line-height:1.35}.card small{display:block;color:var(--muted)}.people{display:flex;flex-wrap:wrap;gap:12px}.person{display:flex;align-items:center;gap:10px;min-width:190px;padding:9px;border:1px solid var(--line);border-radius:12px;background:#111}.person img{width:48px;height:60px;object-fit:cover;border-radius:7px;background:#252525}.person span{display:block;color:var(--muted);font-size:12px}.cta{display:inline-flex;margin-top:8px;padding:11px 18px;border-radius:999px;background:linear-gradient(135deg,#e5bd73,#b8873d);color:#17120b;font-weight:800;font-size:14px}footer{border-top:1px solid var(--line);padding:22px 0;color:var(--muted);font-size:13px}@media(max-width:650px){.wrap{width:min(100% - 26px,1100px)}.top{height:60px}.hero{grid-template-columns:112px 1fr;gap:16px}main{padding-top:24px}.summary{font-size:15px}.panel{padding:16px;margin-top:22px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.person{min-width:100%}}</style>' +
    '</head><body><header><div class="wrap top"><a class="brand" href="/">MRT<span>SINEMA</span></a><a class="back" href="/">Ana sayfaya dön →</a></div></header><main class="wrap">' + body + '</main><footer><div class="wrap">© ' + new Date().getFullYear() + ' MRTSINEMA · Film ve dizi arşivi</div></footer></body></html>';
}
async function loadCatalog(env, request) {
  const response = await env.ASSETS.fetch(new Request(new URL("/filmvediziler.json", request.url)));
  if (!response.ok) throw new Error("catalog.json yüklenemedi: " + response.status);
  const source = await response.json();
  const catalog = Array.isArray(source) ? source : source.catalog;
  if (!Array.isArray(catalog)) throw new Error("Katalog listesi bulunamadı.");
  return catalog.filter((item) => item && itemId(item));
}
function buildIndex(catalog) {
  const films = catalog.filter((item) => typeOf(item) === "movie");
  const series = catalog.filter((item) => typeOf(item) === "tv");
  const itemSlugs = new Map([...uniqueSlugs(films, titleOf, itemId), ...uniqueSlugs(series, titleOf, itemId)]);
  const actorsById = new Map(), directorsByName = new Map();
  for (const item of catalog) {
    for (const [position, cast] of array(item.tmdbCast).entries()) {
      if (!cast || !cast.id || !clean(cast.name)) continue;
      const id = String(cast.id);
      if (!actorsById.has(id)) actorsById.set(id, { id, name: clean(cast.name), profile: clean(cast.profile), works: [], lead: false });
      const actor = actorsById.get(id);
      if (!actor.profile && cast.profile) actor.profile = cast.profile;
      if (position < 3) actor.lead = true;
      actor.works.push({ item, character: clean(cast.character) });
    }
    for (const name of directorsOf(item)) {
      const key = name.toLocaleLowerCase("tr");
      if (!directorsByName.has(key)) directorsByName.set(key, { name, works: [] });
      directorsByName.get(key).works.push(item);
    }
  }
  const actors = [...actorsById.values()].filter((person) => person.lead || new Set(person.works.map((entry) => itemId(entry.item))).size >= 2).sort((a,b) => a.name.localeCompare(b.name,"tr"));
  const directors = [...directorsByName.values()].sort((a,b) => a.name.localeCompare(b.name,"tr"));
  const actorSlugs = uniqueSlugs(actors, (p) => p.name, (p) => p.id);
  const directorSlugs = uniqueSlugs(directors, (p) => p.name, (p) => p.name);
  const watchSlugs = uniqueSlugs(catalog, titleOf, itemId);
  return { catalog, itemSlugs, actors, directors, actorSlugs, directorSlugs, watchSlugs };
}
function itemPath(item, index) { return "/" + (typeOf(item) === "tv" ? "dizi" : "film") + "/" + index.itemSlugs.get(item) + "/"; }
function renderItem(item, index, origin) {
  const title = titleOf(item), year = yearOf(item), desc = descriptionOf(item) || title + " yapımının oyuncu kadrosunu ve türünü keşfedin.";
  const shortDesc = desc.length > 158 ? desc.slice(0,155).replace(/\s+\S*$/, "") + "…" : desc;
  const path = itemPath(item,index), canonical = origin + path, poster = posterOf(item), rating = ratingOf(item), genres = genresOf(item), cast = array(item.tmdbCast).filter((p) => p && p.id && clean(p.name)).slice(0,6);
  const directors = directorsOf(item);
  const castHtml = cast.map((person) => {
    const slugEntry = index.actors.find((actor) => actor.id === String(person.id));
    const href = slugEntry ? "/oyuncu/" + index.actorSlugs.get(slugEntry) + "/" : "";
    return '<' + (href ? 'a href="' + href + '"' : 'div') + ' class="person">' + (person.profile ? '<img loading="lazy" src="' + esc(person.profile) + '" alt="' + esc(person.name) + '">' : "") + '<div><strong>' + esc(person.name) + '</strong><span>' + esc(person.character || "Oyuncu") + '</span></div></' + (href ? "a" : "div") + '>';
  }).join("");
  const directorHtml = directors.map((name) => {
    const p = index.directors.find((d) => d.name.toLocaleLowerCase("tr") === name.toLocaleLowerCase("tr"));
    return p ? '<a class="chip" href="/yonetmen/' + esc(index.directorSlugs.get(p)) + '/">' + esc(name) + '</a>' : "";
  }).join("");
  const body = '<nav class="crumb"><a href="/">Ana sayfa</a> / ' + (typeOf(item) === "tv" ? "Diziler" : "Filmler") + ' / ' + esc(title) + '</nav><section class="hero">' +
    (poster ? '<img class="poster" src="' + esc(poster) + '" alt="' + esc(title) + ' afişi">' : '<div class="placeholder">Afiş bulunamadı</div>') +
    '<div><div class="eyebrow">' + (typeOf(item) === "tv" ? "Dizi" : "Film") + ' detayları</div><h1>' + esc(title) + '</h1><div class="meta">' +
    (year ? '<span>' + esc(year) + '</span>' : "") + (rating ? '<span class="rating">★ ' + rating.toFixed(1) + ' / 10 <small>TMDB</small></span>' : "") +
    genres.map((g) => '<span>' + esc(g) + '</span>').join("") + ((item.duration || item.tmdbRuntime) ? '<span>' + esc(item.duration || item.tmdbRuntime) + '</span>' : "") +
    '</div><p class="summary">' + esc(desc) + '</p><a class="cta" href="/#' + '/watch/' + encodeURIComponent(itemId(item)) + '">▶ MRTSINEMA uygulamasında izle</a>' +
    (directorHtml ? '<div class="meta"><strong>Yönetmen:</strong> ' + directorHtml + '</div>' : "") + '</div></section>' +
    (castHtml ? '<section class="panel"><h2>Oyuncular</h2><div class="people">' + castHtml + '</div></section>' : "") +
    '<section class="panel"><h2>Yapım hakkında</h2><p>' + esc(desc) + '</p><div class="chips"><span class="chip">' + (typeOf(item) === "tv" ? "Dizi" : "Film") + '</span>' +
    (year ? '<span class="chip">Yapım yılı: ' + esc(year) + '</span>' : "") + genres.map((g) => '<span class="chip">' + esc(g) + '</span>').join("") + '</div></section>';
  const schema = { "@context":"https://schema.org", "@type":typeOf(item) === "tv" ? "TVSeries" : "Movie", name:title, description:desc, url:canonical,
    ...(poster ? {image:poster} : {}), ...(year ? {datePublished:year} : {}), ...(genres.length ? {genre:genres} : {}),
    ...(directors.length ? {director:directors.map((name) => ({"@type":"Person",name}))} : {}),
    ...(cast.length ? {actor:cast.map((p) => ({"@type":"Person",name:p.name,...(index.actors.some((a) => a.id === String(p.id)) ? {url:origin + "/oyuncu/" + index.actorSlugs.get(index.actors.find((a) => a.id === String(p.id))) + "/"} : {})}))} : {}),
    ...(rating && Number(item.tmdbVoteCount || item.voteCount) > 0 ? {aggregateRating:{"@type":"AggregateRating",ratingValue:rating,bestRating:10,ratingCount:Number(item.tmdbVoteCount || item.voteCount)}} : {}) };
  return shell({title:title + (year ? " (" + year + ")" : "") + " | MRTSINEMA",description:shortDesc,canonical,image:poster,schema,body});
}
function renderActor(person, index, origin) {
  const path = "/oyuncu/" + index.actorSlugs.get(person) + "/", canonical = origin + path;
  const works = [...new Map(person.works.map((entry) => [itemId(entry.item),entry])).values()].sort((a,b) => (Number(yearOf(b.item)) || 0) - (Number(yearOf(a.item)) || 0));
  const cards = works.slice(0,48).map((entry) => {
    const item = entry.item, poster = posterOf(item);
    return '<a class="card" href="' + itemPath(item,index) + '">' + (poster ? '<img loading="lazy" src="' + esc(poster) + '" alt="' + esc(titleOf(item)) + ' afişi">' : '<div class="placeholder">Afiş yok</div>') +
      '<strong>' + esc(titleOf(item)) + '</strong><small>' + esc(yearOf(item)) + (typeOf(item) === "tv" ? " · Dizi" : " · Film") + '</small>' +
      (entry.character ? '<small>Canlandırdığı karakter: ' + esc(entry.character) + '</small>' : "") + '</a>';
  }).join("");
  const body = '<nav class="crumb"><a href="/">Ana sayfa</a> / Oyuncular / ' + esc(person.name) + '</nav><section class="hero">' +
    (person.profile ? '<img class="poster" src="' + esc(person.profile.replace("/w185/","/w342/")) + '" alt="' + esc(person.name) + '">' : '<div class="placeholder">Profil fotoğrafı yok</div>') +
    '<div><div class="eyebrow">Oyuncu profili</div><h1>' + esc(person.name) + '</h1><p class="summary">' + esc(person.name) + ' filmleri ve dizileri. MRTSINEMA kataloğunda yer alan yapımları ve canlandırdığı karakterleri keşfedin.</p>' +
    '<a class="cta" href="/#/actor/' + encodeURIComponent(person.id) + '">Uygulamada oyuncu profilini aç →</a><div class="meta"><span>' + works.length + ' katalog yapımı</span></div></div></section>' +
    '<section class="panel"><h2>Katalogdaki yapımları</h2><div class="grid">' + cards + '</div></section>';
  const personId = canonical + "#person";
  const schema = {"@context":"https://schema.org","@type":"ProfilePage",url:canonical,mainEntity:{"@id":personId,"@type":"Person",name:person.name,url:canonical,jobTitle:"Actor",...(person.profile ? {image:person.profile} : {}),subjectOf:works.map((entry) => ({"@type":typeOf(entry.item) === "tv" ? "TVSeries" : "Movie",name:titleOf(entry.item),url:origin + itemPath(entry.item,index),actor:{"@type":"PerformanceRole",actor:{"@id":personId},...(entry.character ? {characterName:entry.character} : {})}}))}};
  return shell({title:person.name + " | Oyuncu profili | MRTSINEMA",description:person.name + " oyuncusunun katalogdaki film ve dizileri.",canonical,image:person.profile,schema,body});
}
function renderDirector(person, index, origin) {
  const path = "/yonetmen/" + index.directorSlugs.get(person) + "/", canonical = origin + path;
  const works = [...new Map(person.works.map((item) => [itemId(item),item])).values()].sort((a,b) => (Number(yearOf(b)) || 0) - (Number(yearOf(a)) || 0));
  const cards = works.map((item) => '<a class="card" href="' + itemPath(item,index) + '">' + (posterOf(item) ? '<img loading="lazy" src="' + esc(posterOf(item)) + '" alt="' + esc(titleOf(item)) + ' afişi">' : '<div class="placeholder">Afiş yok</div>') + '<strong>' + esc(titleOf(item)) + '</strong><small>' + esc(yearOf(item)) + (typeOf(item) === "tv" ? " · Dizi" : " · Film") + '</small></a>').join("");
  const body = '<nav class="crumb"><a href="/">Ana sayfa</a> / Yönetmenler / ' + esc(person.name) + '</nav><section><div class="eyebrow">Yönetmen profili</div><h1>' + esc(person.name) + '</h1><p class="summary">' + esc(person.name) + ' tarafından yönetilen katalog yapımlarını keşfedin.</p><div class="meta"><span>' + works.length + ' katalog yapımı</span></div></section><section class="panel"><h2>Yönetmen filmografisi</h2><div class="grid">' + cards + '</div></section>';
  const schema = {"@context":"https://schema.org","@type":"Person",name:person.name,url:canonical,jobTitle:"Film director"};
  return shell({title:person.name + " | Yönetmen filmografisi | MRTSINEMA",description:person.name + " yönetmeninin katalogdaki film ve dizileri.",canonical,image:"",schema,body});
}
function xmlEscape(value) { return String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function sitemap(index, origin) {
  const paths = [];
  for (const item of index.catalog) paths.push(itemPath(item,index));
  for (const actor of index.actors) paths.push("/oyuncu/" + index.actorSlugs.get(actor) + "/");
  for (const director of index.directors) paths.push("/yonetmen/" + index.directorSlugs.get(director) + "/");
  const unique = [...new Set(paths)].sort();
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    unique.map((path) => "  <url><loc>" + xmlEscape(origin + path) + "</loc></url>").join("\n") + "\n</urlset>\n";
}
function response(body, type, status) { return new Response(body,{status:status || 200,headers:{"content-type":type,"cache-control":"public, max-age=300, s-maxage=900"}}); }
export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname;
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 2 && TYPE_PATHS.has(segments[0]) && !path.endsWith("/") && !segments[1].endsWith(".html")) {
      return Response.redirect(new URL(path + "/" + url.search, url.origin), 308);
    }
    if (segments.length === 2 && TYPE_PATHS.has(segments[0]) && segments[1].endsWith(".html")) {
      const target = "/" + segments[0] + "/" + segments[1].slice(0,-5) + "/";
      return Response.redirect(new URL(target + url.search, url.origin), 301);
    }
    if (path === "/sitemap.xml" || path === "/robots.txt" || (segments.length === 2 && TYPE_PATHS.has(segments[0]) && path.endsWith("/"))) {
      try {
        const catalog = await loadCatalog(env, request), index = buildIndex(catalog);
        if (path === "/sitemap.xml") return response(sitemap(index,url.origin),"application/xml; charset=utf-8");
        if (path === "/robots.txt") {
          const content = url.hostname.endsWith(".workers.dev")
            ? "User-agent: *\nDisallow: /\n"
            : "User-agent: *\nAllow: /\nSitemap: " + url.origin + "/sitemap.xml\n";
          return response(content,"text/plain; charset=utf-8");
        }
        const kind = segments[0], slug = segments[1];
        if (kind === "film" || kind === "dizi") {
          const item = catalog.find((entry) => typeOf(entry) === (kind === "dizi" ? "tv" : "movie") && index.itemSlugs.get(entry) === slug);
          return item ? response(renderItem(item,index,url.origin),"text/html; charset=utf-8") : response("Sayfa bulunamadı", "text/plain; charset=utf-8",404);
        }
        if (kind === "oyuncu") {
          const person = index.actors.find((entry) => index.actorSlugs.get(entry) === slug);
          return person ? response(renderActor(person,index,url.origin),"text/html; charset=utf-8") : response("Oyuncu bulunamadı","text/plain; charset=utf-8",404);
        }
        if (kind === "yonetmen") {
          const person = index.directors.find((entry) => index.directorSlugs.get(entry) === slug);
          return person ? response(renderDirector(person,index,url.origin),"text/html; charset=utf-8") : response("Yönetmen bulunamadı","text/plain; charset=utf-8",404);
        }
        if (kind === "izle") {
          const item = catalog.find((entry) => index.watchSlugs.get(entry) === slug);
          if (!item) return response("Yapım bulunamadı","text/plain; charset=utf-8",404);
          const canonical = url.origin + itemPath(item,index), appUrl = "/#/watch/" + encodeURIComponent(itemId(item));
          const body = '<section class="panel"><div class="eyebrow">MRTSINEMA oynatıcı</div><h1>' + esc(titleOf(item)) + '</h1><p class="summary">Yapım uygulamada açılıyor.</p><a class="cta" href="' + appUrl + '">İzlemeye geç →</a></section><script>location.replace(' + JSON.stringify(appUrl) + ')</script>';
          return response(shell({title:titleOf(item) + " | İzle | MRTSINEMA",description:titleOf(item) + " yapımını uygulamada açın.",canonical,image:posterOf(item),schema:{"@context":"https://schema.org","@type":typeOf(item) === "tv" ? "TVSeries" : "Movie",name:titleOf(item),url:canonical},body,robots:"noindex,follow"}),"text/html; charset=utf-8");
        }
      } catch (error) {
        return response("Sayfa oluşturulamadı: " + esc(error.message || error),"text/plain; charset=utf-8",500);
      }
    }
    const assetResponse = await env.ASSETS.fetch(request);
    if (url.hostname.endsWith(".workers.dev")) {
      const headers = new Headers(assetResponse.headers);
      headers.set("X-Robots-Tag", "noindex, nofollow");
      return new Response(assetResponse.body, { status: assetResponse.status, statusText: assetResponse.statusText, headers });
    }
    return assetResponse;
  }
};
