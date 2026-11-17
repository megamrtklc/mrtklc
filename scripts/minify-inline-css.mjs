import { readFile, writeFile } from 'node:fs/promises';
import CleanCSS from 'clean-css';

const path = 'index.html';
const html = await readFile(path, 'utf8');
const minifier = new CleanCSS({ level: 1, format: false });
let processed = 0;
let savedBytes = 0;

const optimized = html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (match, opening, css, closing) => {
  const result = minifier.minify(css);
  if (result.errors.length) {
    throw new Error('Inline CSS minification failed: ' + result.errors.join('; '));
  }
  if (!result.styles || result.styles.length > css.length) return match;
  processed += 1;
  savedBytes += Buffer.byteLength(css) - Buffer.byteLength(result.styles);
  return opening + result.styles + closing;
});

if (processed !== (html.match(/<style\b/gi) || []).length) {
  throw new Error('Not all inline style blocks were processed.');
}
if (savedBytes < 0) throw new Error('Unexpected negative CSS size reduction.');
await writeFile(path, optimized);
console.log(\`Inline CSS minified: \${processed} style blocks, \${savedBytes} bytes saved.\`);
