import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'admin/index.html'), 'utf8');
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
assert.deepEqual([...new Set(duplicates)], [], 'Admin HTML içinde yinelenen id bulunmamalı');

const mainOpen = (html.match(/<main\b/gi) || []).length;
const mainClose = (html.match(/<\/main>/gi) || []).length;
assert.equal(mainOpen, 1, 'Admin panelinde tek bir main alanı olmalı');
assert.equal(mainClose, 1, 'main etiketi tam bir kez kapatılmalı');

const localAssets = [...html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)=["']([^"']+)["']/gi)]
  .map(match => match[1])
  .filter(path => path.startsWith('./') || path.startsWith('../'));
for (const asset of localAssets) {
  const pathname = asset.split(/[?#]/)[0];
  assert.ok(existsSync(resolve(root, 'admin', pathname)), 'Admin yerel kaynağı bulunamadı: ' + asset);
}

console.log('PASS: Admin HTML kimlikleri benzersiz');
console.log('PASS: main alanı doğru açılıp kapanıyor');
console.log('PASS: Admin CSS ve JS kaynakları mevcut');


const adminJs = readFileSync(resolve(root, 'admin/admin.js'), 'utf8');
const adminCss = readFileSync(resolve(root, 'admin/admin.css'), 'utf8');
const workerJs = readFileSync(resolve(root, 'worker/src/index.js'), 'utf8');

// Logos are stored as standalone PNG assets; display dimensions are independently configurable.
assert.match(adminJs, /async function uploadSiteLogo\(kind,file\)/, 'Logo PNG dosyası ayrı endpoint üzerinden yüklenmeli');
assert.match(adminJs, /2\*1024\*1024/, 'Logo yükleme sınırı 2 MB olmalı');
assert.match(adminJs, /logoWidth:[\s\S]*logoHeight:/, 'Header ve footer logo ölçüleri yapılandırmaya kaydedilmeli');
assert.match(html, /hf-header-logo-width[\s\S]*hf-header-logo-height/, 'Header logo genişlik ve yükseklik alanları bulunmalı');
assert.match(html, /hf-footer-logo-width[\s\S]*hf-footer-logo-height/, 'Footer logo genişlik ve yükseklik alanları bulunmalı');
assert.match(workerJs, /path==="\/api\/site-logo"/, 'Worker logo yükleme API rotası bulunmalı');
assert.match(workerJs, /assets\/logos\/perde-"\+kind\+"\.png"/, 'Logo dosyaları assets/logos altında ayrı PNG olarak saklanmalı');
assert.match(workerJs, /bytes\.length>2097152/, 'Worker tarafında da 2 MB sınırı doğrulanmalı');

assert.match(adminJs, /faviconImage:state\.data\.headerConfig\?\.faviconImage/, 'Site ikonu adresi header yapılandırmasında saklanmalı');
assert.match(html, /hf-favicon-width[\s\S]*hf-favicon-height/, 'Site ikonu için piksel ölçüsü alanları bulunmalı');
assert.match(html, /hf-favicon-logo-file/, 'Admin panelinde site ikonu yükleme alanı bulunmalı');
assert.match(workerJs, /\[\"header\",\"footer\",\"favicon\"\]/, 'Worker site ikonu PNG yüklemeyi desteklemeli');
assert.ok(readFileSync(resolve(root, 'index.html'), 'utf8').includes('rel="icon" type="image/png"'), 'Ana site PNG favicon bağlantısını içermeli');

assert.match(html, /id="hf-header-live-preview"/, 'Header için bağımsız canlı önizleme alanı bulunmalı');
assert.match(html, /id="hf-footer-live-preview"/, 'Footer için bağımsız canlı önizleme alanı bulunmalı');
assert.doesNotMatch(html, /id="hf-live-preview"/, 'Birleşik tam sayfa Header & Footer önizlemesi bulunmamalı');
assert.match(adminJs, /headerFooterPreviewDevices=\{header:'desktop',footer:'desktop'\}/, 'Header ve footer önizleme cihazları bağımsız tutulmalı');
assert.match(adminJs, /\$\('#hf-header-live-preview'\)/, 'Header önizlemesi yalnızca header alanına çizilmeli');
assert.match(adminJs, /\$\('#hf-footer-live-preview'\)/, 'Footer önizlemesi yalnızca footer alanına çizilmeli');
assert.doesNotMatch(adminJs, /hf-preview-content/, 'Tam sayfa örnek içerik önizleme fonksiyonu kaldırılmalı');

// Every sidebar destination must resolve to a real panel view.
const views = [...html.matchAll(/data-view=["']([^"']+)["']/g)].map(match => match[1]);
assert.ok(views.length > 0, 'Admin navigasyonunda en az bir bölüm bulunmalı');
for (const view of views) {
  assert.ok(ids.includes('view-' + view), 'Navigasyon hedefi bulunamadı: view-' + view);
}

// Static event bindings must point to elements that actually exist in the admin markup.
const boundIds = [...adminJs.matchAll(/\$\(['"]#([a-zA-Z0-9_-]+)['"]\)\.addEventListener/g)]
  .map(match => match[1]);
for (const id of new Set(boundIds)) {
  assert.ok(ids.includes(id), 'Olay dinleyicisinin hedefi HTML içinde bulunamadı: #' + id);
}

// Each form must have an explicit submit listener so save actions are not silently inert.
const formIds = [...html.matchAll(/<form\b[^>]*\bid=["']([^"']+)["']/g)].map(match => match[1]);
const submitIds = [...adminJs.matchAll(/\$\(['"]#([a-zA-Z0-9_-]+)['"]\)\.addEventListener\(['"]submit['"]/g)]
  .map(match => match[1]);
for (const id of formIds) {
  assert.ok(submitIds.includes(id), 'Form için kaydetme/submit olayı bulunamadı: #' + id);
}

// Mobile sidebar must have both the responsive closed state and its open state.
assert.match(adminCss, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.sidebar\s*\{[^}]*transform:\s*translateX\(-105%\)/,
  'Mobilde kenar menü başlangıçta ekran dışında olmalı');
assert.match(adminCss, /\.sidebar\.open\s*\{[^}]*transform:\s*translateX\(0\)/,
  'Mobil menü açılma durumu tanımlı olmalı');

console.log('PASS: Admin navigasyonundaki tüm bölümler gerçek bir panele bağlanıyor');
console.log('PASS: Statik olay dinleyicileri mevcut HTML kimliklerine bağlanıyor');
console.log('PASS: Admin formlarının tamamında submit/kaydetme olayı var');
console.log('PASS: Mobil kenar menünün açılma ve kapanma CSS durumları tanımlı');
