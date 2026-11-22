import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'https://megamrtklc.github.io/mrtklc/';
const TV_UA = 'Mozilla/5.0 (Linux; Android 11; SHIELD Android TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const browser = await chromium.launch({ headless: true });

try {
  const tv = await browser.newContext({ viewport: { width: 1920, height: 1080 }, userAgent: TV_UA });
  const page = await tv.newPage();
  const castRequests = [];
  const errors = [];
  page.on('request', request => {
    if (/catalog-cast\.json/i.test(request.url())) castRequests.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.stack || error.message));
  await page.addInitScript(() => {
    window.__alpineExpressionDiagnostics = [];
    for (const method of ['error', 'warn']) {
      const original = console[method].bind(console);
      console[method] = (...args) => {
        if (args.some(value => String(value).includes('Alpine Expression Error'))) {
          window.__alpineExpressionDiagnostics.push(args.map(value => {
            if (value instanceof Element) return value.outerHTML.slice(0, 1800);
            return String(value);
          }));
        }
        original(...args);
      };
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => {
    const app = window.Alpine?.$data(document.documentElement);
    return document.documentElement.classList.contains('cv-tv-mode') &&
      app && Array.isArray(app.catalog) && app.catalog.length >= 130 && !app.catalogLoading;
  }, { timeout: 60000 });
  await page.waitForTimeout(3500);

  const tvState = await page.evaluate(() => {
    const app = window.Alpine.$data(document.documentElement);
    const recommendation = document.querySelector('[data-home-section="personalized"]');
    return {
      mode: document.documentElement.dataset.cvDeviceMode,
      recommendationDisplay: recommendation ? getComputedStyle(recommendation).display : null,
      recommendationReady: app.homeSectionReady?.personalized ?? false,
      pageHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      activeSlide: app.currentSlideIndex,
      catalogCount: app.catalog.length
    };
  });
  assert.equal(tvState.mode, 'tv', 'Android TV user-agent TV moduna alınmadı');
  assert.equal(tvState.recommendationDisplay, 'none', 'TV ana sayfasında öneri alanı gizlenmedi');
  assert.equal(tvState.recommendationReady, false, 'TV için öneri puanlama/hazırlama çalıştırıldı');
  assert.ok(tvState.catalogCount >= 130, 'TV kataloğu eksik yüklendi');
  assert.equal(castRequests.length, 0, 'TV açılışında gereksiz kadro JSON verisi indirildi');
  assert.ok(tvState.pageHeight > tvState.viewportHeight, 'TV sayfası kaydırılabilir değil');

  await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement?.blur?.(); });
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
  const scrollAfterDown = await page.evaluate(() => window.scrollY);
  assert.ok(scrollAfterDown > 0, 'Kumanda aşağı yön tuşu sayfayı kaydırmadı');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(150);
  const scrollAfterUp = await page.evaluate(() => window.scrollY);
  assert.ok(scrollAfterUp < scrollAfterDown, 'Kumanda yukarı yön tuşu sayfayı geri kaydırmadı');
  const alpineDiagnostics = await page.evaluate(() => window.__alpineExpressionDiagnostics || []);
  if (alpineDiagnostics.length) console.error('ALPINE EXPRESSION DIAGNOSTICS:', JSON.stringify(alpineDiagnostics));
  assert.deepEqual(errors, [], 'Android TV sayfasında JavaScript hatası oluştu');
  console.log('PASS: Genel Android TV algılama, sade ana sayfa, ertelenen veriler ve kumanda ile dikey gezinme', JSON.stringify({ ...tvState, scrollAfterDown, scrollAfterUp }));
  await tv.close();

  const mobile = await browser.newContext({
    viewport: { width: 393, height: 873 },
    userAgent: MOBILE_UA,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const mobileMode = await mobilePage.evaluate(() => ({
    tvClass: document.documentElement.classList.contains('cv-tv-mode'),
    deviceMode: document.documentElement.dataset.cvDeviceMode || null
  }));
  assert.equal(mobileMode.tvClass, false, 'Android telefon yanlışlıkla TV olarak algılandı');
  console.log('PASS: Android telefon TV moduna alınmadı', JSON.stringify(mobileMode));
  await mobile.close();

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktopPage = await desktop.newPage();
  await desktopPage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const desktopMode = await desktopPage.evaluate(() => document.documentElement.classList.contains('cv-tv-mode'));
  assert.equal(desktopMode, false, 'Masaüstü tarayıcı yanlışlıkla TV olarak algılandı');
  console.log('PASS: Masaüstü görünümü TV modundan etkilenmedi');
  await desktop.close();
} finally {
  await browser.close();
}
