/**
 * HTML şablon modülerleştirme sözleşmesi
 * --------------------------------------
 * Ana sayfa partial'ının kaynak kabuğa doğru bağlandığını ve yayın çıktısında
 * çözülmemiş şablon işareti kalmadığını denetler.
 */
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const [shell, homepage, watchPage, output] = await Promise.all([
  readFile('src/templates/index-shell.html', 'utf8'),
  readFile('src/templates/homepage.html', 'utf8'),
  readFile('src/templates/watch-page.html', 'utf8'),
  readFile('index.html', 'utf8')
]);

assert.equal((shell.match(/<!-- PERDE_TEMPLATE:HOME -->/g) || []).length, 1,
  'Kaynak kabukta HOME işareti tam bir kez bulunmalı.');
assert.equal((shell.match(/<!-- PERDE_TEMPLATE:WATCH -->/g) || []).length, 1,
  'Kaynak kabukta WATCH işareti tam bir kez bulunmalı.');
assert.match(homepage, /HOME PAGE/,
  'Ana sayfa partial dosyası ana sayfa görünümünü içermeli.');
assert.doesNotMatch(homepage, /WATCH \/ DETAIL PAGE/,
  'Ana sayfa partial dosyası detay sayfasının içeriğini kapsamamalı.');
assert.match(watchPage, /currentPage === "watch"|currentPage === 'watch'/,
  'İzleme partial dosyası watch sayfa koşulunu içermeli.');
assert.doesNotMatch(watchPage, /EXPLORE PAGE/,
  'İzleme partial dosyası keşfet sayfasının içeriğini kapsamamalı.');
assert.doesNotMatch(output, /<!-- PERDE_TEMPLATE:[A-Z0-9_-]+ -->/,
  'Yayın çıktısında çözülmemiş şablon işareti kalmamalı.');
assert.match(output, /<template x-if="currentPage === 'home'">/,
  'Üretilmiş index ana sayfa Alpine görünümünü içermeli.');
assert.match(output, /<template x-if="currentPage === 'watch'">/,
  'Üretilmiş index izleme Alpine görünümünü içermeli.');

console.log('HTML assembly contract: OK');
