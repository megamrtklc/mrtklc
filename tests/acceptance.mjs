import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'https://megamrtklc.github.io/mrtklc/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const failures = [];
let adaletId = null;
const results = [];
page.on('pageerror', error => failures.push(error.message));

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, status: 'PASS' });
    console.log('PASS:', name);
  } catch (error) {
    results.push({ name, status: 'FAIL', error: error.message });
    console.error('FAIL:', name, error.message);
    throw error;
  }
}

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => {
    if (!window.Alpine || typeof window.Alpine.$data !== 'function') return false;
    const app = window.Alpine.$data(document.documentElement);
    return app && Array.isArray(app.catalog) && app.catalog.length >= 130;
  }, { timeout: 60000 });

  adaletId = await page.evaluate(() => window.Alpine.$data(document.documentElement).catalog.find(item => item.title === 'Adalet 2')?.id);
  assert.ok(adaletId, 'Adalet 2 katalogda bulunamadı');

  await check('Ana sayfa açılıyor ve katalog yükleniyor', async () => {
    assert.match(await page.title(), /CineVerse/i);
    assert.ok(await page.getByText('Tüm Yapımlar & Trendler', { exact: true }).count());
    const count = await page.evaluate(() => window.Alpine.$data(document.documentElement).catalog.length);
    assert.equal(count, 140);
  });

  await check('Mobil menü açılıyor ve sayfa geçişi yapıyor', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Menüyü aç veya kapat' }).click();
    const mobileMenu = page.locator('header div[x-show="mobileMenuOpen"]');
    await mobileMenu.waitFor({ state: 'visible' });
    await mobileMenu.getByRole('link', { name: 'Keşfet', exact: true }).click();
    await page.waitForURL(/#\/explore$/);
    assert.ok(await page.getByText('Keşfet & Arşiv Kataloğu', { exact: true }).isVisible());
  });

  await check('Üç tema arasında geçiş yapılabiliyor', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const themeButton = page.locator('header button').filter({ hasText: /Fil Dişi|Modern Gri|Karanlık Mod/ }).first();
    await themeButton.click();
    await page.getByRole('button', { name: 'Fil Dişi (Sıcak Krem)' }).click();
    await page.waitForFunction(() => document.documentElement.classList.contains('theme-ivory'));
    await themeButton.click();
    await page.getByRole('button', { name: 'Modern Gri (Slate)' }).click();
    await page.waitForFunction(() => document.documentElement.classList.contains('theme-slate'));
    await themeButton.click();
    await page.getByRole('button', { name: 'Karanlık Mod' }).click();
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
  });

  await check('Profil seçimi kalıcı kaydediliyor', async () => {
    await page.locator('header select').selectOption('pro_2');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('cine_active_profile') || 'null') === 'pro_2');
    await page.locator('header select').selectOption('pro_1');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('cine_active_profile') || 'null') === 'pro_1');
  });

  await check('İstatistikler sayfası açılıyor', async () => {
    await page.locator('header nav a').filter({ hasText: 'İstatistikler' }).first().click();
    await page.waitForURL(/#\/stats$/);
    await page.getByRole('heading', { name: 'İzleme İstatistikleri' }).waitFor({ state: 'visible' });
    assert.ok(await page.getByText('Tamamlanan filmler', { exact: true }).isVisible());
  });

  await check('Video bağlantıları sayfası ve detay oynatıcı açılıyor', async () => {
    await page.locator('header nav a').filter({ hasText: 'Video Bağlantıları' }).first().click();
    await page.waitForURL(/#\/video-links$/);
    await page.getByRole('heading', { name: 'Video İzleme Bağlantıları' }).waitFor({ state: 'visible' });
    const card = page.locator('main button').filter({ hasText: 'Adalet 2' }).first();
    await card.waitFor({ state: 'visible' });
    await card.click();
    await page.waitForURL(/#\/watch\//);
    await page.getByRole('heading', { name: 'Adalet 2' }).waitFor({ state: 'visible' });
    const video = page.locator('#customVideoPlayer');
    await video.waitFor({ state: 'attached' });
    assert.ok(await video.isVisible(), 'Doğrudan video oynatıcı görünür değil');
    const src = await video.getAttribute('src');
    assert.match(src || '', /\.mp4(?:$|[?#])/i, 'Oynatıcıya MP4 kaynağı bağlanmadı');
  });

  await check('İzleme listesine ekleme ve profil izolasyonu çalışıyor', async () => {
    const saveButton = page.locator('button').filter({ has: page.locator('span[x-text*="isInWatchlist"]') }).first();
    await saveButton.waitFor({ state: 'visible' });
    await saveButton.click();
    await page.waitForFunction(() => window.Alpine.$data(document.documentElement).isInWatchlist(window.Alpine.$data(document.documentElement).selectedItem));

    await page.locator('header select').selectOption('pro_2');
    await page.locator('header nav a').filter({ hasText: 'İzleme Listem' }).first().click();
    await page.waitForURL(/#\/watchlist$/);
    await page.getByText('İzleme Listesi Boş', { exact: true }).waitFor({ state: 'visible' });

    await page.locator('header select').selectOption('pro_1');
    await page.waitForFunction(expectedId => window.Alpine.$data(document.documentElement).watchlist.some(item => String(item.id) === String(expectedId)), adaletId);
    await page.locator('header nav a').filter({ hasText: 'İzleme Listem' }).first().click();
    await page.getByRole('heading', { name: 'Ana Profil - İzleme Listem' }).waitFor({ state: 'visible' });
    await page.getByText('Adalet 2', { exact: true }).waitFor({ state: 'visible' });
  });

  await check('Sayfa yenilenince detay rotası geri yükleniyor', async () => {
    await page.locator('header nav a').filter({ hasText: 'Video Bağlantıları' }).first().click();
    await page.waitForURL(/#\/video-links$/);
    await page.locator('main button').filter({ hasText: 'Adalet 2' }).first().click();
    await page.waitForURL(new RegExp('#/watch/' + adaletId + String.fromCharCode(36)));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(expectedId => window.Alpine && String(window.Alpine.$data(document.documentElement)?.selectedItem?.id) === String(expectedId), adaletId, { timeout: 30000 });
  });

  await check('Tarayıcıda yakalanan JavaScript çalışma zamanı hatası yok', async () => {
    assert.deepEqual(failures, []);
  });

  console.log(JSON.stringify({ baseURL: BASE_URL, results }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
