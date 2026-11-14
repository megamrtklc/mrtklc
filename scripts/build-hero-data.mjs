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
const heroCatalog = catalog.filter(item => item && ids.has(String(item.id ?? item.tmdbId ?? item.title)));
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
await writeFile('hero-data.json', JSON.stringify(output, null, 2) + '\n');
console.log(`hero-data.json üretildi: ${heroCatalog.length} yapım / ${Buffer.byteLength(JSON.stringify(output))} byte`);
