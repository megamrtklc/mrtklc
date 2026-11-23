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
  window.__desktopLayoutTimeline = [];
  let lastLayoutSignature = '';
  const rect = element => {
    if (!element) return null;
    const value = element.getBoundingClientRect();
    return { x: Math.round(value.x), y: Math.round(value.y), width: Math.round(value.width), height: Math.round(value.height) };
  };
  const sampleLayout = () => {
    const header = document.querySelector('body > header');
    const hero = document.querySelector('#desktopEditorialHero, #mobileCinematicHero');
    const personalized = document.querySelector('#home-personalized-section');
    const heading = personalized?.querySelector('.home-personalized-heading');
    const showcase = personalized?.querySelector('.home-personalized-showcase');
    const logo = header?.querySelector('a img, a > div');
    const search = header?.querySelector('.cineverse-search-trigger');
    const profile = header?.querySelector('.cineverse-profile-trigger');
    const heroImage = hero?.querySelector('picture img, img');
    const snapshot = {
      time: Math.round(performance.now()),
      fonts: { status: document.fonts?.status || 'unsupported', interReady: !!document.fonts?.check?.('12px Inter') },
      header: { rect: rect(header), logo: rect(logo), search: rect(search), profile: rect(profile), visible: !!header && getComputedStyle(header).visibility !== 'hidden' && getComputedStyle(header).display !== 'none' },
      hero: { rect: rect(hero), image: rect(heroImage), imageLoaded: !!heroImage && heroImage.complete && heroImage.naturalWidth > 0 },
      personalized: { rect: rect(personalized), heading: rect(heading), showcase: rect(showcase), visibility: personalized ? getComputedStyle(personalized).visibility : null, display: personalized ? getComputedStyle(personalized).display : null },
      home: rect(document.querySelector('#home-page')),
      main: rect(document.querySelector('main'))
    };
    const signature = JSON.stringify(snapshot, (key, value) => key === 'time' ? undefined : value);
    if (signature !== lastLayoutSignature && window.__desktopLayoutTimeline.length < 100) {
      lastLayoutSignature = signature;
      window.__desktopLayoutTimeline.push(snapshot);
    }
  };
  const layoutTimer = setInterval(sampleLayout, 40);
  document.addEventListener('DOMContentLoaded', sampleLayout, { once: true });
  document.fonts?.addEventListener?.('loadingdone', sampleLayout);
  window.addEventListener('load', sampleLayout, { once: true });
  setTimeout(() => clearInterval(layoutTimer), 7000);
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

  await check('Global arama canlı katalog sonuçlarını afiş ve bilgilerle gösteriyor', async () => {
    await page.getByRole('button', { name: 'Film ve dizi ara' }).click();
    const dialog = page.getByRole('dialog', { name: 'Film ve dizi ara' });
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('searchbox').fill('Adalet 2');
    await page.waitForFunction(() => document.querySelectorAll('.cineverse-search-result').length > 0, { timeout: 10000 });
    const firstResult = dialog.locator('.cineverse-search-result').first();
    assert.match(await firstResult.innerText(), /Adalet 2/i);
    assert.ok(await firstResult.locator('img').getAttribute('src'), 'Arama sonucu afişi bulunamadı');
    assert.ok(await firstResult.locator('.cineverse-search-result-desc').innerText(), 'Arama sonucu kısa açıklaması bulunamadı');
    await firstResult.click();
    await page.waitForFunction(() => window.Alpine.$data(document.documentElement).currentPage === 'watch', { timeout: 10000 });
    await page.evaluate(() => window.Alpine.$data(document.documentElement).navigateTo('home'));
  });
  const desktopDiagnostics = await page.evaluate(() => ({
    shifts: window.__desktopLayoutShifts || [],
    layoutTimeline: window.__desktopLayoutTimeline || [],
    footer: (() => { const el = document.querySelector("#cineverse-footer"); const app = window.Alpine?.$data(document.documentElement); return { catalogLoading: app?.catalogLoading ?? null, enabled: app?.footerConfig?.enabled ?? null, display: el ? getComputedStyle(el).display : null, visibility: el ? getComputedStyle(el).visibility : null, inlineStyle: el?.getAttribute("style") || null, rect: el?.getBoundingClientRect().toJSON() || null }; })(),
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

  await check('Öneri yükleme arayüzü ve görsel yükleme zemini mevcut', async () => {
    const loadingStatus = page.locator('#home-personalized-section [role="status"]');
    await loadingStatus.waitFor({ state: 'attached' });
    assert.match(await loadingStatus.innerText(), /Öneriler hazırlanıyor/i);
    assert.match(await loadingStatus.innerText(), /Görseller ve öneriler yükleniyor/i);
    const sectionKey = await page.locator('#home-personalized-section').getAttribute('data-home-section');
    assert.equal(sectionKey, 'personalized', 'Kişiselleştirilmiş öneri alanı tanımlı değil');
    const imagePlaceholder = await page.locator('main img').first().evaluate(img => getComputedStyle(img).backgroundImage);
    assert.match(imagePlaceholder, /linear-gradient/i, 'İçerik görsellerinde yükleme zemini bulunmalı');
  });

  await check('Mobil açılış performansı tanılanıyor', async () => {
    const mobileContext = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.addInitScript(() => {
      window.__mobileLcpEntries = []; window.__mobileShifts = []; window.__mobileLongTasks = [];
      window.__personalizedHeadingTimeline = []; window.__personalizedHeadingMutations = [];
      const capturePersonalizedHeading = () => {
        const section = document.querySelector('#home-personalized-section');
        const heading = section?.querySelector('.home-personalized-heading');
        const overlay = section?.querySelector('.cv-section-loading-overlay');
        const card = section?.querySelector('.home-personalized-mobile-card');
        const showcase = section?.querySelector('.home-personalized-showcase');
        const hero = document.querySelector('#mobileCinematicHero');
        const rect = element => {
          if (!element) return null;
          const r = element.getBoundingClientRect();
          const c = getComputedStyle(element);
          return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height),
            display: c.display, position: c.position, heightCss: c.height, minHeight: c.minHeight,
            visibility: c.visibility, transform: c.transform, offsetHeight: element.offsetHeight,
            inlineStyle: element.getAttribute('style'), offsetParent: element.offsetParent?.id || element.offsetParent?.className || element.offsetParent?.tagName || null };
        };
        window.__personalizedHeadingTimeline.push({
          time: Math.round(performance.now()), found: !!heading,
          section: rect(section), heading: rect(heading), overlay: rect(overlay),
          card: rect(card), showcase: rect(showcase), hero: rect(hero),
          sectionChildren: section ? [...section.children].map(node => ({tag:node.tagName,className:typeof node.className==='string'?node.className:'',id:node.id,rect:rect(node)})) : []
        });
      };
      let headingIdentity = 0;
      const markHeading = node => {
        if (node?.nodeType === 1 && node.matches?.('.home-personalized-heading')) {
          node.dataset.cvDiagnosticId = String(++headingIdentity);
          window.__personalizedHeadingMutations.push({ time: Math.round(performance.now()), type: 'heading-added', id: node.dataset.cvDiagnosticId });
        }
        node?.querySelectorAll?.('.home-personalized-heading').forEach(markHeading);
      };
      new MutationObserver(records => {
        for (const record of records) {
          if (record.type === 'childList') {
            record.addedNodes.forEach(markHeading);
            record.removedNodes.forEach(node => {
              if (node.nodeType === 1 && (node.matches?.('.home-personalized-heading') || node.querySelector?.('.home-personalized-heading'))) {
                window.__personalizedHeadingMutations.push({ time: Math.round(performance.now()), type: 'heading-removed' });
              }
            });
          }
          if (record.type === 'attributes' && record.target.matches?.('.home-personalized-heading')) {
            window.__personalizedHeadingMutations.push({ time: Math.round(performance.now()), type: 'heading-attribute', attribute: record.attributeName, value: record.target.getAttribute(record.attributeName) });
          }
        }
      }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
      const headingCaptureTimer = setInterval(capturePersonalizedHeading, 50);
      setTimeout(() => clearInterval(headingCaptureTimer), 7000);
      try { new PerformanceObserver(list => { for (const entry of list.getEntries()) { const el = entry.element; window.__mobileLcpEntries.push({ startTime: Math.round(entry.startTime), size: entry.size, tag: el?.tagName || null, id: el?.id || null, className: typeof el?.className === 'string' ? el.className.slice(0, 140) : '', src: el?.currentSrc || el?.src || '', text: el?.textContent?.trim().slice(0, 80) || '' }); } }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver(list => { for (const entry of list.getEntries()) { if (!entry.hadRecentInput) window.__mobileShifts.push({ value: entry.value, startTime: Math.round(entry.startTime), sources: (entry.sources || []).slice(0, 5).map(source => ({ tag: source.node?.tagName || null, id: source.node?.id || null, className: typeof source.node?.className === 'string' ? source.node.className.slice(0, 120) : '', previousRect: source.previousRect, currentRect: source.currentRect })) }); } }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__mobileLongTasks.push({ startTime: Math.round(entry.startTime), duration: Math.round(entry.duration), name: entry.name, attribution: (entry.attribution || []).map(item => ({ name: item.name, entryType: item.entryType, containerType: item.containerType, containerName: item.containerName, containerSrc: item.containerSrc, containerId: item.containerId })) }); }).observe({ type: 'longtask', buffered: true });
      } catch {}
    });
    const mobileSession = await mobileContext.newCDPSession(mobilePage);
    await mobileSession.send('Network.enable');
    await mobileSession.send('Network.setCacheDisabled', { cacheDisabled: true });
    await mobileSession.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: 200 * 1024,
      uploadThroughput: 93.75 * 1024,
      connectionType: 'cellular3g'
    });
    await mobileSession.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await mobilePage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await mobilePage.waitForFunction(() => window.Alpine && Array.isArray(window.Alpine.$data(document.documentElement)?.catalog) && window.Alpine.$data(document.documentElement).catalog.length >= 130, { timeout: 60000 });
    await mobilePage.waitForTimeout(6000);
    const diagnostic = await mobilePage.evaluate(() => { const app = window.Alpine.$data(document.documentElement); const footer = document.querySelector('#cineverse-footer'); return { lcp: window.__mobileLcpEntries, shifts: window.__mobileShifts, longTasks: window.__mobileLongTasks, personalizedHeadingTimeline: window.__personalizedHeadingTimeline, personalizedHeadingMutations: window.__personalizedHeadingMutations, resources: performance.getEntriesByType('resource').filter(entry => /app\\.js|alpinejs|catalog-lite|hero-data|icons\.css|fonts\.css|fa-(?:solid-900|regular-400)|fonts\\.gstatic|fonts\\.googleapis/.test(entry.name)).map(entry => ({ name: entry.name.split('/').pop(), type: entry.initiatorType, startTime: Math.round(entry.startTime), duration: Math.round(entry.duration), transferSize: entry.transferSize || 0, responseStatus: entry.responseStatus || 0 })), longTaskSummary: { count: window.__mobileLongTasks.length, totalDuration: window.__mobileLongTasks.reduce((sum, task) => sum + task.duration, 0), longest: Math.max(0, ...window.__mobileLongTasks.map(task => task.duration)) }, homeSections: [...(document.querySelector('#home-page')?.children || [])].map(element => ({ id: element.id || '', section: element.dataset.homeSection || '', ignoreAttr: element.hasAttribute('x-ignore'), ignoreState: !!element._x_ignore, initialized: !!element._x_marker, descendants: element.querySelectorAll('*').length })), totalDomElements: document.querySelectorAll('*').length, catalogLoading: app.catalogLoading, footerEnabled: app.footerConfig?.enabled, footerReady: app.footerConfigReady, footerDisplay: footer ? getComputedStyle(footer).display : null, footerRect: footer?.getBoundingClientRect().toJSON() || null, heroTitle: app.currentHero?.title || '', mobileHeroVisible: !!document.querySelector('#mobileCinematicHero') && getComputedStyle(document.querySelector('#mobileCinematicHero')).display !== 'none' }; });
    console.log('MOBILE PERFORMANCE DIAGNOSTIC:', JSON.stringify(diagnostic));
    await mobileContext.close();
  });

  console.log('CLS SUMMARY:', JSON.stringify({ desktop: desktopCls, desktopShifts: desktopDiagnostics.shifts.length }));
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
    assert.ok(count >= 140, `Katalog beklenen asgari kayıt sayısının altında: ${count}`);
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
      desktopHero: !!document.querySelector('#desktop-hero-image-preload[rel="preload"][as="image"][media*="768px"]')
    }));
    assert.ok(!preloadChecks.catalog && preloadChecks.alpine && preloadChecks.desktopHero,
      'Manşet görseli önceliklendirilmeli; tam katalog manşet görseliyle yarışmamalı');
    await page.waitForFunction(() => {
      const links = [...document.querySelectorAll('link[rel="stylesheet"]')];
      const iconCss = links.some(link => link.href.includes('icons.css') && (link.media === 'all' || link.media === ''));
      const fontCss = links.some(link => link.href.includes('fonts.css') && (link.media === 'all' || link.media === ''));
      const svgIconReady = !!document.querySelector('i.fa-solid svg.perde-icon-svg use[href*="icons.svg"]');
      return iconCss && fontCss && svgIconReady;
    }, { timeout: 15000 });
    const interFontReady = await page.evaluate(async () => {
      await document.fonts.load('700 16px Inter', 'Perde İstanbul');
      return document.fonts.check('700 16px Inter', 'Perde İstanbul') &&
        !performance.getEntriesByType('resource').some(entry => entry.name.includes('fonts.googleapis.com'));
    });
    assert.ok(interFontReady, 'Inter değişken fontu veya yerel font yükleme yolu çalışmıyor');
    const iconFontRequests = await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => /fa-(solid-900|regular-400)\\.woff2/i.test(entry.name)).map(entry => entry.name));
    assert.equal(iconFontRequests.length, 0, 'Eski Font Awesome ikon fontu hâlâ indiriliyor');
    const svgIconCount = await page.locator('i.fa-solid svg.perde-icon-svg use[href*="icons.svg"]').count();
    assert.ok(svgIconCount > 30, `SVG ikonları beklenen şekilde dönüştürülmedi: ${svgIconCount}`);
    const regularBookmarkIconCount = await page.locator('i.fa-regular.fa-bookmark svg.perde-icon-svg use[href*="#regular-bookmark"]').count();
    assert.ok(regularBookmarkIconCount > 0, 'Listeme Ekle için çizgi biçimli yer imi ikonu görünmüyor');
    const regularSpriteSymbols = await page.evaluate(async () => {
      const response = await fetch('./icons.svg?v=20261118-regular-v3');
      const source = await response.text();
      return ['regular-bookmark','regular-circle','regular-heart','regular-star','regular-calendar'].every(id => source.includes('id="' + id + '"'));
    });
    assert.ok(regularSpriteSymbols, 'SVG sprite içindeki düzenli/çizgi ikonları eksik');
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
        const image = document.querySelector('#mobileCinematicHero .cv-mhero-poster img');
        return image && image.complete && image.naturalWidth > 0;
      }, { timeout: 30000 });
      const mobileState = await mobilePage.evaluate(async () => {
        const image = document.querySelector('#mobileCinematicHero .cv-mhero-poster img');
        await new Promise(resolve => setTimeout(resolve, 6000));
        const lcp = window.__lcpEntries || [];
        const resources = performance.getEntriesByType('resource')
          .filter(entry => /image\.tmdb\.org|filmvediziler\.json|alpinejs|fonts\.(googleapis|gstatic)|icons\.css|fa-(?:solid-900|regular-400)/.test(entry.name))
          .map(entry => ({ name: entry.name, start: Math.round(entry.startTime), duration: Math.round(entry.duration), bytes: entry.transferSize || 0, initiator: entry.initiatorType }));
        return {
          mobileVisible: getComputedStyle(document.querySelector('#mobileCinematicHero')).display !== 'none',
          desktopVisible: getComputedStyle(document.querySelector('#desktopEditorialHero')).display !== 'none',
          desktopHeroSource: document.querySelector('#desktopEditorialHero img')?.currentSrc || '',
          source: image.currentSrc || image.src,
          sourceAttribute: image.getAttribute('src') || '',
          imageComplete: image.complete,
          imageNaturalWidth: image.naturalWidth,
          heroArtwork: document.querySelector('#mobileCinematicHero .cv-mhero-backdrop img')?.currentSrc || '',
          activeSlide: window.Alpine?.$data(document.documentElement)?.currentSlideIndex ?? null,
          currentHeroTitle: window.Alpine?.$data(document.documentElement)?.currentHero?.title || '',
          navigationControls: document.querySelectorAll('#mobileCinematicHero .cv-mhero-controls button.cv-mhero-arrow[aria-label]').length,
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
              initialShellPresent: !!document.getElementById('hero-initial-shell-desktop-artwork'),
              homeSections: app?.homeSectionReady || null,
              heroTitle: document.querySelector('#mobileCinematicHero')?.innerText?.trim().slice(0, 100) || ''
            };
          })(),
          resources
        };
      });
      console.log('MOBILE HERO PERFORMANCE:', JSON.stringify(mobileState));

      await mobilePage.waitForFunction(() => {
        const app = window.Alpine?.$data(document.documentElement);
        return app && Array.isArray(app.catalog) && app.catalog.length >= 130;
      }, { timeout: 30000 });
      const mobileSearchTrigger = mobilePage.getByRole('button', { name: 'Film ve dizi ara' });
      assert.ok(await mobileSearchTrigger.isVisible(), 'Mobil arama ikonu görünmüyor');
      await mobileSearchTrigger.click();
      const mobileSearchDialog = mobilePage.getByRole('dialog', { name: 'Film ve dizi ara' });
      await mobileSearchDialog.waitFor({ state: 'visible' });
      await mobileSearchDialog.getByRole('searchbox').fill('Adalet 2');
      await mobilePage.waitForFunction(() => document.querySelectorAll('.cineverse-search-result').length > 0, { timeout: 10000 });
      const mobileSearchRect = await mobileSearchDialog.evaluate(element => element.getBoundingClientRect().toJSON());
      const mobileViewport = await mobilePage.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
      assert.ok(
        mobileSearchRect.width <= mobileViewport.width + 1 &&
        mobileSearchRect.height <= mobileViewport.height + 1 &&
        mobileSearchRect.left >= -1 && mobileSearchRect.top >= -1 &&
        mobileSearchRect.right <= mobileViewport.width + 1 &&
        mobileSearchRect.bottom <= mobileViewport.height + 1,
        'Mobil arama paneli ekran sınırlarını aşıyor: ' + JSON.stringify({ mobileSearchRect, mobileViewport })
      );
      assert.ok(await mobileSearchDialog.locator('.cineverse-search-result img').first().getAttribute('src'), 'Mobil arama afişi yüklenmedi');
      await mobileSearchDialog.getByRole('button', { name: 'Aramayı kapat' }).click();
      assert.ok(mobileState.mobileVisible, 'Mobil manşet telefonda görünmüyor');
      assert.ok(!mobileState.desktopVisible, 'Masaüstü manşeti telefonda görünmemeli');
      assert.ok(!mobileState.desktopHeroSource || !mobileState.desktopHeroSource.startsWith('https://image.tmdb.org/'), 'Mobil ekranda gizli masaüstü manşet görseli indirilmemeli');
      assert.match(mobileState.source, /\/w(342|500|780)\//);
      assert.ok(mobileState.navigationControls >= 2, 'Mobil manşet gezinme kontrolleri yüklenmedi');
    } finally {
      await mobilePage.close();
    }
    const desktopState = await page.evaluate(() => ({
      mobileVisible: getComputedStyle(document.querySelector('#mobileCinematicHero')).display !== 'none',
      desktopVisible: getComputedStyle(document.querySelector('#desktopEditorialHero')).display !== 'none',
    }));
    assert.ok(!desktopState.mobileVisible, 'Mobil manşet masaüstünde görünmemeli');
    assert.ok(desktopState.desktopVisible, 'Mevcut masaüstü manşeti görünmüyor');
  });

  await check('Akıllı öneriler tek kütüphane geçmişini kullanıyor ve önerileri çeşitlendiriyor', async () => {
    const result = await page.evaluate(() => {
      const app = window.Alpine.$data(document.documentElement);
      const original = {
        progress: localStorage.getItem('cine_movie_progress_v1'),
        episodes: localStorage.getItem('cine_episode_tracking_v1'),
        watchlists: localStorage.getItem('cine_watchlist_v1')
      };
      const movie = app.catalog.find(item => item.type === 'movie');
      const series = app.catalog.find(item => item.type === 'tv' && String(item.id) !== String(movie?.id));
      const saved = app.catalog.find(item => item.id !== movie?.id && item.id !== series?.id);
      localStorage.setItem('cine_movie_progress_v1', JSON.stringify({
        [movie.id]: { time: 1200, duration: 1800, savedAt: Date.now() }
      }));
      localStorage.setItem('cine_episode_tracking_v1', JSON.stringify({
        [series.id]: { watched: { '1': [1, 2] }, last: { season: 1, episode: 2, updatedAt: Date.now() } }
      }));
      localStorage.setItem('cine_watchlist_v1', JSON.stringify([{ id: saved.id, title: saved.title }]));
      const recommendations = app.personalizedRecommendations;
      const profile = {
        ids: recommendations.map(item => String(item.id)),
        reasons: recommendations.map(item => item.recommendationReason),
        movieId: String(movie.id),
        seriesId: String(series.id),
        savedId: String(saved.id),
        diagnostic: {
          catalogCount: app.catalog.length,
          progressIds: Object.keys(app.profileMovieProgress),
          episodeIds: Object.keys(JSON.parse(localStorage.getItem('cine_episode_tracking_v1') || '{}')),
          watchlistIds: app.watchlist.map(item => String(item.id)),
          watchedIds: app.watchedItems.map(item => String(item.id)),
          favoriteIds: app.favoriteItems.map(item => String(item.id)),
          sectionConfig: app.homepageConfig?.personalizedSection || {},
          eligibleCount: app.catalog.filter(item => !new Set([...Object.keys(app.profileMovieProgress), ...Object.keys(JSON.parse(localStorage.getItem('cine_episode_tracking_v1') || '{}')), ...app.watchlist.map(item => String(item.id))]).has(String(item.id))).length,
          typeCounts: app.catalog.reduce((counts, item) => { counts[item.type] = (counts[item.type] || 0) + 1; return counts; }, {}),
          recommendationCount: recommendations.length
        }
      };
      for (const [key, value] of Object.entries({
        cine_movie_progress_v1: original.progress,
        cine_episode_tracking_v1: original.episodes,
        cine_watchlist_v1: original.watchlists
      })) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
      return profile;
    });
    const ids = result.ids;
    console.log('RECOMMENDATION DIAGNOSTIC:', JSON.stringify(result.diagnostic));
    assert.ok(ids.length > 0 && ids.length <= 40, 'Öneri havuzu 1–40 aralığında olmalı');
    assert.equal(new Set(ids).size, ids.length, 'Önerilerde yinelenen yapımlar var');
    assert.ok(!ids.includes(result.movieId), 'İzleme ilerlemesi olan film önerilmemeli');
    assert.ok(!ids.includes(result.seriesId), 'Bölüm takibi olan dizi önerilmemeli');
    assert.ok(!ids.includes(result.savedId), 'İzleme listesindeki yapım tekrar önerilmemeli');
    assert.ok(result.reasons.every(Boolean), 'Her önerinin kişisel gerekçesi olmalı');
    if (ids.length >= 5) {
      const types = await page.evaluate(ids => {
        const catalog = window.Alpine.$data(document.documentElement).catalog;
        return ids.slice(0, 5).map(id => catalog.find(item => String(item.id) === id)?.type);
      }, ids);
      const movieCount = types.filter(type => type === 'movie').length;
      const seriesCount = types.filter(type => type === 'tv').length;
      assert.ok(movieCount >= 3 && seriesCount >= 2, 'İlk 5 öneride en az 3 film ve 2 dizi bulunmalı');
    }
  });

  await check('Öneri alanında kaldırılan geri bildirim kontrolleri bulunmuyor', async () => {
    const controls = await page.locator(
      '#home-personalized-section .home-personalized-like, ' +
      '#home-personalized-section .home-personalized-dislike, ' +
      '#home-personalized-section .home-personalized-feature-actions, ' +
      '#home-personalized-section .home-personalized-mobile-feedback'
    ).count();
    assert.equal(controls, 0, 'Kişisel önerilerde beğeni/beğenmeme kontrolleri bulunmamalı');
  });

  await check('Ana sayfada kişisel öneriler dört kartla gösteriliyor ve sade arayüz korunuyor', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const rail = page.locator('#home-personalized-rail');
    console.log('PERSONALIZED UI DIAGNOSTIC:', JSON.stringify(await page.evaluate(() => { const app = window.Alpine.$data(document.documentElement); const section = document.querySelector('#home-personalized-section'); const rail = document.querySelector('#home-personalized-rail'); return { currentPage: app.currentPage, catalogLoading: app.catalogLoading, homeSectionReady: app.homeSectionReady, baseCount: app.personalizedRecommendations.length, displayedCount: app.displayedPersonalizedRecommendations.length, sectionExists: !!section, sectionDisplay: section ? getComputedStyle(section).display : null, sectionVisibility: section ? getComputedStyle(section).visibility : null, sectionIgnored: section?.hasAttribute('x-ignore') || false, sectionReady: app.homeSectionReady?.personalized, railExists: !!rail, cardCount: rail?.querySelectorAll('.home-personalized-alternative').length || 0 }; })));
    await page.waitForFunction(() => document.querySelectorAll('#home-personalized-rail .home-personalized-alternative').length === 4, { timeout: 10000 });
    assert.equal(await page.getByRole('button', { name: 'Tüm önerileri gör' }).count(), 0,
      'Dört kartlık öneri alanında genişletme kontrolü bulunmamalı');
    // The homepage can intentionally hide this section through its saved visibility settings.
    // Reveal it only inside the test so its responsive card layout can still be measured.
    await page.locator('#home-personalized-section').evaluate(element => {
      element.style.setProperty('display', 'block', 'important');
    });
    await page.waitForTimeout(100);
    const initialLayout = await rail.evaluate(element => {
      const cards = [...element.querySelectorAll('.home-personalized-alternative')];
      const first = cards[0].getBoundingClientRect();
      const second = cards[1].getBoundingClientRect();
      const third = cards[2].getBoundingClientRect();
      return {
        count: cards.length,
        columns: new Set(cards.map(card => Math.round(card.getBoundingClientRect().left))).size,
        firstTwoShareRow: Math.abs(first.top - second.top) < 2,
        nextRowBelow: third.top > first.top
      };
    });
    assert.equal(initialLayout.count, 4, 'Dört küçük öneri gösterilmeli');
    assert.equal(initialLayout.columns, 2, 'Öneri alanı iki sütun olmalı');
    assert.ok(initialLayout.firstTwoShareRow && initialLayout.nextRowBelow, 'Kartlar ikişerli satırlara yerleşmeli');

    const cards = rail.locator('.home-personalized-alternative');
    const cardArtwork = await cards.first().evaluate(card => {
      const backdrop = card.querySelector('.home-personalized-card-backdrop');
      const style = backdrop ? getComputedStyle(backdrop) : null;
      return {
        backdrop: !!backdrop && style.display !== 'none' && Number(style.opacity) > 0,
        posterWidth: card.querySelector('.home-personalized-poster').getBoundingClientRect().width,
        plot: !!card.querySelector('.home-personalized-plot'),
        feedbackControls: card.querySelectorAll(
          '.home-personalized-like, .home-personalized-dislike'
        ).length
      };
    });
    assert.ok(cardArtwork.backdrop, 'Kartta hafif kapak arka planı görünmeli');
    assert.ok(cardArtwork.posterWidth >= 60, 'Afiş görseli büyütülmüş olmalı');
    assert.ok(cardArtwork.plot, 'Konu özeti için sınırlı metin alanı olmalı');
    assert.equal(cardArtwork.feedbackControls, 0, 'Kartlarda geri bildirim butonları bulunmamalı');
    assert.equal(await page.locator(
      '#home-personalized-section .home-personalized-like, ' +
      '#home-personalized-section .home-personalized-dislike'
    ).count(), 0, 'Büyük öneri kartında da geri bildirim butonları bulunmamalı');
    await page.setViewportSize({ width: 360, height: 800 });
    const mobileLayout = await page.evaluate(() => {
      const card = document.querySelector('#home-personalized-section .home-personalized-mobile-card');
      const desktopRail = document.querySelector('#home-personalized-rail');
      return {
        mobileCardVisible: !!card && getComputedStyle(card).display !== 'none' &&
          card.getBoundingClientRect().width > 0,
        desktopRailHidden: !!desktopRail && getComputedStyle(desktopRail).display === 'none'
      };
    });
    assert.ok(mobileLayout.mobileCardVisible, 'Mobilde özel öneri kartı görünür olmalı');
    assert.ok(mobileLayout.desktopRailHidden, 'Mobilde masaüstü öneri rafı gizlenmeli');
    await page.setViewportSize({ width: 1440, height: 1000 });
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
      const card = document.querySelector('#home-personalized-section .home-personalized-mobile-card');
      const rail = document.querySelector('#home-personalized-rail');
      return !!card && card.getBoundingClientRect().width > 0 &&
        card.getBoundingClientRect().width <= window.innerWidth &&
        !!rail && getComputedStyle(rail).display === 'none';
    }, { timeout: 5000 });
    const mobileCardWidth = await page.locator('#home-personalized-section .home-personalized-mobile-card').first().evaluate(card => card.getBoundingClientRect().width);
    assert.ok(mobileCardWidth > 0 && mobileCardWidth <= 360, 'Dar ekranda mobil öneri kartı ekran genişliğini aşmamalı');
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  await check('Mobil başlıkta MRTKLC marka yazısı görünür ve taşma yapmaz', async () => {
    for (const width of [320, 360, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      const brand = page.locator('header > div:first-child > div:first-child > a > span').first();
      await page.waitForFunction(() => {
        const el = document.querySelector('header > div:first-child > div:first-child > a > span');
        return !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
      });
      const state = await brand.evaluate(el => ({
        text: (el.textContent || '').replace(/\\s+/g, ''),
        visible: getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      }));
      assert.ok(state.visible, `MRTKLC marka yazısı ${width}px ekranda görünmeli`);
      assert.match(state.text, /MRTKLC/i, `MRTKLC yazısı ${width}px ekranda okunmalı`);
      assert.equal(state.overflow, false, `${width}px ekranda yatay taşma olmamalı`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  await check('Mobil menü açılıyor ve sayfa geçişi yapıyor', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Menüyü aç veya kapat' }).click();
    const mobileMenu = page.locator('header div[x-show*="mobileMenuOpen"]');
    await mobileMenu.waitFor({ state: 'visible' });
    await mobileMenu.getByRole('link', { name: 'Keşfet', exact: true }).click();
    await page.waitForFunction(() => window.location.hash === '#/explore');
    assert.ok(await page.locator('#perde-discovery-showcase').isVisible(), 'Keşfet sayfasının rastgele yapım vitrini görünmeli');
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
    assert.ok(await page.locator('#perde-discovery-showcase').isVisible(),
      'TV klavyesiyle Keşfet sayfasına geçiş yapılamadı');
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  await check('Mobil ve tablette yatay kart şeritleri kaydırılabiliyor', async () => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#home-personalized-rail', { state: 'attached', timeout: 15000 });
    await page.waitForFunction(() => {
      const app = window.Alpine?.$data(document.documentElement);
      return app && !app.catalogLoading && !!window.__cineverseHomeSectionObserver;
    }, null, { timeout: 15000 });
    // Keep the user's saved homepage visibility preference intact; reveal and hydrate this section only in the test context.
    await page.locator('#home-personalized-section').evaluate(element => {
      element.style.setProperty('display', 'block', 'important');
      const app = window.Alpine?.$data(document.documentElement);
      app?.prepareHomePersonalizedVariant?.(element);
    });
    for (const viewport of [{ width: 360, height: 800 }, { width: 768, height: 1024 }]) {
      await page.setViewportSize(viewport);
      await page.locator('#home-catalog-section').evaluate(element =>
        element.scrollIntoView({ block: 'center', behavior: 'auto' })
      );
      await page.waitForFunction(() => {
        const app = window.Alpine?.$data(document.documentElement);
        const personalized = document.querySelector('#home-personalized-rail');
        const catalog = document.querySelector('#home-catalog-rail');
        return !app?.catalogLoading && app?.homeSectionReady?.catalog &&
          personalized?.children.length > 1 && catalog?.children.length > 1;
      }, null, { timeout: 15000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const railSelectors = viewport.width <= 900
        ? ['#home-catalog-rail']
        : ['#home-personalized-rail', '#home-catalog-rail'];
      if (viewport.width <= 639) {
        assert.ok(await page.locator('#home-personalized-section .home-personalized-mobile-card').isVisible(),
          'Dar mobil ekranda kişisel öneri kartı görünür değil');
      } else if (viewport.width <= 900) {
        const tabletLayout = await page.locator('#home-personalized-rail').evaluate(element => ({
          display: getComputedStyle(element).display,
          overflowX: getComputedStyle(element).overflowX,
          visible: element.getBoundingClientRect().width > 0
        }));
        assert.ok(tabletLayout.visible && tabletLayout.display === 'grid',
          'Tablet genişliğinde kişisel öneri kart ızgarası görünür değil');
      }
      for (const selector of railSelectors) {
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
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            start,
            end,
            overflowX,
            cardCount: element.children.length
          };
        });
        assert.ok(state.cardCount > 0, `${selector} kart içermiyor`);
        assert.ok(state.overflowX === 'auto' || state.overflowX === 'scroll', `${selector} yatay kaydırmaya açık değil`);
        assert.ok(state.maxScroll > 0 && state.end > state.start, `${viewport.width}px ekranda ${selector} kaydırılamıyor (overflowX=${state.overflowX}, maxScroll=${state.maxScroll}, clientWidth=${state.clientWidth}, scrollWidth=${state.scrollWidth}, cards=${state.cardCount})`);
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  await check('Ana sayfa bölümleri farklı ekranlarda çakışmıyor ve içerik sınırlarını koruyor', async () => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const app = window.Alpine?.$data(document.documentElement);
      return app && !app.catalogLoading && !!window.__cineverseHomeSectionObserver;
    }, null, { timeout: 20000 });

    for (const viewport of [
      { width: 360, height: 800 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 1000 },
      { width: 1920, height: 1080 }
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(180);
      const sectionCount = await page.locator('#home-page > [data-home-section]').count();
      for (let i = 0; i < sectionCount; i++) {
        const section = page.locator('#home-page > [data-home-section]').nth(i);
        const metrics = await section.evaluate(element => ({
          key: element.dataset.homeSection,
          display: getComputedStyle(element).display,
          height: element.getBoundingClientRect().height,
          needsInit: element.hasAttribute('x-ignore')
        }));
        if (metrics.key !== 'hero' && metrics.display !== 'none' && metrics.height > 1) {
          // İlk boyamada x-ignore ile ertelenen bölümleri ekrana taşı ve
          // yalnızca gerçekten ertelenmiş olanların hazır olmasını bekle.
          await section.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
          if (metrics.key === 'personalized') {
            await page.waitForFunction(() => {
              const app = window.Alpine?.$data(document.documentElement);
              return !!app?.homeSectionReady?.personalized;
            }, null, { timeout: 15000 });
          } else if (metrics.needsInit) {
            await page.waitForFunction(key => {
              const app = window.Alpine?.$data(document.documentElement);
              return !!app?.homeSectionReady?.[key];
            }, metrics.key, { timeout: 10000 });
          }
          await page.waitForTimeout(60);
        }
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(120);
      const layout = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const nodes = [...document.querySelectorAll('#home-page > [data-home-section]')]
          .filter(element => element.tagName === 'SECTION' || element.dataset.homeSection === 'published-collections')
          .filter(element => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.height > 1;
          })
          .map(element => {
            const rect = element.getBoundingClientRect();
            return {
              id: element.id || element.dataset.homeSection,
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              top: Math.round(rect.top),
              bottom: Math.round(rect.bottom),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            };
          })
          .sort((a, b) => a.top - b.top);
        const outOfBounds = nodes.filter(item => item.left < -1 || item.right > width + 1);
        const overlaps = nodes.slice(1).flatMap((item, index) => {
          const previous = nodes[index];
          return item.top < previous.bottom - 2
            ? [{ previous: previous.id, current: item.id, overlap: previous.bottom - item.top }]
            : [];
        });
        return { width, nodes, outOfBounds, overlaps };
      });
      console.log('HOMEPAGE SECTION GEOMETRY:', JSON.stringify({ viewport: viewport.width, ...layout }));
      assert.ok(layout.nodes.length >= 3, `${viewport.width}px ekranda ana sayfa bölümleri yüklenmedi`);
      assert.equal(layout.outOfBounds.length, 0,
        `${viewport.width}px ekranda ana sayfa bölümü ekran sınırını aşıyor: ${JSON.stringify(layout.outOfBounds)}`);
      assert.equal(layout.overlaps.length, 0,
        `${viewport.width}px ekranda ana sayfa bölümleri çakışıyor: ${JSON.stringify(layout.overlaps)}`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  await check('Dokunmatik kaydırma mobil ve tablet ekranlarında doğal çalışıyor', async () => {
    const touchPage = await browser.newPage({
      viewport: { width: 360, height: 800 },
      deviceScaleFactor: 1.5,
      isMobile: true,
      hasTouch: true
    });
    try {
      await touchPage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await touchPage.waitForFunction(() => {
        const app = window.Alpine?.$data(document.documentElement);
        return app && !app.catalogLoading && !!window.__cineverseHomeSectionObserver;
      }, null, { timeout: 30000 });
      await touchPage.locator('#home-catalog-section').evaluate(element =>
        element.scrollIntoView({ block: 'center', behavior: 'auto' })
      );
      await touchPage.waitForFunction(() => {
        const app = window.Alpine?.$data(document.documentElement);
        return app?.homeSectionReady?.catalog &&
          document.querySelector('#home-catalog-rail')?.children.length > 1;
      }, null, { timeout: 20000 });

      const cdp = await touchPage.context().newCDPSession(touchPage);

      for (const viewport of [
        { width: 360, height: 800, label: 'telefon dikey' },
        { width: 768, height: 1024, label: 'tablet dikey' },
        { width: 1024, height: 768, label: 'tablet yatay' }
      ]) {
        await touchPage.setViewportSize({ width: viewport.width, height: viewport.height });
        await touchPage.locator('#home-catalog-section').evaluate(element =>
          element.scrollIntoView({ block: 'center', behavior: 'auto' })
        );
        await touchPage.waitForTimeout(180);

        for (const selector of ['#home-catalog-rail', '#home-personalized-rail']) {
          const rail = touchPage.locator(selector);
          // 901px üzerindeki tablet yatay/masaüstü düzeninde kişiselleştirilmiş
          // öneriler bilinçli olarak dikey grid olur; burada yatay swipe beklenmez.
          if (selector === '#home-personalized-rail' && viewport.width > 900) {
            const layout = await rail.evaluate(element => ({
              display: getComputedStyle(element).display,
              overflowX: getComputedStyle(element).overflowX,
              maxScroll: element.scrollWidth - element.clientWidth
            }));
            assert.equal(layout.display, 'grid',
              `${viewport.label}: kişiselleştirilmiş öneriler masaüstü düzeninde grid olmalı`);
            assert.ok(layout.maxScroll <= 24,
              `${viewport.label}: dikey öneri düzeninde beklenmeyen yatay taşma var`);
            continue;
          }
          await rail.evaluate(element =>
            element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' })
          );
          await touchPage.waitForTimeout(120);
          await rail.evaluate(element => {
            element.style.setProperty('scroll-behavior', 'auto', 'important');
            const maxScroll = element.scrollWidth - element.clientWidth;
            element.scrollLeft = Math.max(0, Math.min(element.scrollLeft, maxScroll - 320));
          });
          await touchPage.waitForTimeout(450);
          const before = await rail.evaluate(element => {
            const rect = element.getBoundingClientRect();
            return {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              maxScroll: element.scrollWidth - element.clientWidth,
              start: element.scrollLeft
            };
          });
          if (before.maxScroll <= 24) {
            const layoutMode = await rail.evaluate(element => ({
              display: getComputedStyle(element).display,
              overflowX: getComputedStyle(element).overflowX
            }));
            if (layoutMode.display === 'grid' && !['auto', 'scroll'].includes(layoutMode.overflowX)) {
              console.log(`PASS: ${viewport.label}: ${selector} bu genişlikte dikey grid düzeninde; yatay dokunmatik kaydırma beklenmiyor`);
              continue;
            }
            const contentFits = await rail.evaluate(element => {
              const container = element.getBoundingClientRect();
              return [...element.children].every(child => {
                const rect = child.getBoundingClientRect();
                return rect.left >= container.left - 1 && rect.right <= container.right + 1;
              });
            });
            assert.ok(
              contentFits,
              `${viewport.label}: ${selector} kaydırma mesafesi yok ancak kartlar görünür alana sığmıyor`
            );
            console.log(`PASS: ${viewport.label}: ${selector} kartları taşmadan görünür alana sığıyor; dokunmatik kaydırma gerekmiyor`);
            continue;
          }
          const x = Math.round(before.left + Math.min(before.width * 0.82, before.width - 18));
          const y = Math.round(before.top + Math.min(before.height / 2, 80));
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x, y, id: 1 }]
          });
          for (const delta of [70, 145, 220]) {
            await cdp.send('Input.dispatchTouchEvent', {
              type: 'touchMove',
              touchPoints: [{ x: x - delta, y, id: 1 }]
            });
            await touchPage.waitForTimeout(35);
          }
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await touchPage.waitForTimeout(220);
          const after = await rail.evaluate(element => ({
            scrollLeft: element.scrollLeft,
            maxScroll: element.scrollWidth - element.clientWidth,
            overflowX: getComputedStyle(element).overflowX
          }));
          assert.ok(
            (after.overflowX === 'auto' || after.overflowX === 'scroll') &&
            after.scrollLeft > before.start + 12,
            `${viewport.label}: ${selector} gerçek dokunmatik hareketle kaymadı (önce=${before.start}, sonra=${after.scrollLeft}, max=${after.maxScroll})`
          );
        }
      }
      await cdp.detach();
    } finally {
      await touchPage.close();
    }
  });

  await check('Profil menüsü kütüphane bağlantılarını ve üç temayı sunuyor', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const profileButton = page.getByRole('button', { name: 'Hesap menüsünü aç' });
    await profileButton.click();
    const profileMenu = page.locator('header .cineverse-profile-dropdown');
    await profileMenu.waitFor({ state: 'visible' });
    for (const label of ['Kütüphanem', 'İzleme Listem', 'İstatistikler', 'Fil Dişi (Sıcak Krem)', 'Modern Gri (Slate)', 'Karanlık Mod']) {
      assert.equal(await profileMenu.locator('.cineverse-dropdown-item').filter({ hasText: label }).count(), 1, label + ' profil menüsünde görünmeli');
    }
    assert.equal(await page.locator('header nav a').filter({ hasText: 'İzleme Listem' }).count(), 0, 'İzleme Listem üst gezinme çubuğunda kalmamalı');
    const menuTextColor = await profileMenu.locator('.cineverse-dropdown-item').first().evaluate(element => getComputedStyle(element).color);
    assert.notEqual(menuTextColor, 'rgb(255, 255, 255)', 'Açık tema profil menüsündeki metin okunabilir olmalı');
    await profileMenu.locator('.cineverse-dropdown-item').filter({ hasText: 'Fil Dişi (Sıcak Krem)' }).click();
    await page.waitForFunction(() => document.documentElement.classList.contains('theme-ivory'));
    await profileMenu.waitFor({ state: 'hidden' });
    await profileButton.click();
    await profileMenu.waitFor({ state: 'visible' });
    await profileMenu.locator('.cineverse-dropdown-item').filter({ hasText: 'Modern Gri (Slate)' }).click();
    await page.waitForFunction(() => document.documentElement.classList.contains('theme-slate'));
    await profileMenu.waitFor({ state: 'hidden' });
    await profileButton.click();
    await profileMenu.waitFor({ state: 'visible' });
    await profileMenu.locator('.cineverse-dropdown-item').filter({ hasText: 'Karanlık Mod' }).click();
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
    await profileMenu.waitFor({ state: 'hidden' });
  });

  await check('Eski profil kayıtları tek kütüphaneye taşınıyor ve çocuk profili verileri siliniyor', async () => {
    const keys = [
      'perde_profile_player_progress_v1', 'cine_movie_progress_v1',
      'cine_episode_tracking_v1', 'cine_profile_watchlists', 'cine_watchlist_v1',
      'cine_active_profile'
    ];
    const original = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), keys);
    await page.evaluate(() => {
      const app = window.Alpine.$data(document.documentElement);
      const movie = app.catalog.find(item => item.type === 'movie');
      const series = app.catalog.find(item => item.type === 'tv');
      localStorage.removeItem('cine_movie_progress_v1');
      localStorage.removeItem('cine_watchlist_v1');
      localStorage.setItem('perde_profile_player_progress_v1', JSON.stringify({
        pro_1: { [movie.id]: { time: 123, duration: 1000 } },
        pro_2: { [movie.id]: { time: 456, duration: 1000 } }
      }));
      localStorage.setItem('cine_episode_tracking_v1', JSON.stringify({
        ['pro_1:' + series.id]: { watched: { '1': [1] }, last: { season: 1, episode: 1 } },
        ['pro_2:' + series.id]: { watched: { '1': [2] }, last: { season: 1, episode: 2 } }
      }));
      localStorage.setItem('cine_profile_watchlists', JSON.stringify({
        pro_1: [{ id: movie.id, title: movie.title }],
        pro_2: [{ id: series.id, title: series.title }]
      }));
      localStorage.setItem('cine_active_profile', 'pro_2');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const app = window.Alpine?.$data(document.documentElement);
      return app && Array.isArray(app.catalog) && app.catalog.length >= 130;
    }, { timeout: 30000 });
    const migrated = await page.evaluate(() => {
      const movie = window.Alpine.$data(document.documentElement).catalog.find(item => item.type === 'movie');
      const series = window.Alpine.$data(document.documentElement).catalog.find(item => item.type === 'tv');
      const progress = JSON.parse(localStorage.getItem('cine_movie_progress_v1') || '{}');
      const episodes = JSON.parse(localStorage.getItem('cine_episode_tracking_v1') || '{}');
      const watchlist = JSON.parse(localStorage.getItem('cine_watchlist_v1') || '[]');
      return {
        movieTime: progress[movie.id]?.time,
        hasChildProgress: Object.values(progress).some(value => value?.time === 456),
        mainEpisode: !!episodes[series.id]?.watched?.['1']?.includes(1),
        childEpisode: Object.values(episodes).some(value => value?.watched?.['1']?.includes(2)),
        watchlistIds: watchlist.map(item => String(item.id)),
        oldProgressKey: localStorage.getItem('perde_profile_player_progress_v1'),
        oldWatchlistKey: localStorage.getItem('cine_profile_watchlists'),
        activeProfileKey: localStorage.getItem('cine_active_profile')
      };
    });
    assert.equal(migrated.movieTime, 123, 'Ana profilin film ilerlemesi korunmalı');
    assert.equal(migrated.hasChildProgress, false, 'Çocuk profilinin film ilerlemesi silinmeli');
    assert.ok(migrated.mainEpisode, 'Ana profilin bölüm takibi korunmalı');
    assert.equal(migrated.childEpisode, false, 'Çocuk profilinin bölüm takibi silinmeli');
    assert.equal(migrated.watchlistIds.length, 1, 'Yalnızca ana profilin izleme listesi korunmalı');
    assert.equal(migrated.oldProgressKey, null, 'Eski profil bazlı ilerleme anahtarı silinmeli');
    assert.equal(migrated.oldWatchlistKey, null, 'Eski profil bazlı liste anahtarı silinmeli');
    assert.equal(migrated.activeProfileKey, null, 'Aktif profil anahtarı silinmeli');
    await page.evaluate(original => {
      for (const [key, value] of Object.entries(original)) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
    }, original);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const app = window.Alpine?.$data(document.documentElement);
      return app && Array.isArray(app.catalog) && app.catalog.length >= 130;
    }, { timeout: 30000 });
  });

  await check('Tek profil menüsü Admin Paneli kısayolunu sunuyor ve çocuk profilini içermiyor', async () => {
    const profileButton = page.locator('header .cineverse-profile-trigger:visible').first();
    await profileButton.waitFor({ state: 'visible' });
    await profileButton.locator('img.cineverse-profile-avatar').waitFor({ state: 'visible' });
    assert.ok(await profileButton.locator('img.cineverse-profile-avatar').isVisible(), 'Kare profil görseli görünmeli');
    const avatarRadius = await profileButton.locator('img').evaluate(element => getComputedStyle(element).borderRadius);
    assert.notEqual(avatarRadius, '50%', 'Profil görseli daire değil, hafif yuvarlatılmış kare olmalı');
    await profileButton.click();
    const profileMenu = page.locator('header .cineverse-profile-dropdown');
    await profileMenu.waitFor({ state: 'visible' });
    assert.ok(await profileMenu.getByText('Ana Profil').isVisible(), 'Ana profil adı görünmeli');
    assert.equal(await profileMenu.locator('.cineverse-profile-option').count(), 0, 'Profil değiştirme seçeneği kalmamalı');
    assert.equal(await profileMenu.getByText(/Profil değiştir|Profil seç/i).count(), 0, 'Profil değiştirme bağlantısı kalmamalı');
    assert.ok(!(await profileMenu.innerText()).includes('Çocuk Profili'), 'Çocuk profili menüde kalmış');
    const adminLink = profileMenu.getByRole('link', { name: /Admin Paneli/ });
    assert.ok(await adminLink.isVisible(), 'Admin Paneli kısayolu görünmeli');
    assert.equal(await adminLink.getAttribute('href'), 'admin/', 'Admin Paneli doğru adrese gitmeli');
    assert.equal(await page.evaluate(() => localStorage.getItem('cine_active_profile')), null, 'Eski aktif profil anahtarı temizlenmeli');
  });

  await check('Tek kütüphanede dizi bölüm takibi ve izleme ilerlemesi', async () => {
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
      return (all['archive-6']?.watched?.['1'] || []).includes(1);
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
        await page.evaluate(() => {
      const app = window.Alpine.$data(document.documentElement);
      app.saveMovieProgress('archive-6', { time: 75, duration: 2400, savedAt: Date.now() });
    });
    const progress = await page.evaluate(() => window.Alpine.$data(document.documentElement).getMovieProgress('archive-6'));
    assert.equal(progress.time, 75, 'Profil bazlı oynatma ilerlemesi geri okunamadı');
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
        const saved = JSON.parse(localStorage.getItem('cine_movie_progress_v1') || '{}')['archive-6:s1e2'];
        return {
          childTime: saved?.time ?? null,
          childDuration: saved?.duration ?? null,
          childSavedAt: saved?.savedAt ?? 0,
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
    assert.equal(timeupdateProgress.childTime, 125, 'timeupdate ilerlemesi kütüphaneye kaydedilmedi');
    assert.equal(timeupdateProgress.childDuration, 2400, 'Video süresi ilerleme kaydına yazılmadı');
    assert.ok(timeupdateProgress.childSavedAt > 0, 'İlerleme kaydına zaman damgası eklenmedi');
    assert.ok(Math.abs(timeupdateProgress.percentage - (125 / 2400 * 100)) < 0.001, 'Oynatma yüzdesi doğru hesaplanmadı');
    assert.equal(timeupdateProgress.currentTimeFormatted, '02:05', 'Geçerli oynatma zamanı doğru biçimlendirilmedi');
    assert.equal(timeupdateProgress.durationFormatted, '40:00', 'Video süresi doğru biçimlendirilmedi');
  });

  await check('İstatistikler sayfası açılıyor', async () => {
    const statsFooterLink = page.locator('footer a').filter({ hasText: 'İstatistikler' }).first();
    await statsFooterLink.scrollIntoViewIfNeeded();
    await statsFooterLink.click();
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
      try {
        localStorage.removeItem('cine_movie_progress_v1');
        localStorage.removeItem('perde_player_progress_v3');
        app.saveMovieProgress(item.id, { time: 75, duration: 2400, savedAt: Date.now() });
        assignedTimes.length = 0;
        app.openWatchPage(item, false);
        await new Promise(resolve => setTimeout(resolve, 300));
        return {
          assignedTime: assignedTimes.length ? assignedTimes[assignedTimes.length - 1] : null,
          playerPresent: !!document.getElementById('customVideoPlayer'),
          savedProgress: app.getMovieProgress(item.id)?.time ?? null
        };
      } finally {
        Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', descriptor);
      }
    });
    assert.ok(restoredTime.playerPresent, 'Video oynatıcı bulunamadı');
    assert.equal(restoredTime.savedProgress, 75, 'Tek kütüphaneye kaydedilen oynatma ilerlemesi geri yüklenmedi');
    assert.equal(restoredTime.assignedTime, 75, 'Oynatıcı kaydedilen saniyeden devam etmedi');
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

  await check('İzleme listesine ekleme ve tek liste kalıcılığı çalışıyor', async () => {
    const saveButton = page.locator('main button[aria-label="Listeme ekle"]').first();
    await saveButton.waitFor({ state: 'visible' });
    await saveButton.click();
    await page.waitForFunction(() => window.Alpine.$data(document.documentElement).isInWatchlist(window.Alpine.$data(document.documentElement).selectedItem));
    await page.waitForFunction(expectedId => {
      const list = JSON.parse(localStorage.getItem('cine_watchlist_v1') || '[]');
      return Array.isArray(list) && list.some(item => String(item.id) === String(expectedId));
    }, adaletId);
    await page.getByRole('button', { name: 'Hesap menüsünü aç' }).click();
    await page.locator('header .cineverse-profile-dropdown').getByRole('button', { name: /İzleme Listem/ }).click();
    await page.waitForURL(/#\/watchlist$/);
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
