/**
 * Perde Arama – Oyuncu ve Yapım Eşleştirme
 * -------------------------------------------------
 * Global arama penceresinin oyuncu/yönetmen sonuçlarını ve hızlı yapım
 * eşleştirmesini üretir. Arama penceresi ilk açıldığında gecikmeli yüklenir.
 * Ana Alpine uygulamasındaki normalizeSearchText, loadCatalogCastData,
 * getDirectorNames ve resolveDirectorPerson yardımcılarını kullanır.
 */
(function () {
    'use strict';
    window.PerdeSearchPeople = {
        async schedulePersonSearch(value) {
            if (this.personSearchTimer) clearTimeout(this.personSearchTimer);
            const query = String(value || '').trim();
            const queryTokens = this.normalizeSearchText(query).split(/\s+/).filter(Boolean);
            const requestId = ++this.personSearchRequestId;
            this.personSearchResults = [];
            this.personSearchLoading = false;
            if (query.length < 2 || !queryTokens.length) return;
            // Yapım açıklamaları yalnızca kullanıcı gerçekten arama yaptığında indirilir.
            this.loadCatalogDescriptionsData?.();
            // Oyuncu araması gerçek kullanıcı niyetidir; gerekiyorsa geniş kadro verisini şimdi getir.
            if (!window.__cvCatalogCastPromise) {
                this.loadCatalogCastData().then(() => {
                    if (requestId === this.personSearchRequestId) this.schedulePersonSearch(query);
                });
            }
            const people = new Map();
            const matchesName = name => {
                const normalizedName = this.normalizeSearchText(name).trim();
                const nameTokens = normalizedName.split(/\s+/).filter(Boolean);
                return queryTokens.length > 1
                    ? normalizedName.startsWith(queryTokens.join(' '))
                    : nameTokens.some(nameToken => nameToken.startsWith(queryTokens[0]));
            };
            const addPerson = (person, item, department) => {
                const name = typeof person === 'string' ? person : (person?.name || '');
                if (!name || !matchesName(name)) return;
                const normalizedName = this.normalizeSearchText(name);
                const personId = typeof person === 'object' && person?.id ? String(person.id) : normalizedName;
                const key = department + ':' + personId;
                if (!people.has(key)) {
                    people.set(key, {
                        id: personId,
                        tmdbId: typeof person === 'object' && person?.id ? Number(person.id) : null,
                        name,
                        profile: typeof person === 'object' ? (person.profile || (person.profile_path ? 'https://image.tmdb.org/t/p/w185' + person.profile_path : '')) : '',
                        known_for_department: department,
                        known_for: [],
                        _workIds: new Set()
                    });
                }
                const entry = people.get(key);
                const workKey = String(item.id || item.tmdbId || item.title);
                if (!entry._workIds.has(workKey)) {
                    entry._workIds.add(workKey);
                    entry.known_for.push(item);
                }
                if (!entry.profile && typeof person === 'object') entry.profile = person.profile || '';
            };
            (this.catalog || []).forEach(item => {
                const cast = Array.isArray(item.tmdbCast) && item.tmdbCast.length
                    ? item.tmdbCast
                    : (Array.isArray(item.cast) ? item.cast : []);
                cast.forEach(person => addPerson(person, item, 'Acting'));
                this.getDirectorNames(item.tmdbDirector || item.director).forEach(directorName => {
                    addPerson({ name: directorName }, item, 'Directing');
                });
            });
            for (const person of people.values()) {
                if (person.known_for_department !== 'Directing' || person.profile) continue;
                const resolved = await this.resolveDirectorPerson({ name: person.name });
                if (requestId !== this.personSearchRequestId) return;
                if (resolved?.id) {
                    person.tmdbId = Number(resolved.id);
                    person.id = String(resolved.id);
                    person.profile = resolved.profile || '';
                }
            }
            if (requestId !== this.personSearchRequestId) return;
            this.personSearchResults = Array.from(people.values())
                .map(person => ({
                    ...person,
                    known_for: person.known_for.sort((a, b) => String(b.year || '').localeCompare(String(a.year || ''))).slice(0, 6)
                }))
                .sort((a, b) => b.known_for.length - a.known_for.length || a.name.localeCompare(b.name, 'tr'))
                .slice(0, 6);
        },
        getQuickSearchResults() {
            const query = this.normalizeSearchText(this.searchQuery);
            if (!query) return [];
            return this.catalog.map(item => {
                const title = this.normalizeSearchText(item.title || '');
                const original = this.normalizeSearchText(item.originalTitle || '');
                const castNames = (item.tmdbCast || item.cast || []).map(person => typeof person === 'string' ? person : (person?.name || '')).join(' ');
                const searchable = this.normalizeSearchText([item.title, item.originalTitle, item.genre, item.category, item.desc, item.director, item.starring, item.country, castNames].filter(Boolean).join(' '));
                const score = title === query ? 100 : title.startsWith(query) ? 85 : original.startsWith(query) ? 75 : title.includes(query) ? 65 : searchable.includes(query) ? 35 : 0;
                return { item, score };
            }).filter(entry => entry.score > 0)
                .sort((a, b) => b.score - a.score || (Number.parseFloat(b.item.rating) || 0) - (Number.parseFloat(a.item.rating) || 0))
                .slice(0, 10)
                .map(entry => entry.item);
        }
    };
})();
