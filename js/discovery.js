/**
 * Perde Keşfet modülü
 * Rastgele keşif seçimi ve keşfet sayfasına özel vitrin/listeleri yönetir.
 * Yalnızca Keşfet rotası açıldığında js/lazy-pages.js tarafından yüklenir.
 */
(function () {
    'use strict';

    window.PerdeDiscovery = {
        // Filtre değiştiğinde mevcut havuzdan daha önce gösterilmemiş bir yapım seçer.
        initializeDiscovery() {
            safeStorageWrite('perde_discovery_shuffle_seed_v1', this.discoveryShuffleSeed);
            const pool = this.sortedFilteredCatalog;
            if (!pool.length) {
                this.discoveryCurrentItemId = '';
                safeStorageWrite('perde_discovery_current_v1', '');
                return;
            }
            if (this.discoveryCurrentItem) return;
            const catalogIds = new Set(this.catalog.map(item => String(item.id ?? item.title ?? '')));
            let seen = [...new Set((Array.isArray(this.discoverySeenIds) ? this.discoverySeenIds : []).map(String).filter(id => catalogIds.has(id)))];
            const currentId = String(this.discoveryCurrentItemId || '');
            let candidates = pool.filter(item => !seen.includes(String(item.id ?? item.title ?? '')));
            if (!candidates.length) {
                seen = currentId ? [currentId] : [];
                candidates = pool.filter(item => String(item.id ?? item.title ?? '') !== currentId);
                if (!candidates.length) candidates = pool;
            }
            const picked = candidates[Math.floor(Math.random() * candidates.length)];
            if (!picked) return;
            const pickedId = String(picked.id ?? picked.title ?? '');
            this.discoveryCurrentItemId = pickedId;
            if (!seen.includes(pickedId)) seen.push(pickedId);
            this.discoverySeenIds = seen;
            safeStorageWrite('perde_discovery_current_v1', pickedId);
            safeStorageWrite('perde_discovery_seen_v1', seen);
        },

        // Kullanıcı yeni bir rastgele yapım istediğinde mevcut seçimi tekrar etmez.
        pickAnotherDiscovery() {
            const pool = this.sortedFilteredCatalog;
            if (pool.length < 2) return;
            const currentId = String(this.discoveryCurrentItemId || '');
            let seen = [...new Set((Array.isArray(this.discoverySeenIds) ? this.discoverySeenIds : []).map(String))];
            let candidates = pool.filter(item => {
                const id = String(item.id ?? item.title ?? '');
                return id !== currentId && !seen.includes(id);
            });
            if (!candidates.length) {
                seen = currentId ? [currentId] : [];
                candidates = pool.filter(item => String(item.id ?? item.title ?? '') !== currentId);
            }
            if (!candidates.length) return;
            const picked = candidates[Math.floor(Math.random() * candidates.length)];
            const pickedId = String(picked.id ?? picked.title ?? '');
            this.discoveryCurrentItemId = pickedId;
            if (!seen.includes(pickedId)) seen.push(pickedId);
            this.discoverySeenIds = seen;
            safeStorageWrite('perde_discovery_current_v1', pickedId);
            safeStorageWrite('perde_discovery_seen_v1', seen);
        },

        // Keşfet vitrinindeki altı afişin sırasını yeni bir tohumla değiştirir.
        refreshDiscoveryShowcase() {
            const nextSeed = String(Math.floor(Math.random() * 0x7fffffff));
            this.discoveryShowcaseSeed = nextSeed === String(this.discoveryShowcaseSeed)
                ? String((Number(nextSeed) + 1) % 0x7fffffff)
                : nextSeed;
            safeStorageWrite('perde_discovery_showcase_seed_v1', this.discoveryShowcaseSeed);
        },

        // Seçili yapımı dışarıda bırakarak vitrin afişlerini kararlı biçimde sıralar.
        getDiscoveryShowcaseItems() {
            const currentId = String(this.discoveryCurrentItemId || '');
            const result = this.sortedFilteredCatalog.filter(item => String(item.id ?? item.title ?? '') !== currentId);
            const seed = String(this.discoveryShowcaseSeed || 1);
            const score = item => {
                const key = seed + '|' + String(item.id ?? item.title ?? '');
                let hash = 2166136261;
                for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
                return hash >>> 0;
            };
            return result.sort((a, b) => score(a) - score(b) || String(a.id ?? a.title ?? '').localeCompare(String(b.id ?? b.title ?? ''), 'tr')).slice(0, 6);
        },

        // Vitrindeki yapımları liste bölümünden çıkarır; varsayılan sırayı tohumla karıştırır.
        getDiscoveryListCatalog() {
            const excludedIds = new Set([
                String(this.discoveryCurrentItemId || ''),
                ...this.discoveryShowcaseItems.map(item => String(item.id ?? item.title ?? ''))
            ]);
            const result = this.sortedFilteredCatalog.filter(item => !excludedIds.has(String(item.id ?? item.title ?? '')));
            if (this.sortBy === 'default') {
                const seed = String(this.discoveryShuffleSeed || 1);
                const score = item => {
                    const key = seed + '|' + String(item.id ?? item.title ?? '');
                    let hash = 2166136261;
                    for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
                    return hash >>> 0;
                };
                result.sort((a, b) => score(a) - score(b) || String(a.id ?? a.title ?? '').localeCompare(String(b.id ?? b.title ?? ''), 'tr'));
            }
            return result;
        }
    };
})();
