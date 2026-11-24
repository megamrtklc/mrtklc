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
    const buildVersion = '20261124-lazy-pages-v1';

    async function fetchPage(key) {
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
