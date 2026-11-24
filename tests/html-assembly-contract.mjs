/**
 * HTML şablon modülerleştirme sözleşmesi
 * --------------------------------------
 * Ana sayfa partial'ının kaynak kabuğa doğru bağlandığını ve yayın çıktısında
 * çözülmemiş şablon işareti kalmadığını denetler.
 */
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const [shell, homepage, watchPage, explorePage, watchlistPage, libraryPage, statsPage, videoLinksPage, output] = await Promise.all([
  readFile('src/templates/index-shell.html', 'utf8'),
  readFile('src/templates/homepage.html', 'utf8'),
  readFile('src/templates/watch-page.html', 'utf8'),
  readFile('src/templates/explore-page.html', 'utf8'),
  readFile('src/templates/watchlist-page.html', 'utf8'),
  readFile('src/templates/library-page.html', 'utf8'),
  readFile('src/templates/stats-page.html', 'utf8'),
  readFile('src/templates/video-links-page.html', 'utf8'),
  readFile('index.html', 'utf8')
]);

assert.equal((shell.match(/<!-- PERDE_TEMPLATE:HOME -->/g) || []).length, 1,
  'Kaynak kabukta HOME işareti tam bir kez bulunmalı.');
assert.equal((shell.match(/<!-- PERDE_TEMPLATE:WATCH -->/g) || []).length, 1,
  'Kaynak kabukta WATCH işareti tam bir kez bulunmalı.');
assert.equal((shell.match(/<!-- PERDE_TEMPLATE:EXPLORE -->/g) || []).length, 1,
  'Kaynak kabukta EXPLORE işareti tam bir kez bulunmalı.');
assert.equal((shell.match(/<!-- PERDE_TEMPLATE:WATCHLIST -->/g) || []).length, 1, 'Kaynak kabukta WATCHLIST işareti tam bir kez bulunmalı.');
assert.equal((shell.match(/<!-- PERDE_TEMPLATE:LIBRARY -->/g) || []).length, 1, 'Kaynak kabukta LIBRARY işareti tam bir kez bulunmalı.');
assert.equal((shell.match(/<!-- PERDE_TEMPLATE:STATS -->/g) || []).length, 1, 'Kaynak kabukta STATS işareti tam bir kez bulunmalı.');
assert.equal((shell.match(/<!-- PERDE_TEMPLATE:VIDEO_LINKS -->/g) || []).length, 1, 'Kaynak kabukta VIDEO_LINKS işareti tam bir kez bulunmalı.');
assert.match(watchlistPage, /WATCHLIST PAGE/, 'İzleme listesi partial dosyası izleme listesi görünümünü içermeli.');
assert.doesNotMatch(watchlistPage, /PERSONAL WATCH CENTER/, 'İzleme listesi partial dosyası kişisel kütüphane görünümünü kapsamamalı.');
assert.match(libraryPage, /PERSONAL WATCH CENTER/, 'Kütüphane partial dosyası kişisel izleme merkezini içermeli.');
assert.doesNotMatch(libraryPage, /WATCHING STATISTICS PAGE/, 'Kütüphane partial dosyası izleme istatistikleri sayfasını kapsamamalı.');
assert.match(statsPage, /WATCHING STATISTICS PAGE/, 'İstatistik partial dosyası izleme istatistikleri sayfasını içermeli.');
assert.match(statsPage, /currentPage === 'stats'/, 'İstatistik partial dosyası stats sayfa koşulunu içermeli.');
assert.doesNotMatch(statsPage, /CineVerse Responsive Footer/, 'İstatistik partial dosyası footer alanını kapsamamalı.');
assert.match(videoLinksPage, /TEMPORARY VIDEO LINKS PAGE/, 'Video bağlantıları partial dosyası ilgili sayfayı içermeli.');
assert.match(videoLinksPage, /currentPage === 'video-links'/, 'Video bağlantıları partial dosyası sayfa koşulunu içermeli.');
assert.doesNotMatch(videoLinksPage, /WATCHLIST PAGE/, 'Video bağlantıları partial dosyası izleme listesini kapsamamalı.');
assert.match(homepage, /HOME PAGE/,
  'Ana sayfa partial dosyası ana sayfa görünümünü içermeli.');
assert.doesNotMatch(homepage, /WATCH \/ DETAIL PAGE/,
  'Ana sayfa partial dosyası detay sayfasının içeriğini kapsamamalı.');
assert.match(watchPage, /currentPage === "watch"|currentPage === 'watch'/,
  'İzleme partial dosyası watch sayfa koşulunu içermeli.');
assert.doesNotMatch(watchPage, /EXPLORE PAGE/,
  'İzleme partial dosyası keşfet sayfasının içeriğini kapsamamalı.');
assert.match(explorePage, /EXPLORE PAGE/,
  'Keşfet partial dosyası keşfet görünümünü içermeli.');
assert.doesNotMatch(explorePage, /TEMPORARY VIDEO LINKS PAGE/,
  'Keşfet partial dosyası video bağlantıları sayfasını kapsamamalı.');
assert.doesNotMatch(output, /<!-- PERDE_TEMPLATE:[A-Z0-9_-]+ -->/,
  'Yayın çıktısında çözülmemiş şablon işareti kalmamalı.');
assert.match(output, /<template x-if="currentPage === 'home'">/,
  'Üretilmiş index ana sayfa Alpine görünümünü içermeli.');
assert.match(output, /<template x-if="currentPage === 'watch'">/,
  'Üretilmiş index izleme Alpine görünümünü içermeli.');
assert.match(output, /<template x-if="currentPage === 'explore'">/,
  'Üretilmiş index keşfet Alpine görünümünü içermeli.');

assert.match(output, /<template x-if="currentPage === 'watchlist'">/, 'Üretilmiş index izleme listesi Alpine görünümünü içermeli.');
assert.match(output, /<template x-if="currentPage === 'library'">/, 'Üretilmiş index kişisel kütüphane Alpine görünümünü içermeli.');
assert.match(output, /<template x-if="currentPage === 'stats'">/, 'Üretilmiş index istatistik Alpine görünümünü içermeli.');
assert.match(output, /<template x-if="currentPage === 'video-links'">/, 'Üretilmiş index video bağlantıları Alpine görünümünü içermeli.');
console.log('HTML assembly contract: OK');
