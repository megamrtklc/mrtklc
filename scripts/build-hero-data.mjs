import { readFile, writeFile } from 'node:fs/promises';

const source = JSON.parse(await readFile('filmvediziler.json', 'utf8'));
const catalog = Array.isArray(source) ? source : source?.catalog;
if (!Array.isArray(catalog)) throw new Error('filmvediziler.json içinde catalog listesi bulunamadı.');

const config = source?.homepageConfig || {};
const desktopSlides = Array.isArray(config.desktopHeroSlides) && config.desktopHeroSlides.length
  ? config.desktopHeroSlides
  : (Array.isArray(config.heroSlides) ? config.heroSlides : []);
const mobileSlides = Array.isArray(config.mobileHeroSlides) && config.mobileHeroSlides.length
  ? config.mobileHeroSlides
  : (Array.isArray(config.heroSlides) ? config.heroSlides : []);
const ids = new Set([...desktopSlides, ...mobileSlides]
  .filter(slide => slide && slide.active !== false && slide.id != null)
  .map(slide => String(slide.id)));
const heroCatalog = catalog
  .filter(item => item && ids.has(String(item.id ?? item.tmdbId ?? item.title)))
  // Cast verileri manşette kullanılmıyor; detay sayfası TMDB'den kendi kadrosunu alır.
  .map(item => ({
    id: item.id ?? item.tmdbId ?? item.title,
    tmdbId: item.tmdbId,
    title: item.title || item.tmdbTitle || item.originalTitle || 'İsimsiz yapım',
    type: item.type === 'tv' || item.type === 'series' ? 'tv' : 'movie',
    category: item.category || item.tmdbGenres || item.genre || '',
    genre: item.genre || item.tmdbGenres || item.category || '',
    rating: String(item.rating ?? item.tmdbRating ?? '0'),
    year: String(item.year || item.tmdbReleaseDate || '').slice(0, 4),
    duration: item.duration || item.tmdbRuntime || '',
    country: item.country || item.tmdbCountries || '',
    poster: item.poster || item.tmdbPoster || item.image || '',
    backdrop: item.backdrop || item.tmdbBackdrop || item.tmdbPoster || item.image || '',
    desc: item.desc || item.tmdbOverview || '',
    director: item.director || item.tmdbDirector || '',
    originalTitle: item.originalTitle || item.tmdbOriginalTitle || item.title || '',
    starring: item.starring || '',
    trailerUrl: item.trailerUrl || item.tmdbTrailerUrl || '',
    seasons: item.seasons ?? item.tmdbSeasons ?? null,
    episodes: item.episodes ?? item.tmdbEpisodes ?? null
  })));
if (!heroCatalog.length) throw new Error('Manşet listeleriyle eşleşen katalog kaydı bulunamadı.');

const output = {
  homepageConfig: {
    settings: config.settings || {},
    desktopHeroSlides: desktopSlides.map(({ id, active }) => ({ id, active })),
    mobileHeroSlides: mobileSlides.map(({ id, active }) => ({ id, active })),
    heroStyle: config.heroStyle || 'current'
  },
  catalog: heroCatalog
};
// İlk masaüstü slaydının görselini HTML iskeletine de yaz; Alpine ve katalog beklenirken
// doğru manşet görseli erkenden boyanabilir. Başlık/metin yine veri gelene kadar gizli kalır.
const firstDesktopSlide = desktopSlides.find(slide => slide && slide.active !== false && slide.id != null);
const firstDesktopItem = firstDesktopSlide
  ? catalog.find(item => String(item.id ?? item.tmdbId ?? item.title) === String(firstDesktopSlide.id))
  : null;
