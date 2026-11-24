/**
 * Perde HTML birleştiricisi
 * Kaynak partial dosyalarını ana HTML ve gecikmeli runtime sayfalarına dönüştürür.
 * Kullanım: node scripts/assemble-html.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const shellPath = 'src/templates/index-shell.html';
const partialPaths = {
  HOME: 'src/templates/homepage.html',
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
  html = html.replace(marker, partials[name].trimEnd());
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
