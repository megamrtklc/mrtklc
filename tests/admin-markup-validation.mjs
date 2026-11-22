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

// Every sidebar destination must resolve to a real panel view.
const views = [...html.matchAll(/data-view=["']([^"']+)["']/g)].map(match => match[1]);
assert.ok(views.length > 0, 'Admin navigasyonunda en az bir bölüm bulunmalı');
for (const view of views) {
  assert.ok(ids.includes('view-' + view), 'Navigasyon hedefi bulunamadı: view-' + view);
}

// Static event bindings must point to elements that actually exist in the admin markup.
const boundIds = [...adminJs.matchAll(/\\$\\(['"]#([a-zA-Z0-9_-]+)['"]\\)\\.addEventListener/g)]
  .map(match => match[1]);
for (const id of new Set(boundIds)) {
  assert.ok(ids.includes(id), 'Olay dinleyicisinin hedefi HTML içinde bulunamadı: #' + id);
}

// Each form must have an explicit submit listener so save actions are not silently inert.
const formIds = [...html.matchAll(/<form\\b[^>]*\\bid=["']([^"']+)["']/g)].map(match => match[1]);
for (const id of formIds) {
  assert.ok(
    new RegExp('\\\\$\\\\(["\\']#' + id + '["\\']\\\\)\\\\.addEventListener\\\\(["\\']submit["\\']').test(adminJs),
    'Form için kaydetme/submit olayı bulunamadı: #' + id
  );
}

// Mobile sidebar must have both the responsive closed state and its open state.
assert.match(adminCss, /@media\\s*\\(max-width:\\s*700px\\)[\\s\\S]*?\\.sidebar\\s*\\{[^}]*transform:\\s*translateX\\(-105%\\)/,
  'Mobilde kenar menü başlangıçta ekran dışında olmalı');
assert.match(adminCss, /\\.sidebar\\.open\\s*\\{[^}]*transform:\\s*translateX\\(0\\)/,
  'Mobil menü açılma durumu tanımlı olmalı');

console.log('PASS: Admin navigasyonundaki tüm bölümler gerçek bir panele bağlanıyor');
console.log('PASS: Statik olay dinleyicileri mevcut HTML kimliklerine bağlanıyor');
console.log('PASS: Admin formlarının tamamında submit/kaydetme olayı var');
console.log('PASS: Mobil kenar menünün açılma ve kapanma CSS durumları tanımlı');
