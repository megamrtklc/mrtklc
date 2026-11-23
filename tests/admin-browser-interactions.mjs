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
let data = {
  version: 1,
  catalog: [
    { id: 'seed-1', title: 'Başlangıç Filmi', type: 'movie', year: '2020', rating: '7.1' },
    { id: 'seed-2', title: 'İkinci Başlangıç', type: 'movie', year: '2021', rating: '7.4' }
  ],
  collections: [], franchises: [],
  homepageConfig: { settings: {}, heroSlides: [], layout: {} }
};
let sha = 'mock-sha-1';
const writes = [];
const putResponses = [];
const browserDiagnostics = { requests: [], failures: [], errors: [] };
page.on('request', request => { if (request.url().includes('/api/')) browserDiagnostics.requests.push(request.method() + ' ' + request.url()); });
page.on('requestfailed', request => browserDiagnostics.failures.push(request.url() + ' :: ' + request.failure()?.errorText));
page.on('pageerror', error => browserDiagnostics.errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') browserDiagnostics.errors.push(message.text()); });
await page.route('**/api/**', async route => {
  const url = new URL(route.request().url());
  if (url.pathname === '/api/catalog' && route.request().method() === 'GET') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, sha, writable: true }) });
  }
  if (url.pathname === '/api/catalog' && route.request().method() === 'PUT') {
    const payload = route.request().postDataJSON();
    writes.push(payload);
    const failure = putResponses.shift();
    if (failure) return route.fulfill({ status: failure.status, contentType: 'application/json', body: JSON.stringify(failure.body || {}) });
    data = payload.data;
    sha = 'mock-sha-' + (writes.length + 1);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sha }) });
  }
  if (url.pathname === '/api/session') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ email: 'test@example.invalid' }) });
  if (url.pathname === '/api/profile-photo') return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  if (url.pathname === '/api/quality-history') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ history: [] }) });
  return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
});

const catalogRow = title => page.locator('#catalog-rows tr').filter({ hasText: title });
const toastText = () => page.locator('#toast-message').textContent();

