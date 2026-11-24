/**
 * Perde HTML birleştiricisi
 * Kaynak partial dosyalarını ana HTML ve gecikmeli runtime sayfalarına dönüştürür.
 * Kullanım: node scripts/assemble-html.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const shellPath = 'src/templates/index-shell.html';
const partialPaths = {
  HOME: 'src/templates/homepage.html',
  HOME_CATALOG_CONTENT: 'src/templates/home-catalog-content.html',
  HOME_PERSONALIZED_CONTENT: 'src/templates/home-personalized-content.html',
  HOME_CONTINUE_CONTENT: 'src/templates/home-continue-content.html',
  HOME_WATCHLIST_CONTENT: 'src/templates/home-watchlist-content.html',
  HOME_WATCHED_CONTENT: 'src/templates/home-watched-content.html',
  HOME_NEW_ARRIVALS_CONTENT: 'src/templates/home-new-arrivals-content.html',
  HOME_FAVORITES_CONTENT: 'src/templates/home-favorites-content.html',
  HOME_SERIES_TRACKING_CONTENT: 'src/templates/home-series-tracking-content.html',
  HOME_GENRE_DISCOVERY_CONTENT: 'src/templates/home-genre-discovery-content.html',
  HOME_FRANCHISES_CONTENT: 'src/templates/home-franchises-content.html',
  WATCH: 'src/templates/watch-page.html',
  WATCH_LEFT: 'src/templates/watch-left-column.html',
  WATCH_RIGHT: 'src/templates/watch-right-column.html',
  WATCH_TRAILER_MODAL: 'src/templates/watch-trailer-modal.html',
  ACTOR_DIRECTOR: 'src/templates/actor-director-page.html',
  EXPLORE: 'src/templates/explore-page.html',
  FRANCHISES: 'src/templates/franchises-page.html',
  WATCHLIST: 'src/templates/watchlist-page.html',
  WATCHLIST_CONFIRM_MODAL: 'src/templates/watchlist-confirm-modal.html',
  LIBRARY: 'src/templates/library-page.html',
  STATS: 'src/templates/stats-page.html',
  VIDEO_LINKS: 'src/templates/video-links-page.html',
  HEADER: 'src/templates/header.html',
  SEARCH_OVERLAY: 'src/templates/search-overlay.html',
  FOOTER: 'src/templates/footer.html'
};
const partials = Object.fromEntries(await Promise.all(
  Object.entries(partialPaths).map(async ([name, path]) => [name, await readFile(path, 'utf8')])
));

function replacePartialMarkers(source, names, context) {
  let result = source;
  for (const name of names) {
    const marker = `<!-- PERDE_TEMPLATE:${name} -->`;
    const occurrences = result.split(marker).length - 1;
    if (occurrences !== 1) throw new Error(`Şablon işareti tam bir kez bulunmalı: ${marker} (${context}, bulunan: ${occurrences})`);
    result = result.replace(marker, partials[name].trimEnd());
  }
  return result;
}

const runtimePages = {
  watch: { marker: 'WATCH', nested: ['WATCH_LEFT', 'WATCH_RIGHT', 'WATCH_TRAILER_MODAL'] },
  'actor-director': { marker: 'ACTOR_DIRECTOR', nested: [] },
  explore: { marker: 'EXPLORE', nested: [] },
  franchises: { marker: 'FRANCHISES', nested: [] },
  watchlist: { marker: 'WATCHLIST', nested: [] },
  library: { marker: 'LIBRARY', nested: [] },
  stats: { marker: 'STATS', nested: [] },
  'video-links': { marker: 'VIDEO_LINKS', nested: [] }
};

await mkdir('runtime-pages', { recursive: true });

const homeCatalogMarker = '<!-- PERDE_TEMPLATE:HOME_CATALOG_CONTENT -->';
if (partials.HOME.split(homeCatalogMarker).length - 1 !== 1) throw new Error('Ana sayfa katalog parçası tam bir kez bulunmalı.');
const homeCatalogPlaceholder = `
                    <!-- Katalog kartları görünür alana yaklaşınca ayrı dosyadan yüklenir. -->
                    <div class="home-catalog-loading" role="status" aria-live="polite" aria-label="Katalog yükleniyor">
                        <div class="home-catalog-loading-heading"><span></span><span></span></div>
                        <div class="home-catalog-loading-grid">${Array.from({ length: 8 }, () => '<span class="home-catalog-loading-card"></span>').join('')}</div>
                    </div>
                `.trim();

// Ana sayfanın kişisel rafları da görünür alana yaklaşınca ayrı HTML dosyalarından yüklenir.
const homeFragments = [
  { slug: 'personalized', partial: 'HOME_PERSONALIZED_CONTENT', label: 'Sana Özel Öneriler' },
  { slug: 'continue', partial: 'HOME_CONTINUE_CONTENT', label: 'İzlemeye Devam Et' },
  { slug: 'watchlist', partial: 'HOME_WATCHLIST_CONTENT', label: 'İzleme Listem' },
  { slug: 'watched', partial: 'HOME_WATCHED_CONTENT', label: 'İzlediklerim' },
  { slug: 'new-arrivals', partial: 'HOME_NEW_ARRIVALS_CONTENT', label: 'Son Eklenenler' },
  { slug: 'favorites', partial: 'HOME_FAVORITES_CONTENT', label: 'Favorilerim' },
  { slug: 'series-tracking', partial: 'HOME_SERIES_TRACKING_CONTENT', label: 'Dizi Takibi' },
  { slug: 'genre-discovery', partial: 'HOME_GENRE_DISCOVERY_CONTENT', label: 'Türlere Göre Keşfet' },
  { slug: 'franchises', partial: 'HOME_FRANCHISES_CONTENT', label: 'Seri Filmler' }
];
let homeTemplate = partials.HOME.replace(homeCatalogMarker, homeCatalogPlaceholder);
for (const fragment of homeFragments) {
  const marker = `<!-- PERDE_TEMPLATE:${fragment.partial} -->`;
  if (partials.HOME.split(marker).length - 1 !== 1) throw new Error(`Ana sayfa parçası tam bir kez bulunmalı: ${marker}`);
  const placeholder = `
                    <!-- ${fragment.label}: görünür alana yaklaşınca ayrı dosyadan yüklenir. -->
                    <div class="home-catalog-loading" role="status" aria-live="polite" aria-label="${fragment.label} yükleniyor">
                        <div class="home-catalog-loading-heading"><span></span><span></span></div>
                        <div class="home-catalog-loading-grid">${Array.from({ length: 4 }, () => '<span class="home-catalog-loading-card"></span>').join('')}</div>
                    </div>
                `.trim();
  homeTemplate = homeTemplate.replace(marker, placeholder);
  await writeFile(`runtime-pages/home-${fragment.slug}.html`, partials[fragment.partial].trimEnd());
}
await writeFile('runtime-pages/home-catalog.html', partials.HOME_CATALOG_CONTENT.trimEnd());

for (const [key, config] of Object.entries(runtimePages)) {
  const pageHtml = replacePartialMarkers(partials[config.marker], config.nested, `runtime page ${key}`);
  if (/<!-- PERDE_TEMPLATE:[A-Z0-9_-]+ -->/.test(pageHtml)) throw new Error(`Runtime sayfada çözülmemiş şablon işareti kaldı: ${key}`);
  await writeFile(`runtime-pages/${key}.html`, pageHtml);
}

const lazyHost = key => `
        <!-- İhtiyaç anında indirilen sayfa: ${key} -->
        <div x-data="perdeLazyPage('${key}')" x-init="init()" class="contents">
            <div x-show="loading && isActive()" class="w-full min-h-[30vh] flex items-center justify-center px-6 py-12 text-sm font-semibold text-gray-500 dark:text-gray-400" role="status">
                <span class="inline-flex items-center gap-3"><i class="fa-solid fa-circle-notch fa-spin text-rose-500"></i> Sayfa yükleniyor…</span>
            </div>
            <div x-show="error && isActive()" class="mx-auto my-10 max-w-xl rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-center" role="alert">
                <p class="text-sm font-semibold text-gray-700 dark:text-gray-200" x-text="error"></p>
                <button type="button" @click="load()" class="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white">Yeniden dene</button>
            </div>
            <div x-show="loaded" x-html="html"></div>
        </div>`.trim();

let html = await readFile(shellPath, 'utf8');
for (const name of ['HOME', 'WATCHLIST_CONFIRM_MODAL', 'HEADER', 'SEARCH_OVERLAY', 'FOOTER']) {
  const marker = `<!-- PERDE_TEMPLATE:${name} -->`;
  const occurrences = html.split(marker).length - 1;
  if (occurrences !== 1) throw new Error(`Şablon işareti tam bir kez bulunmalı: ${marker} (bulunan: ${occurrences})`);
  const content = name === 'HOME' ? homeTemplate : partials[name];
  html = html.replace(marker, content.trimEnd());
}
for (const [key, config] of Object.entries(runtimePages)) {
  const marker = `<!-- PERDE_TEMPLATE:${config.marker} -->`;
  const occurrences = html.split(marker).length - 1;
  if (occurrences !== 1) throw new Error(`Şablon işareti tam bir kez bulunmalı: ${marker} (bulunan: ${occurrences})`);
  html = html.replace(marker, lazyHost(key));
}
if (/<!-- PERDE_TEMPLATE:[A-Z0-9_-]+ -->/.test(html)) throw new Error('Birleştirilmemiş Perde şablon işareti kaldı.');
await writeFile('index.html', html);
console.log(`HTML birleştirildi: index.html (${html.split(String.fromCharCode(10)).length} satır)`);
console.log(`Gecikmeli sayfalar üretildi: ${Object.keys(runtimePages).length}`);
