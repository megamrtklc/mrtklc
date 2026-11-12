import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCatalogData } from '../worker/src/index.js';

const source = JSON.parse(readFileSync(new URL('../filmvediziler.json', import.meta.url), 'utf8'));
const snapshot = JSON.stringify(source);

assert.equal(validateCatalogData(source), true, 'Mevcut üretim kataloğu geçerli olmalı');
assert.equal(JSON.stringify(source), snapshot, 'Doğrulama kaynak veriyi değiştirmemeli');

const validCollectionSave = structuredClone(source);
validCollectionSave.collections = [
  ...(validCollectionSave.collections || []),
  {
    id: 'test-collection',
    title: 'Test koleksiyonu',
    description: 'Otomatik doğrulama denemesi',
    active: true,
    items: validCollectionSave.catalog.slice(0, 3).map(item => String(item.id))
  }
];
assert.equal(validateCatalogData(validCollectionSave), true, 'Geçerli koleksiyon kaydı kabul edilmeli');

const invalidCases = [
  ['katalogda yinelenen yapım kimliği', data => { data.catalog[1].id = data.catalog[0].id; }],
  ['boş yapım adı', data => { data.catalog[0].title = '  '; }],
  ['geçersiz görsel adresi', data => { data.catalog[0].image = 'javascript:alert(1)'; }],
  ['katalog dışı koleksiyon öğesi', data => { data.collections[0].items.push('not-in-catalog'); }],
  ['koleksiyonda yinelenen öğe', data => { data.collections[0].items.push(data.collections[0].items[0]); }],
  ['boş koleksiyon adı', data => { data.collections[0].title = ' '; }],
  ['yinelenen koleksiyon kimliği', data => { data.collections.push({ ...data.collections[0], title: 'İkinci koleksiyon' }); }],
  ['vitrinde katalog dışı yapım', data => { data.homepageConfig.heroSlides[0].id = 'missing-hero-id'; }],
  ['yinelenen vitrin öğesi', data => { data.homepageConfig.heroSlides.push({ ...data.homepageConfig.heroSlides[0] }); }],
  ['masaüstü kart sınırı', data => { data.homepageConfig.settings.desktopCount = 21; }],
  ['mobil kart sınırı', data => { data.homepageConfig.settings.mobileCount = 13; }],
  ['geçiş süresi sınırı', data => { data.homepageConfig.settings.interval = 1; }]
];

for (const [name, mutate] of invalidCases) {
  const candidate = structuredClone(source);
  mutate(candidate);
  assert.throws(() => validateCatalogData(candidate), undefined, name + ' reddedilmeli');
}

console.log('PASS: mevcut 140 kayıtlı katalog doğrulandı');
console.log('PASS: geçerli koleksiyon ekleme senaryosu doğrulandı');
console.log('PASS: ' + invalidCases.length + ' geçersiz veri senaryosu reddedildi');
console.log('PASS: doğrulama kaynak kataloğu değiştirmedi');
