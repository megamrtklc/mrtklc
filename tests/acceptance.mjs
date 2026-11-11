// Re-run after the latest production deployment.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'https://megamrtklc.github.io/mrtklc/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const failures = [];
const failedResources = [];
let adaletId = null;
const results = [];
page.on('pageerror', error => failures.push(error.message));
page.on('response', response => {
  if (response.status() >= 400) failedResources.push({ status: response.status(), url: response.url() });
});

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
    const responsiveSources = await page.locator('img[srcset]').evaluateAll(images => images.map(image => image.getAttribute('srcset') || '').filter(Boolean));
    console.log('RESPONSIVE IMAGE SOURCES:', JSON.stringify(responsiveSources.slice(0, 8)));
    assert.ok(responsiveSources.some(source => source.includes('w185')) && responsiveSources.some(source => source.includes('w780')), 'TMDB afiş veya hero görsellerinde duyarlı kaynaklar bulunamadı');
  });

  await check('Ana sayfa hero görseli afiş yedeğiyle yükleniyor', async () => {
    const heroImage = page.locator('img[fetchpriority="high"]');
    await page.waitForFunction(() => {
      const image = document.querySelector('img[fetchpriority="high"]');
      return image && image.complete && image.naturalWidth > 0;
    }, { timeout: 30000 });
    const imageState = await heroImage.evaluate(image => ({
      currentSrc: image.currentSrc,
      src: image.src,
      fallbackAttribute: image.getAttribute('data-fallback-src'),
      fallbackDataset: image.dataset.fallbackSrc,
      naturalWidth: image.naturalWidth,
      posterFallbackUsed: image.dataset.perdePosterFallbackApplied === 'true',
      placeholderUsed: image.dataset.perdeFallbackApplied === 'true'
    }));
    console.log('HERO IMAGE:', JSON.stringify(imageState));
    assert.ok(imageState.naturalWidth > 0 && !imageState.placeholderUsed, 'Hero görseli gerçek bir görsele yüklenemedi');
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

  await check('Mobil, tablet ve masaüstünde yatay taşma kontrolü', async () => {
    for (const viewport of [
      { width: 320, height: 800 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1024, height: 900 },
      { width: 1280, height: 900 },
      { width: 1440, height: 1000 }
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(120);
      const dimensions = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const offenders = [...document.querySelectorAll('body *')]
          .map(el => ({ tag: el.tagName, id: el.id, cls: typeof el.className === 'string' ? el.className.slice(0, 180) : '', left: Math.round(el.getBoundingClientRect().left), right: Math.round(el.getBoundingClientRect().right), width: Math.round(el.getBoundingClientRect().width), text: (el.innerText || '').trim().slice(0, 70) }))
          .filter(el => el.right > width + 2 && el.width > 0)
          .sort((a, b) => b.right - a.right)
          .slice(0, 12);
        return { viewport: width, page: document.documentElement.scrollWidth, offenders };
      });
      if (dimensions.page > dimensions.viewport + 1) console.log('OVERFLOW DETAILS:', JSON.stringify(dimensions.offenders));
      assert.ok(
        dimensions.page <= dimensions.viewport + 1,
        `Yatay taşma var: ${viewport.width}px ekranda sayfa ${dimensions.page}px genişliğinde`
      );
    }
  });

  await check('Üç tema arasında geçiş yapılabiliyor', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const themeButton = page.locator('header button').filter({ hasText: /Fil Dişi|Modern Gri|Karanlık Mod/ }).first();
    await themeButton.click();
    await page.getByRole('button', { name: 'Fil Dişi (Sıcak Krem)' }).click();
    await page.waitForFunction(() => document.documentElement.classList.contains('theme-ivory'));
    const ivoryColors = await page.evaluate(() => {
      const select = document.querySelector('header select');
      const surface = select?.closest('div.rounded-lg');
      if (!select || !surface) return null;
      const box = getComputedStyle(surface);
      return { background: box.backgroundColor, text: getComputedStyle(select).color, border: box.borderTopColor };
    });
    assert.ok(ivoryColors, 'Fil Dişi temasında gerçek profil kartı bulunamadı');
    assert.deepEqual(ivoryColors, {
      background: 'rgb(255, 253, 249)',
      text: 'rgb(41, 38, 31)',
      border: 'rgb(235, 231, 221)'
    }, 'Fil Dişi temasında kutu, metin veya kenarlık kontrastı uygulanmadı');

    await themeButton.click();
    await page.getByRole('button', { name: 'Modern Gri (Slate)' }).click();
    await page.waitForFunction(() => document.documentElement.classList.contains('theme-slate'));
    const slateColors = await page.evaluate(() => {
      const select = document.querySelector('header select');
      const surface = select?.closest('div.rounded-lg');
      if (!select || !surface) return null;
      const box = getComputedStyle(surface);
      return { background: box.backgroundColor, text: getComputedStyle(select).color, border: box.borderTopColor };
    });
    assert.ok(slateColors, 'Modern Gri temasında gerçek profil kartı bulunamadı');
    assert.deepEqual(slateColors, {
      background: 'rgb(255, 255, 255)',
      text: 'rgb(32, 36, 43)',
      border: 'rgb(216, 219, 226)'
    }, 'Modern Gri temasında kutu, metin veya kenarlık kontrastı uygulanmadı');

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

  await check('Dizi bölüm takibi ve profil bazlı izleme ilerlemesi', async () => {
    await page.evaluate(() => {
      const app = window.Alpine.$data(document.documentElement);
      const series = app.catalog.find(item => item.id === 'archive-6');
      app.openWatchPage(series);
    });
    await page.waitForFunction(() => {
      const app = window.Alpine.$data(document.documentElement);
      return app.currentPage === 'watch' && String(app.selectedItem?.id) === 'archive-6';
    });
    await page.evaluate(() => {
      const app = window.Alpine.$data(document.documentElement);
      app.tmdbDetailsLoading = false;
      app.tmdbSeasonLoading = false;
      app.selectedSeason = 1;
      app.selectedItem.tmdbEpisodesBySeason = {
        1: [
          { number: 1, title: 'Kabul Testi Bölümü', duration: '42 dk', still: '' },
          { number: 2, title: 'İkinci Kabul Bölümü', duration: '43 dk', still: '' }
        ]
      };
    });
    const watchedButton = page.getByTitle('İzlendi olarak işaretle').first();
    await watchedButton.waitFor({ state: 'visible' });
    await watchedButton.click();
    await page.waitForFunction(() => {
      const all = JSON.parse(localStorage.getItem('cine_episode_tracking_v1') || '{}');
      return (all['pro_1:archive-6']?.watched?.['1'] || []).includes(1);
    });
    await page.getByRole('button', { name: /Sonraki bölüm/ }).click();
    await page.waitForFunction(() => window.Alpine.$data(document.documentElement).selectedEpisode === 2);
    const resumedEpisode = await page.evaluate(() => {
      const app = window.Alpine.$data(document.documentElement);
      app.continueLastWatchedEpisode();
      return app.selectedEpisode;
    });
    assert.equal(resumedEpisode, 1, 'Son izlenen bölüm bilgisi geri yüklenemedi');
    await page.locator('header select').selectOption('pro_2');
    const isolated = await page.evaluate(() => window.Alpine.$data(document.documentElement).isEpisodeWatched(1, 1));
    assert.equal(isolated, false, 'Çocuk Profili Ana Profil bölüm takibini devraldı');
    await page.evaluate(() => {
      const app = window.Alpine.$data(document.documentElement);
      app.saveMovieProgress('archive-6', { time: 75, duration: 2400, savedAt: Date.now() });
    });
    const progress = await page.evaluate(() => window.Alpine.$data(document.documentElement).getMovieProgress('archive-6'));
    assert.equal(progress.time, 75, 'Profil bazlı oynatma ilerlemesi geri okunamadı');
    await page.locator('header select').selectOption('pro_1');
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
    console.log('HTTP RESOURCE ERRORS:', JSON.stringify(failedResources.slice(0, 20)));
  });

  console.log(JSON.stringify({ baseURL: BASE_URL, results }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
