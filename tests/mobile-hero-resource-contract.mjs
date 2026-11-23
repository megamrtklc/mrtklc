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
assert.match(html, /:src="isMobileHeroViewport \? \(currentHero\.poster \|\| currentHero\.image/,
  'Mobil manşet afişi yalnızca mobil görünümde kaynak almalı');
assert.match(html, /isMobileHeroViewport \? getTmdbImageSrcSet\(currentHero\.backdrop/,
  'Mobil manşet arka planının duyarlı kaynakları mobil görünümle sınırlı olmalı');
assert.match(acceptance, /hiddenMobileHeroSources/,
  'Üretim tarayıcı testi masaüstünde gizli mobil görsellerin kaynak almadığını doğrulamalı');
assert.match(acceptance, /setViewportSize\(\{ width: 1440, height: 900 \}\)/,
  'Üretim tarayıcı testi mobil/masaüstü boyut değişimini doğrulamalı');

const optimizedCatalogPosterMarkup = ":src=\"getTmdbImageSrcSet(item.poster || item.image || item.tmdbPoster || item.backdrop, [154]).split(' ')[0] || item.poster || item.image || item.tmdbPoster || item.backdrop\" :srcset=\"getTmdbImageSrcSet(item.poster || item.image || item.tmdbPoster || item.backdrop, [154, 185, 260, 312, 342])\" sizes=\"(max-width: 639px) 148px, 178px\"";
assert.equal(html.split(optimizedCatalogPosterMarkup).length - 1, 4,
  'Katalog kartlarının dört afiş şablonu küçük başlangıç kaynağı ve duyarlı boyut adaylarını kullanmalı');
assert.match(acceptance, /Katalog afişinin başlangıç kaynağı gereğinden büyük/,
  'Üretim tarayıcı testi katalog afişlerinin başlangıç kaynağını doğrulamalı');

assert.ok(html.includes("source.replace(/\\\\/t\\\\/p\\\\/(?:w\\\\d+|original)\\\\//, '/t/p/w' + targetWidth + '/')"),\n  'Masaüstü manşet görseli mevcut TMDB boyutu ne olursa olsun hedef boyuta dönüştürülmeli');\nassert.ok(html.includes("const targetWidth = Math.min(window.innerWidth, 1800) * 0.7 * (window.devicePixelRatio || 1) >= 1024 ? 1280 : 1024;"),
  'Masaüstü manşet görseli ekran genişliği ve piksel yoğunluğuna göre boyut seçmeli');
assert.ok(acceptance.includes('Masaüstü manşet arka planı ekran yoğunluğuna uygun TMDB boyutunu seçiyor'),
  'Üretim tarayıcı testi masaüstü manşet görselinin boyutunu doğrulamalı');

console.log('PASS: Mobil manşet görselleri yalnızca mobil görünümde kaynak alıyor; uygulama ve küçültülmüş dosya eşleşiyor.');
