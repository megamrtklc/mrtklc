import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, minified, html, acceptance] = await Promise.all([
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../app.min.js', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('./acceptance.mjs', import.meta.url), 'utf8')
]);

for (const [name, source] of [['app.js', app], ['app.min.js', minified]]) {
  assert.match(source, /isMobileHeroViewport/, name + ' mobil manşet görünüm durumunu içermeli');
  assert.match(source, /this\.isMobileHeroViewport\s*=\s*[^;]*matches/, name + ' ilk görünüm ve yeniden boyutlandırmada durumu güncellemeli');
}

assert.match(html, /:src="isMobileHeroViewport \? \(currentHero\.backdrop \|\| ''\) : ''"/,
  'Mobil manşet arka planı yalnızca mobil görünümde kaynak almalı');
assert.match(html, /:src="isMobileHeroViewport \? \(currentHero\.poster \|\| item\.image/,
  'Mobil manşet afişi yalnızca mobil görünümde kaynak almalı');
assert.match(html, /isMobileHeroViewport \? getTmdbImageSrcSet\(currentHero\.backdrop/,
  'Mobil manşet arka planının duyarlı kaynakları mobil görünümle sınırlı olmalı');
assert.match(acceptance, /hiddenMobileHeroSources/,
  'Üretim tarayıcı testi masaüstünde gizli mobil görsellerin kaynak almadığını doğrulamalı');
assert.match(acceptance, /setViewportSize\(\{ width: 1440, height: 900 \}\)/,
  'Üretim tarayıcı testi mobil/masaüstü boyut değişimini doğrulamalı');

console.log('PASS: Mobil manşet görselleri yalnızca mobil görünümde kaynak alıyor; uygulama ve küçültülmüş dosya eşleşiyor.');
