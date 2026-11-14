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
  .map(({ cast, tmdbCast, ...item }) => item);
if (!heroCatalog.length) throw new Error('Manşet listeleriyle eşleşen katalog kaydı bulunamadı.');

const output = {
  homepageConfig: {
    settings: config.settings || {},
    desktopHeroSlides: desktopSlides,
    mobileHeroSlides: mobileSlides,
    heroSlides: Array.isArray(config.heroSlides) ? config.heroSlides : [],
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
// Manşet verisini HTML'e göm: init() ilk boyamada ayrı bir ağ isteği beklemesin.
const html = await readFile('index.html', 'utf8');
const bootstrapTag = /(<script id="cineverse-hero-bootstrap">window\\.__CV_HERO_BOOTSTRAP__ = )null;(\\<\\/script>)/;
if (!bootstrapTag.test(html)) throw new Error('Inline hero bootstrap slot is missing from index.html.');
const inlineJson = JSON.stringify(output).replace(/</g, '\\u003c').replace(/\\u2028/g, '\\\\u2028').replace(/\\u2029/g, '\\\\u2029');
let updatedHtml = html.replace(bootstrapTag, `$1${inlineJson};$2`);
updatedHtml = updatedHtml.replace(/    <link rel="preload" as="fetch" href="\\.\\/hero-data\\.json" crossorigin="anonymous" fetchpriority="high">\\n/, '');
await writeFile('index.html', updatedHtml);
await writeFile('hero-data.json', JSON.stringify(output, null, 2) + '\n');
console.log(`hero-data.json üretildi: ${heroCatalog.length} yapım / ${Buffer.byteLength(JSON.stringify(output))} byte`);
