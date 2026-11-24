/**
 * HTML şablon modülerleştirme sözleşmesi
 * --------------------------------------
 * Ana sayfa partial'ının kaynak kabuğa doğru bağlandığını ve yayın çıktısında
 * çözülmemiş şablon işareti kalmadığını denetler.
 */
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const [shell, homepage, output] = await Promise.all([
  readFile('src/templates/index-shell.html', 'utf8'),
  readFile('src/templates/homepage.html', 'utf8'),
  readFile('index.html', 'utf8')
]);

assert.equal((shell.match(/<!-- PERDE_TEMPLATE:HOME -->/g) || []).length, 1,
  'Kaynak kabukta HOME işareti tam bir kez bulunmalı.');
assert.match(homepage, /HOME PAGE/,
  'Ana sayfa partial dosyası ana sayfa görünümünü içermeli.');
assert.match(homepage, /WATCH \/ DETAIL PAGE/,
  'Ana sayfa partial dosyası detay sayfasından önce bitmeli.');
assert.doesNotMatch(output, /<!-- PERDE_TEMPLATE:[A-Z0-9_-]+ -->/,
  'Yayın çıktısında çözülmemiş şablon işareti kalmamalı.');
assert.match(output, /<template x-if="currentPage === 'home'">/,
  'Üretilmiş index ana sayfa Alpine görünümünü içermeli.');

console.log('HTML assembly contract: OK');