try {
  await page.goto('http://127.0.0.1:' + address.port + '/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#health-catalog')?.textContent !== 'Kontrol ediliyor', { timeout: 8000 }).catch(() => {});
  assert.equal(await page.locator('#health-catalog').textContent(), 'Bağlandı', 'Katalog başlangıç verisi yüklenemedi. ' + JSON.stringify({ status: await page.locator('#health-catalog').textContent(), notice: await page.locator('.notice').innerText().catch(() => ''), ...browserDiagnostics }));
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
  await page.waitForFunction(() => !document.querySelector('#view-content-editor')?.classList.contains('active'));
  assert.equal(writes.length, 1, 'Yapım kaydı API PUT isteği üretmeli');
  assert.equal(data.catalog.length, 3);
  assert.equal(data.catalog.find(x => x.title === 'Tarayıcı Test Filmi')?.year, '2026');

  // Edit the new item and verify its original ID is retained.
  const createdId = String(data.catalog.find(x => x.title === 'Tarayıcı Test Filmi').id);
  await catalogRow('Tarayıcı Test Filmi').locator('[data-edit]').click();
  assert.equal(await page.locator('#edit-id').inputValue(), createdId);
  await page.locator('#field-title').fill('Düzenlenmiş Test Filmi');
  await page.locator('#save-content').click();
  await page.waitForFunction(() => !document.querySelector('#view-content-editor')?.classList.contains('active'));
  assert.equal(writes.length, 2);
  assert.equal(data.catalog.find(x => String(x.id) === createdId)?.title, 'Düzenlenmiş Test Filmi');

  // A whitespace-only title must not be persisted and must leave the editor open.
  await page.locator('#catalog-add').click();
  await page.locator('#field-title').fill('   ');
  await page.locator('#save-content').click();
  await page.waitForFunction(() => document.querySelector('#toast-message')?.textContent.includes('Yapım adı zorunludur.'));
  assert.equal(writes.length, 2, 'Boş/boşluk başlık API isteği üretmemeli');
  assert.equal(await page.locator('#view-content-editor').evaluate(el => el.classList.contains('active')), true);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#cancel-editor').click();

  // API failure and 409 conflict must not close the editor or mutate local data.
  await catalogRow('Düzenlenmiş Test Filmi').locator('[data-edit]').click();
  await page.locator('#field-title').fill('Sunucu Hatası Testi');
  putResponses.push({ status: 500, body: { error: 'Test sunucu hatası' } });
  await page.locator('#save-content').click();
  await page.waitForFunction(() => document.querySelector('#toast-message')?.textContent.includes('Test sunucu hatası'));
  assert.equal(await page.locator('#view-content-editor').evaluate(el => el.classList.contains('active')), true);
  assert.equal(data.catalog.find(x => String(x.id) === createdId)?.title, 'Düzenlenmiş Test Filmi');

  putResponses.push({ status: 409, body: { error: 'Çakışma' } });
  await page.locator('#save-content').click();
  await page.waitForFunction(() => document.querySelector('#toast-message')?.textContent.includes('Katalog başka bir işlemde güncellenmiş'));
  assert.equal(await page.locator('#view-content-editor').evaluate(el => el.classList.contains('active')), true);
  assert.equal(data.catalog.find(x => String(x.id) === createdId)?.title, 'Düzenlenmiş Test Filmi');

  // A successful retry proves the save lock is released after failed requests.
  await page.locator('#save-content').click();
  await page.waitForFunction(() => !document.querySelector('#view-content-editor')?.classList.contains('active'));
  assert.equal(data.catalog.find(x => String(x.id) === createdId)?.title, 'Sunucu Hatası Testi');

  // Create a collection and ensure it references the selected catalog record.
  await page.locator('#mobile-menu').click();
  await page.locator('.nav-link[data-view="collections"]').click();
  await page.locator('#collection-add').click();
  await page.locator('#collection-title').fill('Tarayıcı Test Koleksiyonu');
  await page.locator('.collection-pick').filter({ hasText: 'Sunucu Hatası Testi' }).locator('input').check();
  await page.locator('#collection-form button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('#collection-dialog')?.open === false);
  assert.equal(data.collections.length, 1);
  assert.deepEqual(data.collections[0].items, [createdId]);

  // Deletion cancellation must be harmless; confirmation must remove the item and its collection reference.
  await page.locator('#mobile-menu').click();
  await page.locator('.nav-link[data-view="catalog"]').click();
  page.once('dialog', dialog => dialog.dismiss());
  await catalogRow('Sunucu Hatası Testi').locator('[data-delete]').click();
  assert.ok(data.catalog.some(x => String(x.id) === createdId), 'İptal edilen silme kaydı korumalı');
  page.once('dialog', dialog => dialog.accept());
  await catalogRow('Sunucu Hatası Testi').locator('[data-delete]').click();
  await page.waitForFunction(() => !document.querySelector('#catalog-rows')?.textContent.includes('Sunucu Hatası Testi'));
  assert.equal(data.catalog.some(x => String(x.id) === createdId), false);
  assert.deepEqual(data.collections[0].items, []);

  console.log('PASS: Mobil yönetim menüsü açılıyor, gezinip kapanıyor');
  console.log('PASS: Yapım ekleme ve düzenleme kayıtları API üzerinden işleniyor');
  console.log('PASS: Boş başlık kaydı engelleniyor');
  console.log('PASS: API hatası ve 409 çakışması doğru gösteriliyor; kayıt kilidi açılıyor');
  console.log('PASS: Koleksiyon oluşturma ve yapım ilişkilendirme kaydediliyor');
  console.log('PASS: Silme iptali güvenli; onaylı silme ilişkileri temizliyor');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
