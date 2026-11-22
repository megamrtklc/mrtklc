import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = new URL('../admin/', import.meta.url).pathname;
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.woff2':'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = normalize(pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
    if (relative.startsWith('..')) throw new Error('Invalid path');
    const body = await readFile(join(root, relative));
    res.writeHead(200, { 'content-type': mime[extname(relative)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
let data = { version: 1, catalog: [], collections: [], franchises: [], homepageConfig: { settings: {}, heroSlides: [], layout: {} } };
let sha = 'mock-sha-1';
const writes = [];
await page.route('**/api/**', async route => {
  const url = new URL(route.request().url());
  if (url.pathname === '/api/catalog' && route.request().method() === 'GET') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, sha, writable: true }) });
  }
  if (url.pathname === '/api/catalog' && route.request().method() === 'PUT') {
    const payload = route.request().postDataJSON();
    writes.push(payload);
    data = payload.data;
    sha = 'mock-sha-' + (writes.length + 1);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sha }) });
  }
  if (url.pathname === '/api/session') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ email: 'test@example.invalid' }) });
  if (url.pathname === '/api/profile-photo') return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  if (url.pathname === '/api/quality-history') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ history: [] }) });
  return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
});

try {
  await page.goto('http://127.0.0.1:' + address.port + '/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#health-catalog')?.textContent === 'Bağlandı');
  assert.equal(await page.locator('#health-catalog').textContent(), 'Bağlandı');

  // Mobile navigation opens, navigates, and closes.
  await page.locator('#mobile-menu').click();
  assert.equal(await page.locator('#sidebar').evaluate(el => el.classList.contains('open')), true);
  await page.locator('.nav-link[data-view="catalog"]').click();
  assert.equal(await page.locator('#view-catalog').evaluate(el => el.classList.contains('active')), true);
  assert.equal(await page.locator('#sidebar').evaluate(el => el.classList.contains('open')), false);

  // Create a catalog item through the real form and the mocked persistence API.
  await page.locator('#catalog-add').click();
  await page.locator('#field-title').fill('Tarayıcı Test Filmi');
  await page.locator('#field-year').fill('2026');
  await page.locator('#save-content').click();
  await page.waitForFunction(() => document.querySelector('#content-dialog')?.open === false);
  assert.equal(writes.length, 1, 'Yapım kaydı API PUT isteği üretmeli');
  assert.equal(data.catalog.length, 1);
  assert.equal(data.catalog[0].title, 'Tarayıcı Test Filmi');

  // Create a collection and ensure it references the selected catalog record.
  await page.locator('.nav-link[data-view="collections"]').click();
  await page.locator('#collection-add').click();
  await page.locator('#collection-title').fill('Tarayıcı Test Koleksiyonu');
  await page.locator('#collection-items input[type="checkbox"]').first().check();
  await page.locator('#collection-form button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('#collection-dialog')?.open === false);
  assert.equal(writes.length, 2, 'Koleksiyon kaydı API PUT isteği üretmeli');
  assert.equal(data.collections.length, 1);
  assert.deepEqual(data.collections[0].items, [String(data.catalog[0].id)]);

  console.log('PASS: Mobil yönetim menüsü açılıyor, gezinip kapanıyor');
  console.log('PASS: Yapım ekleme formu API üzerinden kaydediliyor');
  console.log('PASS: Koleksiyon oluşturma ve yapım ilişkilendirme kaydediliyor');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
