/**
 * Perde HTML birleştiricisi
 * -------------------------
 * src/templates/index-shell.html içindeki şablon işaretlerini, bağımsız HTML
 * parçalarıyla değiştirerek GitHub Pages için kullanılabilir index.html üretir.
 *
 * Kullanım: node scripts/assemble-html.mjs
 *
 * Not: Bu betik yalnızca kaynak şablonları birleştirir; katalog/manşet verisi
 * üretimi build-hero-data.mjs tarafından ayrı aşamada yapılır.
 */
import { readFile, writeFile } from 'node:fs/promises';

const shellPath = 'src/templates/index-shell.html';
const outputPath = 'index.html';
const partials = {
  HOME: 'src/templates/homepage.html'
};

let html = await readFile(shellPath, 'utf8');

for (const [name, path] of Object.entries(partials)) {
  const marker = `<!-- PERDE_TEMPLATE:${name} -->`;
  const occurrences = html.split(marker).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Şablon işareti tam bir kez bulunmalı: ${marker} (bulunan: ${occurrences})`);
  }
  const partial = await readFile(path, 'utf8');
  html = html.replace(marker, partial.trimEnd());
}

if (/<!-- PERDE_TEMPLATE:[A-Z0-9_-]+ -->/.test(html)) {
  throw new Error('Birleştirilmemiş Perde şablon işareti kaldı.');
}

await writeFile(outputPath, html);
console.log(`HTML birleştirildi: ${outputPath} (${html.split(/\\n/).length} satır)`);