const artworkUrl = firstDesktopItem?.backdrop || firstDesktopItem?.tmdbBackdrop || firstDesktopItem?.poster || firstDesktopItem?.tmdbPoster || '';
if (artworkUrl) {
  const optimizedArtworkUrl = artworkUrl.replace('/t/p/w1280/', '/t/p/w780/');
  const html = await readFile('index.html', 'utf8');
  const artworkTag = /(<img id="hero-initial-shell-desktop-artwork" src=")[^"]*(")/;
  if (!artworkTag.test(html)) throw new Error('Desktop hero skeleton artwork marker is missing from index.html.');
  await writeFile('index.html', html.replace(artworkTag, `$1${optimizedArtworkUrl}$2`));
}
// İlk HTML çiziminde masaüstü manşetinde de doğru başlık ve bilgiler görünsün.
if (firstDesktopItem) {
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const title = escapeHtml(firstDesktopItem.title || firstDesktopItem.tmdbTitle || '');
  const type = String(firstDesktopItem.type || '').toLowerCase() === 'tv' ? 'DİZİ' : 'SİNEMA';
  const ratingValue = Number(firstDesktopItem.rating);
  const rating = Number.isFinite(ratingValue) && ratingValue > 0 ? ratingValue.toFixed(1) : '—';
  const year = escapeHtml(firstDesktopItem.year || '');
  const genre = escapeHtml(firstDesktopItem.genre || firstDesktopItem.category || '');
  const descriptionSource = String(firstDesktopItem.desc || firstDesktopItem.tmdbOverview || '');
  const maxDescriptionLength = Math.max(80, Math.min(500, Number(config.settings?.descriptionLength) || 220));
  const description = escapeHtml(descriptionSource.length > maxDescriptionLength
    ? descriptionSource.slice(0, maxDescriptionLength).trimEnd() + '…'
    : descriptionSource);
  let html = await readFile('index.html', 'utf8');
  const replacements = [
    [/(<h1\b[^>]*\bid="hero-initial-desktop-title"[^>]*>)[\s\S]*?(<\/h1>)/, '$1' + title + '$2'],
    [/(<p\b[^>]*\bid="hero-initial-desktop-type"[^>]*>)[\s\S]*?(<\/p>)/, '$1' + type + '$2'],
    [/(<div\b[^>]*\bid="hero-initial-desktop-meta"[^>]*>)[\s\S]*?(<\/div>)/, '$1<span class="inline-flex items-center gap-2"><i class="fa-solid fa-star text-amber-400"></i><strong class="text-white">' + rating + '</strong><span class="text-gray-400">IMDb</span></span><span class="text-white/35">|</span><span>' + year + '</span><span class="text-white/35">|</span><span>' + genre + '</span>$2'],
    [/(<p\b[^>]*\bid="hero-initial-desktop-description"[^>]*>)[\s\S]*?(<\/p>)/, '$1' + description + '$2'],
    [/(<span\b[^>]*\bid="hero-initial-desktop-footer-title"[^>]*>)[\s\S]*?(<\/span>)/, '$1' + title + '$2']
  ];
  for (const [pattern, replacement] of replacements) {
    if (!pattern.test(html)) throw new Error('Desktop initial hero content slot missing: ' + String(pattern));
    html = html.replace(pattern, replacement);
  }
  await writeFile('index.html', html);
}
// Manşet verisini HTML'e göm: init() ilk boyamada ayrı bir ağ isteği beklemesin.
const html = await readFile('index.html', 'utf8');
const bootstrapPrefix = '<script id="cineverse-hero-bootstrap">window.__CV_HERO_BOOTSTRAP__ = ';
const bootstrapSuffix = ';</script>';
const bootstrapStart = html.indexOf(bootstrapPrefix);
const bootstrapEnd = bootstrapStart < 0 ? -1 : html.indexOf(bootstrapSuffix, bootstrapStart);
if (bootstrapStart < 0 || bootstrapEnd < 0) throw new Error('Inline hero bootstrap slot is missing from index.html.');
const inlineJson = JSON.stringify(output).replace(/</g, '\\u003c');
let updatedHtml = html.slice(0, bootstrapStart) + bootstrapPrefix + inlineJson + bootstrapSuffix + html.slice(bootstrapEnd + bootstrapSuffix.length);
updatedHtml = updatedHtml.split('    <link rel="preload" as="fetch" href="./hero-data.json" crossorigin="anonymous" fetchpriority="high">').join('');
await writeFile('index.html', updatedHtml);
await writeFile('hero-data.json', JSON.stringify(output, null, 2) + '\n');
console.log(`hero-data.json üretildi: ${heroCatalog.length} yapım / ${Buffer.byteLength(JSON.stringify(output))} byte`);
