import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.env.SEO_OUTPUT_DIR || process.cwd();
const CATALOG_FILE = process.env.SEO_CATALOG_FILE || path.join(process.cwd(), 'filmvediziler.json');
const SITE_ORIGIN = (process.env.SEO_SITE_URL || 'https://megamrtklc.github.io').replace(/\/+$/, '');
const BASE_PATH = ('/' + (process.env.SEO_BASE_PATH || '/mrtklc').split('/').filter(Boolean).join('/')).replace(/^\/$/, '');
const SITE_ROOT = SITE_ORIGIN + BASE_PATH + '/';
const MANIFEST = path.join(ROOT, '.seo-generated-files.json');

const TURKISH = { 'ı':'i', 'İ':'i', 'ğ':'g', 'Ğ':'g', 'ü':'u', 'Ü':'u', 'ş':'s', 'Ş':'s', 'ö':'o', 'Ö':'o', 'ç':'c', 'Ç':'c' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const slugify = value => {
  let text = clean(value);
  text = Array.from(text, ch => TURKISH[ch] || ch).join('');
  text = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'icerik';
};
const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
const array = value => Array.isArray(value) ? value : [];
const titleOf = item => clean(item?.title || item?.tmdbTitle || item?.originalTitle || item?.tmdbOriginalTitle || 'İsimsiz yapım');
const typeOf = item => item?.type === 'tv' || item?.type === 'series' ? 'tv' : 'movie';
const posterOf = item => clean(item?.poster || item?.tmdbPoster || item?.image);
const directorNames = item => {
  const raw = clean(item?.tmdbDirector || item?.director);
  if (!raw || raw.toLocaleLowerCase('tr') === 'bilinmiyor') return [];
  return raw.split(/\s*[,;|]\s*/).map(clean).filter(Boolean);
};
import { normalizePersonName } from './person-name.mjs';

async function resolveDirectorIds(items, directorMap) {
  const apiKey = process.env.SEO_TMDB_API_KEY;
  if (!apiKey) return { matched: 0, unresolved: [...directorMap.values()].map(person => person.name), ambiguous: [] };
  const candidates = [...new Map(items.filter(item => item.tmdbId && directorNames(item).length)
    .map(item => [(typeOf(item) === 'tv' ? 'tv' : 'movie') + '/' + item.tmdbId, item])).values()];
  let cursor = 0;
  const matched = new Set();
  const worker = async () => {
    while (cursor < candidates.length) {
      const item = candidates[cursor++];
      const media = typeOf(item) === 'tv' ? 'tv' : 'movie';
      try {
        const url = new URL('https://api.themoviedb.org/3/' + media + '/' + encodeURIComponent(item.tmdbId) + '/credits');
        url.searchParams.set('api_key', apiKey);
        const response = await fetch(url, { headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error('TMDB HTTP ' + response.status);
        const credits = await response.json();
        const crew = array(credits.crew).filter(person => person?.id && person.job === 'Director');
        // TMDB TV creators are stored on the series details endpoint, not always in aggregate crew credits.
        if (media === 'tv') {
          try {
            const detailsUrl = new URL('https://api.themoviedb.org/3/tv/' + encodeURIComponent(item.tmdbId));
            detailsUrl.searchParams.set('api_key', apiKey);
            const detailsResponse = await fetch(detailsUrl, { headers: { accept: 'application/json' } });
            if (detailsResponse.ok) {
              const details = await detailsResponse.json();
              crew.push(...array(details.created_by).filter(person => person?.id).map(person => ({ ...person, job: 'Creator' })));
            }
          } catch (error) {
            console.warn('Dizi yaraticilari TMDB verisi alinamadi:', titleOf(item), error.message || error);
          }
        }
        for (const name of directorNames(item)) {
          const aliases = {
            'baik': ['Baek Jong-yeol', 'Jong-Yeol Baek'],
            '李安': ['Ang Lee'],
            '이원태': ['Lee Won-tae', 'Won-Tae Lee', 'Lee Won Tae'],
            '홍원찬': ['Hong Won-chan', 'Won-chan Hong', 'Hong Won Chan'],
            'فرج الله سلحشور': ['Farajollah Salahshoor', 'Farajollah Salahshour', 'Farajollah Salahshur'],
            '加藤裕将': ['Yusuke Kato', 'Kato Yusuke']
          };
          const expectedNames = new Set([name, ...(aliases[normalizePersonName(name)] || aliases[name] || [])].map(normalizePersonName));
          const match = crew.find(person => expectedNames.has(normalizePersonName(person.name)));
          if (!match) continue;
          const person = directorMap.get(name.toLocaleLowerCase('tr'));
          if (!person || person.ambiguous) continue;
          const id = Number(match.id);
          if (person.tmdbId && person.tmdbId !== id) {
            person.tmdbId = null;
            person.ambiguous = true;
            person.profile = '';
            matched.delete(name.toLocaleLowerCase('tr'));
            continue;
          }
          person.tmdbId = id;
          person.profile = match.profile_path ? 'https://image.tmdb.org/t/p/w342' + match.profile_path : person.profile;
          matched.add(name.toLocaleLowerCase('tr'));
        }
      } catch (error) {
        console.warn('Yönetmen TMDB kimliği çözümlenemedi:', titleOf(item), error.message || error);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return {
    matched: [...directorMap.values()].filter(person => person.tmdbId && !person.ambiguous).length,
    unresolved: [...directorMap.values()].filter(person => !person.tmdbId && !person.ambiguous).map(person => person.name).sort((a, b) => a.localeCompare(b, 'tr')),
    ambiguous: [...directorMap.values()].filter(person => person.ambiguous).map(person => person.name).sort((a, b) => a.localeCompare(b, 'tr'))
  };
}
const descriptionOf = item => clean(item?.desc || item?.tmdbOverview || item?.overview || '');
const yearOf = item => clean(item?.year || item?.tmdbReleaseDate || item?.releaseDate).slice(0, 4);
const genresOf = item => clean(item?.tmdbGenres || item?.genre || item?.category).split(/\s*\/\s*|,\s*/).map(clean).filter(Boolean);
const ratingOf = item => {
  const value = Number.parseFloat(item?.tmdbRating ?? item?.rating);
  return Number.isFinite(value) && value > 0 ? value : null;
};
const voteCountOf = item => Math.max(0, Number(item?.tmdbVoteCount || item?.voteCount || 0) || 0);
const itemId = item => String(item?.id ?? item?.tmdbId ?? titleOf(item));
const safeFile = value => value.replace(/[^a-zA-Z0-9._/-]/g, '');

function uniqueSlugs(entries, getName, getStableId) {
  const groups = new Map();
  for (const entry of entries) {
    const base = slugify(getName(entry));
    groups.set(base, (groups.get(base) || 0) + 1);
  }
  const used = new Set();
  return new Map(entries.map((entry, index) => {
    const base = slugify(getName(entry));
    let slug = base;
    if (groups.get(base) > 1 || used.has(slug)) {
      const suffix = slugify(getStableId(entry) || String(index + 1));
      slug = base + '-' + suffix;
    }
    let candidate = slug;
    let serial = 2;
    while (used.has(candidate)) candidate = slug + '-' + serial++;
    used.add(candidate);
    return [entry, candidate];
  }));
}

function pageShell({ title, description, canonical, image, jsonLd, body, kind, robots = 'index,follow,max-image-preview:large' }) {
  const imageTag = image ? '<meta property="og:image" content="' + esc(image) + '">' : '';
  return '<!doctype html>\n<html lang="tr">\n<head>\n' +
    '  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '  <title>' + esc(title) + '</title>\n' +
    '  <meta name="description" content="' + esc(description) + '">\n' +
    '  <meta name="robots" content="' + esc(robots) + '">\n' +
    '  <link rel="canonical" href="' + esc(canonical) + '">\n' +
    '  <meta property="og:type" content="website">\n  <meta property="og:site_name" content="Perde">\n' +
    '  <meta property="og:title" content="' + esc(title) + '">\n' +
    '  <meta property="og:description" content="' + esc(description) + '">\n' + imageTag + '\n' +
    '  <meta name="twitter:card" content="' + (image ? 'summary_large_image' : 'summary') + '">\n' +
    '  <meta name="twitter:title" content="' + esc(title) + '">\n' +
    '  <meta name="twitter:description" content="' + esc(description) + '">\n' +
    '  <script type="application/ld+json">' + safeJson(jsonLd) + '</script>\n' +
    '  <style>\n' +
    '    :root{color-scheme:dark;--bg:#0b0b0d;--panel:#151518;--line:#2b2926;--text:#f5f2ed;--muted:#aaa49b;--gold:#d6ad62;--link:#e8c47d}\n' +
    '    *{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 50% -20%,#332819 0,transparent 46%),var(--bg);color:var(--text);font:16px/1.65 system-ui,-apple-system,Segoe UI,sans-serif}\n' +
    '    a{color:var(--link);text-decoration:none}a:hover{text-decoration:underline}.wrap{width:min(1100px,calc(100% - 36px));margin:auto}\n' +
    '    header{border-bottom:1px solid var(--line);background:#0b0b0de8}.top{height:68px;display:flex;align-items:center;justify-content:space-between;gap:18px}\n' +
    '    .brand{font-size:24px;font-weight:900;letter-spacing:.08em;color:var(--text)}.brand span{color:var(--gold)}.back{font-size:14px;color:var(--muted)}\n' +
    '    main{padding:34px 0 64px}.crumb{font-size:13px;color:var(--muted);margin-bottom:22px}.hero{display:grid;grid-template-columns:minmax(180px,270px) 1fr;gap:32px;align-items:start}\n' +
    '    .poster{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:14px;background:#222;box-shadow:0 18px 50px #0008}.poster-placeholder{aspect-ratio:2/3;border-radius:14px;background:var(--panel);display:grid;place-items:center;color:var(--muted)}\n' +
    '    h1{font-size:clamp(30px,5vw,48px);line-height:1.12;margin:0 0 12px}.eyebrow{color:var(--gold);font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}\n' +
    '    .meta{display:flex;flex-wrap:wrap;gap:9px 16px;color:var(--muted);font-size:14px;margin:18px 0}.rating{color:var(--gold);font-weight:800}.summary{font-size:17px;color:#d6d1c9;max-width:760px}\n' +
    '    .panel{margin-top:30px;padding:22px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(145deg,#19191c,#111113)}h2{font-size:20px;margin:0 0 16px}\n' +
    '    .chips{display:flex;flex-wrap:wrap;gap:9px}.chip{display:inline-flex;padding:7px 11px;border:1px solid #484034;border-radius:999px;background:#211d17;font-size:13px}\n' +
    '    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:16px}.card{display:block;color:var(--text);min-width:0}.card img{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:10px;background:#222}.card strong{display:block;margin-top:8px;font-size:14px;line-height:1.35}.card small{color:var(--muted)}\n' +
    '    .people{display:flex;flex-wrap:wrap;gap:12px}.person{display:flex;align-items:center;gap:10px;min-width:190px;padding:9px;border:1px solid var(--line);border-radius:12px;background:#111}.person img{width:48px;height:60px;object-fit:cover;border-radius:7px;background:#252525}.person span{display:block;color:var(--muted);font-size:12px}\n' +
    '    .watch-cta{display:inline-flex;align-items:center;justify-content:center;margin-top:8px;padding:11px 18px;border-radius:999px;background:linear-gradient(135deg,#e5bd73,#b8873d);color:#17120b;font-weight:800;font-size:14px;box-shadow:0 8px 24px #0005}.watch-cta:hover{filter:brightness(1.08);text-decoration:none}\n' +
    '    footer{border-top:1px solid var(--line);padding:22px 0;color:var(--muted);font-size:13px}.empty{color:var(--muted)}\n' +
    '    @media(max-width:650px){.wrap{width:min(100% - 26px,1100px)}.top{height:60px}.hero{grid-template-columns:112px 1fr;gap:16px}main{padding-top:24px}.summary{font-size:15px}.panel{padding:16px;margin-top:22px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.person{min-width:100%;}}\n' +
    '  </style>\n</head>\n<body data-page-kind="' + esc(kind) + '">\n' +
    '  <header><div class="wrap top"><a class="brand" href="' + esc(BASE_PATH + '/') + '">PER<span>DE</span></a><a class="back" href="' + esc(BASE_PATH + '/') + '">Ana sayfaya dön →</a></div></header>\n' +
    '  <main class="wrap">' + body + '</main>\n' +
    '  <footer><div class="wrap">© ' + new Date().getFullYear() + ' Perde · Film ve dizi keşif arşivi</div></footer>\n</body>\n</html>\n';
}

function linkCard(item, href) {
  const poster = posterOf(item);
  return '<a class="card" href="' + esc(href) + '">' +
    (poster ? '<img loading="lazy" src="' + esc(poster) + '" alt="' + esc(titleOf(item)) + ' afişi">' : '<div class="poster-placeholder">Afiş yok</div>') +
    '<strong>' + esc(titleOf(item)) + '</strong><small>' + esc(yearOf(item)) + (typeOf(item) === 'tv' ? ' · Dizi' : ' · Film') + '</small></a>';
}

const source = JSON.parse(await readFile(CATALOG_FILE, 'utf8'));
const catalog = Array.isArray(source) ? source : source?.catalog;
if (!Array.isArray(catalog)) throw new Error('filmvediziler.json içinde catalog listesi bulunamadı.');
const items = catalog.filter(item => item && itemId(item));
const films = items.filter(item => typeOf(item) === 'movie');
const series = items.filter(item => typeOf(item) === 'tv');
const itemSlugs = new Map([...uniqueSlugs(films, titleOf, itemId), ...uniqueSlugs(series, titleOf, itemId)]);
const watchSlugs = uniqueSlugs(items, titleOf, itemId);
const actorMap = new Map();
const directorMap = new Map();

for (const item of items) {
  for (const [castIndex, person] of array(item.tmdbCast).entries()) {
    if (!person?.id || !clean(person.name)) continue;
    const id = String(person.id);
    if (!actorMap.has(id)) actorMap.set(id, { id, name: clean(person.name), profile: clean(person.profile), works: [], isLead: false });
    const actor = actorMap.get(id);
    if (!actor.profile && person.profile) actor.profile = person.profile;
    if (castIndex < 3) actor.isLead = true;
    actor.works.push({ item, character: clean(person.character) });
  }
  for (const name of directorNames(item)) {
    const key = name.toLocaleLowerCase('tr');
    if (!directorMap.has(key)) directorMap.set(key, { name, works: [], tmdbId: null, profile: '', ambiguous: false });
    directorMap.get(key).works.push(item);
  }
}
// TMDB oyuncu sıralamasındaki ilk 3 isim başrol/öne çıkan oyuncu kabul edilir.
 // Tek bir yapımda bile ilk 3 sırada yer alan oyuncuya profil açılır.
 // Diğer oyuncular için en az 2 farklı katalog yapımında görünme şartı korunur.
const actors = [...actorMap.values()].filter(person => person.isLead || new Set(person.works.map(entry => itemId(entry.item))).size >= 2).sort((a,b)=>a.name.localeCompare(b.name,'tr'));
const directors = [...directorMap.values()].sort((a,b)=>a.name.localeCompare(b.name,'tr'));
const directorResolution = await resolveDirectorIds(items, directorMap);
const actorSlugs = uniqueSlugs(actors, person => person.name, person => person.id);
const directorSlugs = uniqueSlugs(directors, person => person.name, person => person.name);
const itemPaths = new Map();
const actorPaths = new Map();
const directorPaths = new Map();
for (const item of items) {
  const folder = typeOf(item) === 'tv' ? 'dizi' : 'film';
  itemPaths.set(item, '/' + folder + '/' + itemSlugs.get(item) + '.html');
}
for (const person of actors) actorPaths.set(person.id, '/oyuncu/' + actorSlugs.get(person) + '.html');
for (const person of directors) directorPaths.set(person.name.toLocaleLowerCase('tr'), '/yonetmen/' + directorSlugs.get(person) + '.html');

const previous = await readFile(MANIFEST, 'utf8').then(JSON.parse).catch(() => []);
for (const relative of array(previous)) {
  const normalized = safeFile(relative);
  if (!normalized || normalized.split('/').includes('..') || path.isAbsolute(normalized)) continue;
  await rm(path.join(ROOT, normalized), { force: true });
}
const generated = [];
async function emit(relative, html) {
  const file = path.join(ROOT, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
  generated.push(relative.split(path.sep).join('/'));
}
const abs = relative => SITE_ORIGIN + BASE_PATH + relative;
const today = new Date().toISOString().slice(0,10);
const sitemapUrls = new Set();

for (const item of items) {
  const title = titleOf(item);
  const year = yearOf(item);
  const genres = genresOf(item);
  const rating = ratingOf(item);
  const desc = descriptionOf(item) || title + ' yapımının oyuncu kadrosunu, türünü ve yayın bilgilerini Perde üzerinde keşfedin.';
  const shortDesc = desc.length > 158 ? desc.slice(0,155).replace(/\s+\S*$/, '') + '…' : desc;
  const canonical = abs(itemPaths.get(item));
  const watchPath = '/izle/' + watchSlugs.get(item) + '.html';
  const appWatchUrl = BASE_PATH + '/#/watch/' + encodeURIComponent(itemId(item));
  const poster = posterOf(item);
  const directorsForItem = directorNames(item);
  const cast = array(item.tmdbCast).filter(person => person?.id && clean(person.name)).slice(0,6);
  const peopleLinks = directorsForItem.map(name => {
    const href = directorPaths.get(name.toLocaleLowerCase('tr'));
    return href ? '<a class="chip" href="' + esc(BASE_PATH + href) + '">' + esc(name) + '</a>' : '';
  }).join('');
  const castLinks = cast.map(person => {
    const href = actorPaths.get(String(person.id));
    const tag = href ? 'a' : 'div';
    const link = href ? ' href="' + esc(BASE_PATH + href) + '"' : '';
    return '<' + tag + ' class="person"' + link + '>' +
      (person.profile ? '<img loading="lazy" src="' + esc(person.profile) + '" alt="' + esc(person.name) + '">' : '') +
      '<div><strong>' + esc(person.name) + '</strong><span>' + esc(person.character || 'Oyuncu') + '</span></div></' + tag + '>';
  }).join('');
  const crumbs = '<nav class="crumb"><a href="' + esc(BASE_PATH + '/') + '">Ana sayfa</a> / ' +
    '<span>' + (typeOf(item) === 'tv' ? 'Diziler' : 'Filmler') + '</span> / ' + esc(title) + '</nav>';
  const body = crumbs + '<section class="hero">' +
    (poster ? '<img class="poster" src="' + esc(poster) + '" alt="' + esc(title) + ' afişi">' : '<div class="poster-placeholder">Afiş bulunamadı</div>') +
    '<div><div class="eyebrow">' + (typeOf(item) === 'tv' ? 'Dizi' : 'Film') + ' detayları</div><h1>' + esc(title) + '</h1>' +
    '<div class="meta">' + (year ? '<span>' + esc(year) + '</span>' : '') +
    (rating ? '<span class="rating">★ ' + rating.toFixed(1) + ' / 10 <small>TMDB</small></span>' : '') +
    genres.map(g => '<span>' + esc(g) + '</span>').join('') +
    (item.duration || item.tmdbRuntime ? '<span>' + esc(item.duration || item.tmdbRuntime) + '</span>' : '') + '</div>' +
    '<p class="summary">' + esc(desc) + '</p>' +
    '<a class="watch-cta" href="' + esc(BASE_PATH + watchPath) + '">▶ Perde uygulamasında izle</a>' +
    (directorsForItem.length ? '<div class="meta"><strong>Yönetmen:</strong> ' + peopleLinks + '</div>' : '') +
    '</div></section>' +
    (castLinks ? '<section class="panel"><h2>Oyuncular</h2><div class="people">' + castLinks + '</div></section>' : '') +
    '<section class="panel"><h2>Yapım hakkında</h2><p>' + esc(desc) + '</p><div class="chips">' +
    '<span class="chip">' + (typeOf(item) === 'tv' ? 'Dizi' : 'Film') + '</span>' +
    (year ? '<span class="chip">Yapım yılı: ' + esc(year) + '</span>' : '') +
    genres.map(g => '<span class="chip">' + esc(g) + '</span>').join('') + '</div></section>';
  const schema = {
    '@context':'https://schema.org',
    '@type': typeOf(item) === 'tv' ? 'TVSeries' : 'Movie',
    name: title,
    description: desc,
    url: canonical,
    ...(poster ? { image: poster } : {}),
    ...(year ? { datePublished: year } : {}),
    ...(genres.length ? { genre: genres } : {}),
    ...(directorsForItem.length ? { director: directorsForItem.map(name => ({'@type':'Person',name})) } : {}),
    ...(cast.length ? { actor: cast.map(person => ({'@type':'Person',name:person.name,...(actorPaths.has(String(person.id)) ? {url:abs(actorPaths.get(String(person.id)))} : {})})) } : {}),
    ...(rating && voteCountOf(item) ? { aggregateRating: {'@type':'AggregateRating',ratingValue:rating,bestRating:10,ratingCount:voteCountOf(item)} } : {})
  };
  const html = pageShell({ title: title + (year ? ' (' + year + ')' : '') + ' | Perde', description: shortDesc, canonical, image: poster, jsonLd: schema, body, kind: typeOf(item) });
  const folder = typeOf(item) === 'tv' ? 'dizi' : 'film';
  await emit(folder + '/' + itemSlugs.get(item) + '.html', html);
  const watchBody = '<section class="panel"><div class="eyebrow">Perde oynatıcı</div><h1>' + esc(title) + '</h1><p class="summary">Yapım Perde uygulamasında açılıyor. Otomatik yönlendirme başlamazsa aşağıdaki bağlantıyı kullan.</p><a class="watch-cta" href="' + esc(appWatchUrl) + '">İzlemeye geç →</a></section><script>window.location.replace(' + safeJson(appWatchUrl) + ');</script>';
  await emit(watchPath.slice(1), pageShell({ title: title + ' | İzle | Perde', description: title + ' yapımını Perde oynatıcısında açın.', canonical, image: poster, jsonLd: schema, body: watchBody, kind: 'watch', robots: 'noindex,follow' }));
  sitemapUrls.add(canonical);
}

for (const person of actors) {
  const slug = actorSlugs.get(person);
  const relative = '/oyuncu/' + slug + '.html';
  const canonical = abs(relative);
  const works = [...new Map(person.works.map(entry => [itemId(entry.item), entry])).values()]
    .sort((a,b) => (Number(yearOf(b.item)) || 0) - (Number(yearOf(a.item)) || 0));
  const cards = works.slice(0,48).map(entry => linkCard(entry.item, BASE_PATH + itemPaths.get(entry.item))).join('');
  const appProfileUrl = BASE_PATH + '/#/actor/' + encodeURIComponent(person.id);
  const body = '<nav class="crumb"><a href="' + esc(BASE_PATH + '/') + '">Ana sayfa</a> / Oyuncular / ' + esc(person.name) + '</nav>' +
    '<section class="hero">' + (person.profile ? '<img class="poster" src="' + esc(person.profile.replace('/w185/','/w342/')) + '" alt="' + esc(person.name) + '">' : '<div class="poster-placeholder">Profil fotoğrafı yok</div>') +
    '<div><div class="eyebrow">Oyuncu profili</div><h1>' + esc(person.name) + '</h1><p class="summary">' + esc(person.name) + ' filmleri ve dizileri. Perde kataloğunda yer alan yapımları ve canlandırdığı karakterleri keşfedin.</p>' +
    '<a class="watch-cta" href="' + esc(appProfileUrl) + '">Perde uygulamasında oyuncu profilini aç →</a>' +
    '<div class="meta"><span>' + works.length + ' katalog yapımı</span></div></div></section>' +
    '<section class="panel"><h2>Perde kataloğundaki yapımları</h2>' + (cards ? '<div class="grid">' + cards + '</div>' : '<p class="empty">Henüz katalog yapımı bulunmuyor.</p>') + '</section>';
  const schema = {'@context':'https://schema.org','@type':'Person','name':person.name,'url':canonical,'jobTitle':'Actor',...(person.profile?{image:person.profile}:{})};
  await emit('oyuncu/' + slug + '.html', pageShell({title:person.name+' | Oyuncu profili | Perde',description:person.name+' oyuncusunun Perde kataloğunda bulunan film ve dizileri.',canonical,image:person.profile,jsonLd:schema,body,kind:'person'}));
  sitemapUrls.add(canonical);
}

for (const person of directors) {
  const slug = directorSlugs.get(person);
  const relative = '/yonetmen/' + slug + '.html';
  const canonical = abs(relative);
  const works = [...new Map(person.works.map(item => [itemId(item), item])).values()]
    .sort((a,b) => (Number(yearOf(b)) || 0) - (Number(yearOf(a)) || 0));
  const cards = works.map(item => linkCard(item, BASE_PATH + itemPaths.get(item))).join('');
  const appProfileUrl = person.tmdbId && !person.ambiguous ? BASE_PATH + '/#/director/' + encodeURIComponent(person.tmdbId) : '';
  const appProfileLink = appProfileUrl ? '<a class="watch-cta" href="' + esc(appProfileUrl) + '">Perde uygulamasında yönetmen profilini aç →</a>' : '';
  const body = '<nav class="crumb"><a href="' + esc(BASE_PATH + '/') + '">Ana sayfa</a> / Yönetmenler / ' + esc(person.name) + '</nav>' +
    '<section><div class="eyebrow">Yönetmen profili</div><h1>' + esc(person.name) + '</h1>' +
    '<p class="summary">' + esc(person.name) + ' tarafından yönetilen ve Perde kataloğunda bulunan film ve dizileri keşfedin.</p>' + appProfileLink +
    '<div class="meta"><span>' + works.length + ' katalog yapımı</span></div></section>' +
    '<section class="panel"><h2>Yönetmen filmografisi</h2><div class="grid">' + cards + '</div></section>';
  const schema = {'@context':'https://schema.org','@type':'Person','name':person.name,'url':canonical,'jobTitle':'Film director'};
  await emit('yonetmen/' + slug + '.html', pageShell({title:person.name+' | Yönetmen filmografisi | Perde',description:person.name+' yönetmeninin Perde kataloğundaki film ve dizileri.',canonical,image:'',jsonLd:schema,body,kind:'person'}));
  sitemapUrls.add(canonical);
}

const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  [...sitemapUrls].sort().map(url => '  <url><loc>' + esc(url) + '</loc><lastmod>' + today + '</lastmod></url>').join('\n') +
  '\n</urlset>\n';
await writeFile(path.join(ROOT, 'sitemap.xml'), sitemap);
await writeFile(path.join(ROOT, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: ' + SITE_ROOT + 'sitemap.xml\n');
await writeFile(MANIFEST, JSON.stringify(generated, null, 2) + '\n');

console.log('SEO sayfalari olusturuldu: ' + items.length + ' film/dizi, ' + actors.length + ' oyuncu, ' + directors.length + ' yonetmen (' + directorResolution.matched + ' benzersiz TMDB profil eslesmesi); toplam ' + generated.length + ' HTML sayfasi.');
if (directorResolution.unresolved.length) console.warn('TMDB profili eslesmeyen yonetmenler:', directorResolution.unresolved.join(' | '));
if (directorResolution.ambiguous.length) console.warn('Birden fazla TMDB kimligiyle celisen yonetmenler (guvenlik nedeniyle baglanti verilmedi):', directorResolution.ambiguous.join(' | '));
