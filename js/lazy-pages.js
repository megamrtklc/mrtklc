/**
 * Perde gecikmeli sayfa yükleyicisi
 * İlgili hash rotası açılınca HTML sayfasını indirir ve bellekte önbelleğe alır.
 */
(function () {
    'use strict';
    const pageRoutes = {
        watch: ['watch'],
        'actor-director': ['actor', 'director'],
        explore: ['explore'],
        franchises: ['franchises'],
        watchlist: ['watchlist'],
        library: ['library'],
        stats: ['stats'],
        'video-links': ['video-links']
    };
    const pageCache = new Map();
    const pageStyleCache = new Map();
    const buildVersion = '20261124-lazy-pages-v8';

    // Sayfaya özel büyük CSS dosyalarını yalnızca ilgili rota açıldığında indir.
    const pageStyles = {
        watch: './css/perde-watch.css?v=20261124-watch-css-v1',
        explore: './css/perde-explore.css?v=20261124-explore-css-v1'
    };

    // Keşfet algoritmalarını yalnızca ilgili rota açıldığında yükle.
    const pageScripts = {
        explore: './js/discovery.min.js?v=20261124-discovery-min-v1',
        people: './js/people.js?v=20261124-people-v1',
        'watch-recommendations': './js/watch-recommendations.js?v=20261124-watch-recommendations-v1',
        player: './js/player-controls.js?v=20261125-player-controls-v6'
    };
    const pageScriptRoutes = {
        watch: ['people', 'watch-recommendations', 'player'],
        'actor-director': ['people'],
        explore: ['explore']
    };
    const pageScriptCache = new Map();
    function ensurePageScripts(key) {
        const scriptKeys = pageScriptRoutes[key] || (pageScripts[key] ? [key] : []);
        return Promise.all(scriptKeys.map(scriptKey => {
            const src = pageScripts[scriptKey];
            if (!src) return Promise.resolve();
            if (pageScriptCache.has(src)) return pageScriptCache.get(src);
            const request = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.dataset.perdePageScript = scriptKey;
                script.onload = () => resolve();
                script.onerror = () => { pageScriptCache.delete(src); script.remove(); reject(new Error('Sayfa betiği yüklenemedi: ' + scriptKey)); };
                document.head.appendChild(script);
            });
            pageScriptCache.set(src, request);
            return request;
        }));
    }
    // Derin bağlantılar da aynı önbellekli modül yükleyicisini kullanır.
    window.perdeEnsurePageScript = ensurePageScripts;

    function ensurePageStyles(key) {
        const href = pageStyles[key];
        if (!href) return Promise.resolve();
        if (pageStyleCache.has(key)) return pageStyleCache.get(key);

        const request = new Promise(resolve => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.dataset.perdePageStyle = key;
            link.onload = () => resolve();
            link.onerror = () => {
                console.warn('[Perde lazy styles] Stil dosyası yüklenemedi:', key);
                pageStyleCache.delete(key);
                link.remove();
                resolve();
            };
            document.head.appendChild(link);
        });
        pageStyleCache.set(key, request);
        return request;
    }

    async function fetchPage(key) {
        // Sayfa önbellekte olsa bile önce rota stilinin yüklenmesini (ve hata sonrası yeniden denenmesini) sağla.
        await ensurePageStyles(key);
        await ensurePageScripts(key);
        if (pageCache.has(key)) return pageCache.get(key);
        const request = fetch(`./runtime-pages/${key}.html?v=${buildVersion}`, { cache: 'default' })
            .then(response => {
                if (!response.ok) throw new Error(`Sayfa dosyası yüklenemedi (HTTP ${response.status}).`);
                return response.text();
            })
            .then(html => {
                if (!html || !html.trim()) throw new Error('Sayfa dosyası boş döndü.');
                return html;
            })
            .catch(error => { pageCache.delete(key); throw error; });
        pageCache.set(key, request);
        return request;
    }

    window.perdeLazyPage = function (key) {
        return {
            html: '',
            loading: false,
            loaded: false,
            error: '',
            init() {
                this.$watch('currentPage', () => this.loadIfActive());
                this.$nextTick(() => this.loadIfActive());
            },
            isActive() {
                return (pageRoutes[key] || []).includes(this.currentPage);
            },
            loadIfActive() {
                if (this.isActive() && !this.loaded && !this.loading) this.load();
            },
            async load() {
                if (this.loading || this.loaded) return;
                this.loading = true;
                this.error = '';
                try {
                    this.html = await fetchPage(key);
                    this.loaded = true;
                } catch (error) {
                    this.error = 'Bu bölüm şu anda yüklenemedi. İnternet bağlantını kontrol edip yeniden deneyebilirsin.';
                    console.error('[Perde lazy page]', key, error);
                } finally {
                    this.loading = false;
                }
            }
        };
    };
})();
