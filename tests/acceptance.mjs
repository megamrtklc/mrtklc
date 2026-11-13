// Re-run after mobile layout stability update (Nov 11, 2026).
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'https://megamrtklc.github.io/mrtklc/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
await page.addInitScript(() => {
  window.__desktopLayoutShifts = [];
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__desktopLayoutShifts.push({
          value: entry.value,
          startTime: Math.round(entry.startTime),
          sources: (entry.sources || []).slice(0, 8).map(source => ({
            node: source.node?.tagName || null,
            id: source.node?.id || null,
            className: typeof source.node?.className === 'string' ? source.node.className.slice(0, 180) : '',
            previousRect: source.previousRect || null,
            currentRect: source.currentRect || null
          }))
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
});
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
  try {
    await page.waitForFunction(() => {
      if (!window.Alpine || typeof window.Alpine.$data !== 'function') return false;
      const app = window.Alpine.$data(document.documentElement);
      return app && Array.isArray(app.catalog) && app.catalog.length >= 130;
    }, { timeout: 60000 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      alpineLoaded: !!window.Alpine,
      alpineVersion: window.Alpine?.version || null,
      rootDataAttribute: document.documentElement.getAttribute('x-data'),
      appFunctionType: typeof window.ultimateProApp,
      scripts: [...document.scripts].map((script, index) => ({
        index, src: script.src || null, type: script.type || 'classic',
        length: script.textContent.length, preview: script.textContent.slice(0, 90)
      })),
      resourceFailures: performance.getEntriesByType('resource').filter(entry => entry.responseStatus >= 400).map(entry => entry.name)
    }));
    console.error('APP INITIALIZATION DIAGNOSTIC:', JSON.stringify(diagnostic));
    console.error('PAGE ERRORS:', JSON.stringify(failures));
    throw error;
  }

  await page.waitForTimeout(8500);
  const desktopDiagnostics = await page.evaluate(() => ({
    shifts: window.__desktopLayoutShifts || [],
    hero: (() => {
      const section = document.querySelector('#desktopEditorialHero');
      const copy = section?.querySelector('.editorial-copy-enter');
      return {
        section: section?.getBoundingClientRect().toJSON() || null,
        copy: copy?.getBoundingClientRect().toJSON() || null,
        title: section?.querySelector('h1')?.textContent || '',
        description: section?.querySelector('p')?.textContent || '',
        activeSlide: window.Alpine?.$data(document.documentElement)?.currentSlideIndex ?? null,
        thumbContainer: section?.querySelector('#heroThumbContainer')?.getBoundingClientRect().toJSON() || null
      };
    })(),
    catalog: (() => {
      const app = window.Alpine?.$data(document.documentElement);
      const section = document.querySelector('#home-catalog-section');
      return {
        exists: !!section,
        display: section ? getComputedStyle(section).display : null,
        visibilitySetting: app?.homepageConfig?.layout?.visibility?.catalog ?? null,
        visibleByMethod: app?.isHomepageSectionVisible?.('catalog') ?? null,
        rect: section?.getBoundingClientRect().toJSON() || null,
        parent: section?.parentElement?.id || section?.parentElement?.tagName || null,
        homeChildren: [...(document.querySelector('#home-page')?.children || [])].map(node => ({
          tag: node.tagName, id: node.id, section: node.dataset.homeSection || null
        }))
      };
    })()
  }));
  console.log('DESKTOP LAYOUT SHIFT DIAGNOSTIC:', JSON.stringify(desktopDiagnostics));
  const desktopCls = desktopDiagnostics.shifts.reduce((total, entry) => total + entry.value, 0);
  assert.ok(desktopCls < 0.05, 'Masaüstü CLS hedefi aşıldı: ' + desktopCls.toFixed(3));

  await check('Ana sayfa rafları ekrana yaklaşınca yükleniyor', async () => {
    await page.locator('#home-catalog-section').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.Alpine.$data(document.documentElement).homeSectionReady?.catalog === true, { timeout: 10000 });
    await page.evaluate(() => window.scrollTo(0, 0));
  });
  adaletId = await page.evaluate(() => window.Alpine.$data(document.documentElement).catalog.find(item => item.title === 'Adalet 2')?.id);
  assert.ok(adaletId, 'Adalet 2 katalogda bulunamadı');

  await check('Ana sayfa açılıyor ve katalog yükleniyor', async () => {
    assert.match(await page.title(), /CineVerse/i);
    assert.ok(await page.getByText('Tüm Yapımlar & Trendler', { exact: true }).count());
    const count = await page.evaluate(() => window.Alpine.$data(document.documentElement).catalog.length);
    assert.equal(count, 140);
    const lcpEntries = await page.evaluate(() => new Promise(resolve => {
      let settled = false;
      const finish = value => { if (settled) return; settled = true; observer.disconnect(); resolve(value); };
      const observer = new PerformanceObserver(list => finish(list.getEntries().map(entry => {
        const element = entry.element;
        return {
          startTime: Math.round(entry.startTime),
          size: entry.size,
          tag: element?.tagName || null,
          id: element?.id || null,
          className: typeof element?.className === 'string' ? element.className.slice(0, 180) : '',
          src: element?.currentSrc || element?.src || '',
          text: element?.textContent?.trim().slice(0, 100) || ''
        };
      })));
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      setTimeout(() => finish([]), 1200);
    }));
    console.log('BROWSER LCP ELEMENTS:', JSON.stringify(lcpEntries));
    const compiledStyleCheck = await page.evaluate(() => ({
      localStylesheet: [...document.styleSheets].some(sheet => sheet.href && sheet.href.endsWith('/tailwind.css')),
      gridDisplay: getComputedStyle(document.querySelector('.grid')).display,
      heroThumbDisplay: getComputedStyle(document.querySelector('#heroThumbContainer')).display,
      cdnRuntimeScripts: document.querySelectorAll('script[src*="cdn.tailwindcss.com"]').length
    }));
    assert.ok(
      compiledStyleCheck.localStylesheet &&
      compiledStyleCheck.gridDisplay === 'grid' &&
      compiledStyleCheck.heroThumbDisplay === 'flex' &&
      compiledStyleCheck.cdnRuntimeScripts === 0,
      'Derlenmiş Tailwind CSS doğru yüklenmedi: ' + JSON.stringify(compiledStyleCheck)
    );
    await page.waitForFunction(() => {
      const desktopHero = [...document.querySelectorAll('section img')]
        .find(image => image.closest('section')?.classList.contains('md:block') &&
          image.getClientRects().length > 0);
      return desktopHero && desktopHero.complete && desktopHero.naturalWidth > 0;
    }, { timeout: 20000 });
    const heroImageOk = await page.evaluate(() => {
      const image = [...document.querySelectorAll('section img')]
        .find(candidate => candidate.closest('section')?.classList.contains('md:block') &&
          candidate.getClientRects().length > 0);
      return !!image && image.naturalWidth > 0 && image.dataset.perdeFallbackApplied !== 'true';
    });
    assert.ok(heroImageOk, 'Masaüstü hero görseli yüklenemedi');
    const preloadChecks = await page.evaluate(() => ({
      catalog: !!document.querySelector('link[rel="preload"][as="fetch"][href="./filmvediziler.json"]'),
      alpine: [...document.querySelectorAll('link[rel="preload"][as="script"]')].some(link => link.href.includes('alpinejs')),
      hero: !!document.querySelector('link[rel="preload"][as="image"]')
    }));
    assert.ok(preloadChecks.catalog && preloadChecks.alpine && preloadChecks.hero, 'Kritik kaynak ön yüklemeleri eksik');
    await page.waitForFunction(() => {
      const links = [...document.querySelectorAll('link[rel="stylesheet"]')];
      const iconCss = links.some(link => link.href.includes('font-awesome') && (link.media === 'all' || link.media === ''));
      const fontCss = links.some(link => link.href.includes('fonts.googleapis.com') && (link.media === 'all' || link.media === ''));
      return iconCss && fontCss;
    }, { timeout: 15000 });
    const heroThumbnailCount = await page.locator('#heroThumbContainer img').count();
    const configuredDesktopThumbCount = await page.evaluate(async () => {
      const response = await fetch('./filmvediziler.json');
      const data = await response.json();
      const configured = Number(data.homepageConfig?.settings?.desktopCount);
      return Number.isFinite(configured) && configured > 0 ? configured : 10;
    });
    assert.equal(
      heroThumbnailCount,
      configuredDesktopThumbCount,
      'Masaüstü hero küçük görsel sayısı yönetim panelindeki mevcut ayarla eşleşmeli'
    );
    const responsiveSources = await page.locator('img[srcset], picture source[srcset]').evaluateAll(images => images.map(image => image.getAttribute('srcset') || '').filter(Boolean));
    console.log('RESPONSIVE IMAGE SOURCES:', JSON.stringify(responsiveSources.slice(0, 8)));
    assert.ok(responsiveSources.some(source => source.includes('w185')) && responsiveSources.some(source => source.includes('w780')), 'TMDB afiş veya hero görsellerinde duyarlı kaynaklar bulunamadı');
  });

  await check('Mobil ve masaüstü için ayrı manşetler doğru gösteriliyor', async () => {
    const mobilePage = await browser.newPage({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
    await mobilePage.addInitScript(() => {
      window.__layoutShiftEntries = [];
      window.__lcpEntries = [];
      window.__longTasks = [];
      try {
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) window.__layoutShiftEntries.push({
              value: entry.value, startTime: Math.round(entry.startTime),
              sources: (entry.sources || []).slice(0, 5).map(source => ({
                node: source.node?.tagName || null, id: source.node?.id || null,
                className: typeof source.node?.className === 'string' ? source.node.className.slice(0, 140) : '',
                previousRect: source.previousRect || null, currentRect: source.currentRect || null
              }))
            });
          }
        }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) window.__lcpEntries.push({
            startTime: Math.round(entry.startTime),
            renderTime: Math.round(entry.renderTime || 0),
            loadTime: Math.round(entry.loadTime || 0),
            size: entry.size,
            tag: entry.element?.tagName || null, id: entry.element?.id || null,
            className: typeof entry.element?.className === 'string' ? entry.element.className.slice(0, 160) : '',
            src: entry.element?.currentSrc || entry.element?.src || '',
            text: entry.element?.textContent?.trim().slice(0, 80) || '',
            selector: entry.element ? [entry.element.tagName.toLowerCase(), entry.element.id ? '#' + entry.element.id : '', typeof entry.element.className === 'string' ? '.' + entry.element.className.trim().split(/\\s+/).slice(0, 3).join('.') : ''].join('') : ''
          });
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) window.__longTasks.push({
            startTime: Math.round(entry.startTime), duration: Math.round(entry.duration)
          });
        }).observe({ type: 'longtask', buffered: true });
      } catch {}
    });
    try {
      // Match Lighthouse mobile emulation (412x823, DPR 1.75, touch) plus 4x CPU slowdown and 1.6 Mbps / 150 ms network.
      // This is diagnostic only; it does not change production application behavior.
      const mobileCdp = await mobilePage.context().newCDPSession(mobilePage);
      await mobileCdp.send('Network.enable');
      await mobileCdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: 1.6 * 1024 * 1024 / 8,
        uploadThroughput: 750 * 1024 / 8,
        connectionType: 'cellular3g'
      });
      await mobileCdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await mobilePage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await mobilePage.waitForFunction(() => {
        const image = document.querySelector('#mobileHeroBanner img');
        return image && image.complete && image.naturalWidth > 0;
      }, { timeout: 30000 });
      const mobileState = await mobilePage.evaluate(async () => {
        const image = document.querySelector('#mobileHeroBanner img');
        await new Promise(resolve => setTimeout(resolve, 6000));
        const lcp = window.__lcpEntries || [];
        const resources = performance.getEntriesByType('resource')
          .filter(entry => /image\.tmdb\.org|filmvediziler\.json|alpinejs|fonts\.(googleapis|gstatic)|font-awesome/.test(entry.name))
          .map(entry => ({ name: entry.name, start: Math.round(entry.startTime), duration: Math.round(entry.duration), bytes: entry.transferSize || 0, initiator: entry.initiatorType }));
        return {
          mobileVisible: getComputedStyle(document.querySelector('#mobileHeroBanner')).display !== 'none',
          desktopVisible: getComputedStyle(document.querySelector('#desktopEditorialHero')).display !== 'none',
          desktopHeroSource: document.querySelector('#desktopEditorialHero img')?.currentSrc || '',
          source: image.currentSrc || image.src,
          sourceAttribute: image.getAttribute('src') || '',
          imageComplete: image.complete,
          imageNaturalWidth: image.naturalWidth,
          heroArtwork: document.querySelector('#mobileHeroArtwork')?.currentSrc || '',
          activeSlide: window.Alpine?.$data(document.documentElement)?.currentSlideIndex ?? null,
          currentHeroTitle: window.Alpine?.$data(document.documentElement)?.currentHero?.title || '',
          navigationControls: document.querySelectorAll('#mobileHeroBanner button[aria-label*=\"öne çıkan yapım\"]').length,
          lcp,
          layoutShifts: window.__layoutShiftEntries || [],
          longTasks: window.__longTasks || [],
          navigation: (() => {
            const entry = performance.getEntriesByType('navigation')[0];
            return entry ? Object.fromEntries(['startTime','responseStart','domContentLoadedEventEnd','loadEventEnd','domInteractive','duration'].map(key => [key, Math.round(entry[key])])) : null;
          })(),
          appState: (() => {
            const app = window.Alpine?.$data(document.documentElement);
            return {
              alpineReady: !!window.Alpine,
              catalogCount: app?.catalog?.length ?? null,
              catalogLoading: app?.catalogLoading ?? null,
              initialShellPresent: !!document.getElementById('hero-initial-shell'),
              homeSections: app?.homeSectionReady || null,
              heroTitle: document.querySelector('#mobileHeroBanner')?.innerText?.trim().slice(0, 100) || ''
            };
          })(),
          resources
        };
      });
      console.log('MOBILE HERO PERFORMANCE:', JSON.stringify(mobileState));
      assert.ok(mobileState.mobileVisible, 'Mobil manşet telefonda görünmüyor');
      assert.ok(!mobileState.desktopVisible, 'Masaüstü manşeti telefonda görünmemeli');
      assert.ok(!mobileState.desktopHeroSource || !mobileState.desktopHeroSource.startsWith('https://image.tmdb.org/'), 'Mobil ekranda gizli masaüstü manşet görseli indirilmemeli');
      assert.match(mobileState.source, /\/w(342|500|780)\//);
      assert.ok(mobileState.navigationControls >= 2, 'Mobil manşet gezinme kontrolleri yüklenmedi');
    } finally {
      await mobilePage.close();
    }
    const desktopState = await page.evaluate(() => ({
      mobileVisible: getComputedStyle(document.querySelector('#mobileHeroBanner')).display !== 'none',
      desktopVisible: getComputedStyle(document.querySelector('#desktopEditorialHero')).display !== 'none',
    }));
    assert.ok(!desktopState.mobileVisible, 'Mobil manşet masaüstünde görünmemeli');
    assert.ok(desktopState.desktopVisible, 'Mevcut masaüstü manşeti görünmüyor');
  });

  await check('Akıllı öneriler aktif profil geçmişini kullanıyor ve önerileri çeşitlendiriyor', async () => {
    const result = await page.evaluate(() => {
      const app = window.Alpine.$data(document.documentElement);
      const original = {
        progress: localStorage.getItem('perde_profile_player_progress_v1'),
        episodes: localStorage.getItem('cine_episode_tracking_v1'),
        watchlists: localStorage.getItem('cine_profile_watchlists'),
        activeProfile: localStorage.getItem('cine_active_profile')
      };
      const movie = app.catalog.find(item => item.type === 'movie');
      const series = app.catalog.find(item => item.type === 'tv' && String(item.id) !== String(movie?.id));
      const saved = app.catalog.find(item => item.id !== movie?.id && item.id !== series?.id);
      localStorage.setItem('perde_profile_player_progress_v1', JSON.stringify({
        pro_1: { [movie.id]: { time: 1200, duration: 1800, savedAt: Date.now() } }
      }));
      localStorage.setItem('cine_episode_tracking_v1', JSON.stringify({
        ['pro_1:' + series.id]: { watched: { '1': [1, 2] }, last: { season: 1, episode: 2, updatedAt: Date.now() } }
      }));
      localStorage.setItem('cine_profile_watchlists', JSON.stringify({
        pro_1: [{ id: saved.id, title: saved.title }]
      }));
      const recommendations = app.personalizedRecommendations;
      const profileOne = {
        ids: recommendations.map(item => String(item.id)),
        reasons: recommendations.map(item => item.recommendationReason),
        movieId: String(movie.id),
        seriesId: String(series.id),
        savedId: String(saved.id)
      };
      app.switchProfile('pro_2');
      const profileTwoRecommendations = app.personalizedRecommendations;
      const profileTwoIds = profileTwoRecommendations.map(item => String(item.id));
      const profileTwoReasons = profileTwoRecommendations.map(item => item.recommendationReason);
      app.switchProfile('pro_1');
      for (const [key, value] of Object.entries({
        perde_profile_player_progress_v1: original.progress,
        cine_episode_tracking_v1: original.episodes,
        cine_profile_watchlists: original.watchlists,
        cine_active_profile: original.activeProfile
      })) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
      return { profileOne, profileTwoIds, profileTwoReasons };
    });
    const ids = result.profileOne.ids;
    assert.ok(ids.length > 0 && ids.length <= 15, 'Öneri sayısı 1–15 aralığında olmalı');
    assert.equal(new Set(ids).size, ids.length, 'Önerilerde yinelenen yapımlar var');
    assert.ok(!ids.includes(result.profileOne.movieId), 'İzleme ilerlemesi olan film önerilmemeli');
    assert.ok(!ids.includes(result.profileOne.seriesId), 'Bölüm takibi olan dizi önerilmemeli');
    assert.ok(!ids.includes(result.profileOne.savedId), 'İzleme listesindeki yapım tekrar önerilmemeli');
    assert.ok(result.profileOne.reasons.every(Boolean), 'Her önerinin kişisel gerekçesi olmalı');
    if (ids.length === 15) {
      const types = await page.evaluate(ids => {
        const catalog = window.Alpine.$data(document.documentElement).catalog;
        return ids.map(id => catalog.find(item => String(item.id) === id)?.type);
      }, ids);
      const movieCount = types.filter(type => type === 'movie').length;
      const seriesCount = types.filter(type => type === 'tv').length;
      assert.ok(movieCount <= 10 && seriesCount <= 5, '15 öneride film/dizi dengesi 10/5 hedefini aşmamalı');
    }
    assert.ok(result.profileTwoIds.length > 0, 'İkinci profil için öneriler üretilmeli');
    assert.ok(result.profileTwoReasons.every(reason => reason === 'Arşivden yüksek puanlı'), 'İlk profilin izleme geçmişi ikinci profilin önerilerini etkilememeli');
  });

  await check('Öneri geri bildirimi profile özel kaydediliyor ve benzer yapımları aşağı sıralıyor', async () => {
    const result = await page.evaluate(() => {
      const app = window.Alpine.$data(document.documentElement);
      const key = 'cine_recommendation_feedback_v1';
      const original = localStorage.getItem(key);
      const originalProfile = app.currentProfileId;
      try {
        app.switchProfile('pro_1');
        localStorage.removeItem(key);
        const first = app.personalizedRecommendations;
        const target = first[0];
        if (!target) throw new Error('Geri bildirim testi için öneri bulunamadı');
        app.dismissRecommendation(target);
        const saved = JSON.parse(localStorage.getItem(key) || '{}');
        const after = app.personalizedRecommendations;
        app.switchProfile('pro_2');
        const secondProfileFeedback = app.recommendationFeedback;
        return {
          targetId: String(target.id),
          savedForProfileOne: (saved.pro_1 || []).includes(String(target.id)),
          removedFromRecommendations: !after.some(item => String(item.id) === String(target.id)),
          profileTwoUnaffected: secondProfileFeedback.length === 0
        };
      } finally {
        if (original === null) localStorage.removeItem(key);
        else localStorage.setItem(key, original);
        app.switchProfile(originalProfile);
      }
    });
    assert.ok(result.savedForProfileOne, 'Geri bildirim aktif profile kaydedilmedi');
    assert.ok(result.removedFromRecommendations, 'İlgimi çekmedi denilen yapım önerilerde kaldı');
    assert.ok(result.profileTwoUnaffected, 'Geri bildirim diğer profile sızdı');
  });

  await check('Dizi önerileri doğru etiketleniyor ve dar ekran kart ölçüsü uygulanıyor', async () => {
    await page.waitForFunction(() => {
      const card = document.querySelector('#home-personalized-rail [data-recommendation-type="tv"]');
      return !!card && !!card.querySelector('.min-w-0 > p:first-child')?.textContent.trim();
    }, { timeout: 10000 });
    const badge = await page.evaluate(() => {
      const card = document.querySelector('#home-personalized-rail [data-recommendation-type="tv"]');
      return {
        type: card?.getAttribute('data-recommendation-type') || '',
        label: card?.querySelector('.min-w-0 > p:first-child')?.textContent.trim() || ''
      };
    });
    console.log('TV RECOMMENDATION BADGE:', JSON.stringify(badge));
    assert.equal(badge.type, 'tv', 'Test kartı dizi türünde olmalı');
    assert.equal(badge.label, 'DİZİ ÖNERİSİ', 'Dizi önerisi yanlış etiketlenmiş');
    await page.setViewportSize({ width: 360, height: 800 });
    await page.waitForFunction(() => window.innerWidth === 360);
    await page.waitForFunction(() => {
      const card = document.querySelector('#home-personalized-rail .home-personalized-alternative');
      return !!card && card.getBoundingClientRect().width > 0 && card.getBoundingClientRect().width <= 260;
    }, { timeout: 5000 });
    const railCardWidth = await page.locator('#home-personalized-rail .home-personalized-alternative').first().evaluate(card => card.getBoundingClientRect().width);
    assert.ok(railCardWidth > 0 && railCardWidth <= 260, 'Dar ekranda öneri kartı güvenli genişlikte olmalı');
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  await check('Mobil menü açılıyor ve sayfa geçişi yapıyor', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Menüyü aç veya kapat' }).click();
    const mobileMenu = page.locator('header div[x-show="mobileMenuOpen"]');
    await mobileMenu.waitFor({ state: 'visible' });
    await mobileMenu.getByRole('link', { name: 'Keşfet', exact: true }).click();
    await page.waitForFunction(() => window.location.hash === '#/explore');
    assert.ok(await page.getByText('Keşfet & Arşiv Kataloğu', { exact: true }).isVisible());
  });

  await check('Mobil, tablet ve masaüstünde yatay taşma kontrolü', async () => {
    for (const viewport of [
      { width: 320, height: 800 },   // küçük telefon
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 412, height: 823 },
      { width: 430, height: 932 },
      { width: 480, height: 900 },   // büyük telefon / dar tablet
      { width: 540, height: 960 },
      { width: 600, height: 960 },
      { width: 768, height: 1024 },  // tablet dikey
      { width: 820, height: 1180 },
      { width: 900, height: 1100 },
      { width: 1024, height: 768 },  // tablet yatay
      { width: 1024, height: 900 },
      { width: 1180, height: 820 },
      { width: 1280, height: 900 },
      { width: 1366, height: 900 },
      { width: 1440, height: 1000 },
      { width: 1600, height: 900 },
      { width: 1920, height: 1080 }  // TV / geniş ekran
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

  await check('TV geniş ekranında masaüstü menüsü ve klavye gezinmesi çalışıyor', async () => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForFunction(() => window.innerWidth === 1920);
    const desktopNav = page.locator('header > div nav').first();
    await desktopNav.waitFor({ state: 'visible' });
    assert.ok(await desktopNav.getByRole('link', { name: 'Ana Sayfa', exact: true }).isVisible(),
      'TV geniş ekranında masaüstü navigasyonu görünür değil');
    assert.ok(await desktopNav.getByRole('link', { name: 'Keşfet', exact: true }).isVisible(),
      'TV geniş ekranında Keşfet bağlantısı görünür değil');
    assert.equal(await page.getByRole('button', { name: 'Menüyü aç veya kapat' }).isVisible(), false,
      'TV geniş ekranında mobil menü düğmesi görünmemeli');
    await desktopNav.getByRole('link', { name: 'Keşfet', exact: true }).press('Enter');
    await page.waitForFunction(() => window.location.hash === '#/explore');
    assert.ok(await page.getByText('Keşfet & Arşiv Kataloğu', { exact: true }).isVisible(),
      'TV klavyesiyle Keşfet sayfasına geçiş yapılamadı');
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  await check('Mobil ve tablette yatay kart şeritleri kaydırılabiliyor', async () => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#home-personalized-rail', { timeout: 15000 });
    for (const viewport of [{ width: 360, height: 800 }, { width: 768, height: 1024 }]) {
      await page.setViewportSize(viewport);
      await page.locator('#home-catalog-section').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => {
        const personalized = document.querySelector('#home-personalized-rail');
        const catalog = document.querySelector('#home-catalog-rail');
        return personalized?.children.length > 1 && catalog?.children.length > 1;
      }, null, { timeout: 10000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      for (const selector of ['#home-personalized-rail', '#home-catalog-rail']) {
        const state = await page.locator(selector).evaluate(element => {
          const maxScroll = element.scrollWidth - element.clientWidth;
          const overflowX = getComputedStyle(element).overflowX;
          const originalScrollBehavior = element.style.scrollBehavior;
          element.style.scrollBehavior = 'auto';
          element.scrollLeft = 0;
          const start = element.scrollLeft;
          element.scrollLeft = Math.min(220, Math.max(0, maxScroll));
          const end = element.scrollLeft;
          element.style.scrollBehavior = originalScrollBehavior;
          return {
            maxScroll,
            start,
            end,
            overflowX,
            cardCount: element.children.length
          };
        });
        assert.ok(state.cardCount > 0, `${selector} kart içermiyor`);
        assert.ok(state.overflowX === 'auto' || state.overflowX === 'scroll', `${selector} yatay kaydırmaya açık değil`);
        assert.ok(state.maxScroll > 0 && state.end > state.start, `${viewport.width}px ekranda ${selector} kaydırılamıyor`);
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
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
    const episodeSource = await page.evaluate(() => {
      const app = window.Alpine.$data(document.documentElement);
      const video = document.getElementById('customVideoPlayer');
      video.pause = () => {};
      video.load = () => {};
      video.play = () => Promise.resolve();
      app.selectedItem.episodeWatchUrls = {
        '1:1': 'https://media.example.test/lost-s01e01.mp4',
        '1:2': 'https://media.example.test/lost-s01e02.mp4'
      };
      app.selectEpisode(2);
      const selectedUrl = app.getPlaybackUrl();
      const videoUrl = video.src;
      const progressKey = app.getPlaybackProgressKey();
      app.selectedItem.watchUrl = 'https://media.example.test/lost-fallback.mp4';
      app.selectedEpisode = 3;
      const fallbackUrl = app.getPlaybackUrl();
      app.selectedEpisode = 1;
      return { selectedUrl, videoUrl, progressKey, fallbackUrl };
    });
    assert.equal(episodeSource.selectedUrl, 'https://media.example.test/lost-s01e02.mp4',
      'Seçilen bölümün kendi video bağlantısı çözülmedi');
    assert.equal(episodeSource.videoUrl, episodeSource.selectedUrl,
      'Bölüm seçildiğinde oynatıcı kaynağı güncellenmedi');
    assert.equal(episodeSource.progressKey, 'archive-6:s1e2',
      'Bölüm bazlı izleme ilerlemesi anahtarı doğru oluşturulmadı');
    assert.equal(episodeSource.fallbackUrl, 'https://media.example.test/lost-fallback.mp4',
      'Bölüm bağlantısı olmayan eski diziler genel oynatma bağlantısına geri dönemedi');
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
    const episodeNavigation = await page.evaluate(() => {
      const app = window.Alpine.$data(document.documentElement);
      app.selectedItem.tmdbEpisodesBySeason = {
        1: Array.from({ length: 9 }, (_, index) => ({
          number: index + 1, title: `Birinci Sezon ${index + 1}`, duration: '42 dk', still: ''
        })),
        2: [{ number: 1, title: 'İkinci Sezon Açılışı', duration: '44 dk', still: '' }]
      };
      app.selectedSeason = 1;
      app.selectedEpisode = 9;
      app.currentEpisodePage = 2;
      app.goToNextEpisode();
      const boundary = {
        season: app.selectedSeason,
        episode: app.selectedEpisode,
        page: app.currentEpisodePage
      };
      app.selectedSeason = 1;
      app.currentEpisodePage = 1;
      const firstPageCount = app.paginatedEpisodes.length;
      app.currentEpisodePage = 2;
      return {
        boundary,
        totalPages: app.totalEpisodePages,
        firstPageCount,
        secondPageEpisodes: app.paginatedEpisodes.map(ep => ep.number)
      };
    });
    assert.deepEqual(episodeNavigation.boundary, { season: 2, episode: 1, page: 1 },
      'Son bölümden sonraki sezona geçiş başarısız');
    assert.equal(episodeNavigation.totalPages, 2, 'Bölüm sayfalaması toplam sayfa sayısını yanlış hesapladı');
    assert.equal(episodeNavigation.firstPageCount, 8, 'İlk bölüm sayfasında 8 bölüm gösterilmiyor');
    assert.deepEqual(episodeNavigation.secondPageEpisodes, [9], 'İkinci bölüm sayfası doğru bölümü göstermiyor');
    await page.locator('header select').selectOption('pro_2');
    const isolated = await page.evaluate(() => window.Alpine.$data(document.documentElement).isEpisodeWatched(1, 1));
    assert.equal(isolated, false, 'Çocuk Profili Ana Profil bölüm takibini devraldı');
    await page.evaluate(() => {
      const app = window.Alpine.$data(document.documentElement);
      app.saveMovieProgress('archive-6', { time: 75, duration: 2400, savedAt: Date.now() });
    });
    const progress = await page.evaluate(() => window.Alpine.$data(document.documentElement).getMovieProgress('archive-6'));
    assert.equal(progress.time, 75, 'Profil bazlı oynatma ilerlemesi geri okunamadı');
    const progressIsolation = await page.evaluate(() => {
      const app = window.Alpine.$data(document.documentElement);
      const stored = JSON.parse(localStorage.getItem('perde_profile_player_progress_v1') || '{}');
      const savedForChild = stored.pro_2?.['archive-6']?.time;
      app.switchProfile('pro_1');
      const mainProfileTime = app.getMovieProgress('archive-6')?.time ?? null;
      app.switchProfile('pro_2');
      const restoredChildTime = app.getMovieProgress('archive-6')?.time ?? null;
      return { savedForChild, mainProfileTime, restoredChildTime };
    });
    assert.equal(progressIsolation.savedForChild, 75, 'Oynatma ilerlemesi aktif profil anahtarına kaydedilmedi');
    assert.notEqual(progressIsolation.mainProfileTime, 75, 'Çocuk profilinin oynatma ilerlemesi Ana Profile sızdı');
    assert.equal(progressIsolation.restoredChildTime, 75, 'Profil değiştirince önceki oynatma ilerlemesi geri yüklenmedi');
    const timeupdateProgress = await page.evaluate(() => {
      const app = window.Alpine.$data(document.documentElement);
      const video = document.getElementById('customVideoPlayer');
      if (!video) throw new Error('İzleme sayfasında video elementi bulunamadı');
      const originalDuration = Object.getOwnPropertyDescriptor(video, 'duration');
      const originalCurrentTime = Object.getOwnPropertyDescriptor(video, 'currentTime');
      try {
        Object.defineProperty(video, 'duration', { configurable: true, value: 2400 });
        Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: 125 });
        app.selectedSeason = 1;
        app.selectedEpisode = 2;
        app.updateVideoProgress();
        const childStored = JSON.parse(localStorage.getItem('perde_profile_player_progress_v1') || '{}').pro_2?.['archive-6:s1e2'];
        app.switchProfile('pro_1');
        const mainProfileTime = app.getMovieProgress('archive-6:s1e2')?.time ?? null;
        app.switchProfile('pro_2');
        return {
          childTime: childStored?.time ?? null,
          childDuration: childStored?.duration ?? null,
          childSavedAt: childStored?.savedAt ?? 0,
          mainProfileTime,
          percentage: app.videoProgress,
          currentTimeFormatted: app.currentTimeFormatted,
          durationFormatted: app.durationFormatted
        };
      } finally {
        if (originalDuration) Object.defineProperty(video, 'duration', originalDuration);
        else delete video.duration;
        if (originalCurrentTime) Object.defineProperty(video, 'currentTime', originalCurrentTime);
        else delete video.currentTime;
      }
    });
    assert.equal(timeupdateProgress.childTime, 125, 'timeupdate ilerlemesi aktif profile kaydedilmedi');
    assert.equal(timeupdateProgress.childDuration, 2400, 'Video süresi ilerleme kaydına yazılmadı');
    assert.ok(timeupdateProgress.childSavedAt > 0, 'İlerleme kaydına zaman damgası eklenmedi');
    assert.notEqual(timeupdateProgress.mainProfileTime, 125, 'timeupdate ilerlemesi başka profile sızdı');
    assert.ok(Math.abs(timeupdateProgress.percentage - (125 / 2400 * 100)) < 0.001, 'Oynatma yüzdesi doğru hesaplanmadı');
    assert.equal(timeupdateProgress.currentTimeFormatted, '02:05', 'Geçerli oynatma zamanı doğru biçimlendirilmedi');
    assert.equal(timeupdateProgress.durationFormatted, '40:00', 'Video süresi doğru biçimlendirilmedi');
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
    const restoredTime = await page.evaluate(async () => {
      const app = window.Alpine.$data(document.documentElement);
      const item = app.selectedItem;
      const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
      const assignedTimes = [];
      Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
        configurable: true,
        get() { return descriptor.get.call(this); },
        set(value) {
          assignedTimes.push(Number(value));
          try { descriptor.set.call(this, value); } catch (_) {}
        }
      });
      const waitForRestore = async profileId => {
        app.switchProfile(profileId);
        assignedTimes.length = 0;
        app.openWatchPage(item, false);
        await new Promise(resolve => setTimeout(resolve, 300));
        return {
          assignedTime: assignedTimes.length ? assignedTimes[assignedTimes.length - 1] : null,
          playerPresent: !!document.getElementById('customVideoPlayer')
        };
      };
      try {
        app.switchProfile('pro_2');
        app.saveMovieProgress(item.id, { time: 75, duration: 2400, savedAt: Date.now() });
        app.switchProfile('pro_1');
        const mainProgress = JSON.parse(localStorage.getItem('perde_profile_player_progress_v1') || '{}');
        delete mainProgress.pro_1?.[item.id];
        localStorage.setItem('perde_profile_player_progress_v1', JSON.stringify(mainProgress));
        localStorage.removeItem('perde_player_progress_v3');
        const mainProfile = await waitForRestore('pro_1');
        const childProfile = await waitForRestore('pro_2');
        return { mainProfile, childProfile };
      } finally {
        Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', descriptor);
        app.switchProfile('pro_1');
      }
    });
    assert.ok(restoredTime.mainProfile.playerPresent, 'Ana Profilde video oynatıcı bulunamadı');
    assert.notEqual(restoredTime.mainProfile.assignedTime, 75,
      'Çocuk profilinin kayıtlı saniyesi Ana Profil oynatıcısına sızdı');
    assert.ok(restoredTime.childProfile.playerPresent, 'Çocuk Profilde video oynatıcı bulunamadı');
    assert.equal(restoredTime.childProfile.assignedTime, 75,
      'Çocuk profile dönüldüğünde oynatıcı kayıtlı saniyeye dönmedi');
  });

  await check('Detay sayfası mobil, tablet ve masaüstünde taşma yapmıyor', async () => {
    const originalViewport = page.viewportSize();
    for (const width of [360, 390, 412, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(80);
      const layout = await page.evaluate(() => {
        const root = document.documentElement;
        const main = document.querySelector('main');
        const left = document.querySelector('#watch-left-column');
        const right = document.querySelector('#watch-right-column');
        return {
          viewport: root.clientWidth,
          document: root.scrollWidth,
          main: main?.scrollWidth || 0,
          left: !!left && left.getBoundingClientRect().width > 0,
          right: !!right && right.getBoundingClientRect().width > 0,
          player: !!document.querySelector('#customVideoPlayer')
        };
      });
      assert.ok(layout.document <= layout.viewport + 1,
        'Detay sayfasında yatay taşma var (' + width + 'px): ' + JSON.stringify(layout));
      assert.ok(layout.left && layout.right && layout.player,
        'Detay sayfası bölümleri görünmüyor (' + width + 'px): ' + JSON.stringify(layout));
    }
    if (originalViewport) await page.setViewportSize(originalViewport);
  });

  await check('Oyuncu ve benzer yapımlar şeritleri kaydırılabiliyor', async () => {
    const castCard = page.locator('[data-watch-card="cast"]');
    await castCard.waitFor({ state: 'visible' });
    const cast = castCard.locator('#castContainer');
    const castMetrics = await cast.evaluate(el => ({
      count: el.children.length,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth
    }));
    assert.ok(castMetrics.count >= 2, 'Oyuncu kadrosu kartları yüklenmedi: ' + JSON.stringify(castMetrics));
    assert.ok(castMetrics.scrollWidth > castMetrics.clientWidth,
      'Oyuncu kadrosu şeridi yatay kaydırmaya uygun değil: ' + JSON.stringify(castMetrics));
    const castButtons = castCard.getByRole('button');
    let castMoved = false;
    for (const index of [0, 1]) {
      await cast.evaluate(el => { el.scrollLeft = 0; });
      const start = await cast.evaluate(el => el.scrollLeft);
      await castButtons.nth(index).click();
      await page.waitForTimeout(450);
      if (await cast.evaluate((el, initial) => Math.abs(el.scrollLeft - initial) > 1, start)) {
        castMoved = true;
        break;
      }
    }
    assert.ok(castMoved, 'Oyuncu kadrosu ok kontrolleri şeridi kaydırmadı');


    const similarCard = page.locator('[data-watch-card="similar"]');
    await similarCard.waitFor({ state: 'visible' });
    const similar = similarCard.locator('#similarContainer');
    const similarMetrics = await similar.evaluate(el => ({
      count: el.children.length,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth
    }));
    assert.ok(similarMetrics.count > 0, 'Benzer yapımlar listesi boş: ' + JSON.stringify(similarMetrics));
    assert.ok(similarMetrics.scrollWidth > similarMetrics.clientWidth,
      'Benzer yapımlar şeridi yatay kaydırmaya uygun değil: ' + JSON.stringify(similarMetrics));
    const similarButtons = similarCard.getByRole('button');
    let similarMoved = false;
    for (const index of [0, 1]) {
      await similar.evaluate(el => { el.scrollLeft = 0; });
      const start = await similar.evaluate(el => el.scrollLeft);
      await similarButtons.nth(index).click();
      await page.waitForTimeout(450);
      if (await similar.evaluate((el, initial) => Math.abs(el.scrollLeft - initial) > 1, start)) {
        similarMoved = true;
        break;
      }
    }
    assert.ok(similarMoved, 'Benzer yapımlar ok kontrolleri şeridi kaydırmadı');

  });

  await check('Detay sayfasında uzun konu özeti açılıp kapatılıyor', async () => {
    await page.evaluate(() => {
      const app = window.Alpine.$data(document.documentElement);
      app.selectedItem.desc = 'Konu özeti erişilebilirlik testi. '.repeat(24);
    });
    const readMore = page.getByRole('button', { name: /Tamamını oku/ });
    await readMore.waitFor({ state: 'visible' });
    await readMore.click();
    const dialog = page.getByRole('dialog', { name: 'Yapım konusu' });
    await dialog.waitFor({ state: 'visible' });
    assert.ok((await dialog.innerText()).includes('Konu özeti erişilebilirlik testi'));
    await dialog.getByRole('button', { name: 'Kapat' }).click();
    await dialog.waitFor({ state: 'hidden' });
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
