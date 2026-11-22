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
