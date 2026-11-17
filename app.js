
        function safeStorageRead(key, fallback = null) {
            try {
                const raw = localStorage.getItem(key);
                if (raw === null || raw === '') return fallback;
                try { return JSON.parse(raw); } catch (_) { return raw; }
            } catch (error) { console.warn('Yerel kayıt okunamadı:', key, error); return fallback; }
        }
        function safeStorageWrite(key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); return true; }
            catch (error) { console.warn('Yerel kayıt kaydedilemedi:', key, error); return false; }
        }

        function migrateToSingleProfileStorage() {
            const legacyProgress = safeStorageRead('perde_profile_player_progress_v1', null);
            if (safeStorageRead('cine_movie_progress_v1', null) === null && legacyProgress && typeof legacyProgress === 'object' && !Array.isArray(legacyProgress)) {
                const mainProgress = legacyProgress.pro_1 && typeof legacyProgress.pro_1 === 'object' && !Array.isArray(legacyProgress.pro_1)
                    ? legacyProgress.pro_1
                    : (Object.prototype.hasOwnProperty.call(legacyProgress, 'pro_2') ? {} : legacyProgress);
                safeStorageWrite('cine_movie_progress_v1', mainProgress);
            }
            try { localStorage.removeItem('perde_profile_player_progress_v1'); } catch (_) {}

            const episodes = safeStorageRead('cine_episode_tracking_v1', {});
            if (episodes && typeof episodes === 'object' && !Array.isArray(episodes)) {
                let hasLegacyEpisodeKeys = false;
                for (const key in episodes) {
                    if (key.startsWith('pro_1:') || key.startsWith('pro_2:')) {
                        hasLegacyEpisodeKeys = true;
                        break;
                    }
                }
                if (hasLegacyEpisodeKeys) {
                    const migratedEpisodes = {};
                    Object.entries(episodes).forEach(([key, value]) => {
                        if (key.startsWith('pro_2:')) return;
                        migratedEpisodes[key.startsWith('pro_1:') ? key.slice(6) : key] = value;
                    });
                    safeStorageWrite('cine_episode_tracking_v1', migratedEpisodes);
                }
            }

            const legacyWatchlists = safeStorageRead('cine_profile_watchlists', null);
            if (safeStorageRead('cine_watchlist_v1', null) === null && legacyWatchlists && typeof legacyWatchlists === 'object' && !Array.isArray(legacyWatchlists)) {
                safeStorageWrite('cine_watchlist_v1', Array.isArray(legacyWatchlists.pro_1) ? legacyWatchlists.pro_1 : []);
            }
            try { localStorage.removeItem('cine_profile_watchlists'); } catch (_) {}
            try { localStorage.removeItem('cine_active_profile'); } catch (_) {}
        }

        migrateToSingleProfileStorage();

        const personalizedRecommendationCache = new WeakMap();
        const recommendationPlotTermsCache = new WeakMap();
        const recommendationStopWords = new Set(['about','after','again','against','among','because','before','being','between','could','every','first','from','have','into','just','more','most','other','over','same','some','such','than','that','their','them','then','there','these','they','this','those','through','under','until','very','were','what','when','where','which','while','with','would','your','ancak','artık','bazen','belki','birçok','bütün','daha','diğer','eden','eder','edilir','etti','gibi','hem','her','hiç','için','ile','kadar','kendi','kez','ki','kim','nasıl','neden','nerede','olan','olarak','oldu','olduğu','olmak','olmuş','önce','sonra','şey','tüm','üzere','veya','yine']);

        // Katalog kayıtları ana sitede salt-okunur; Vue/Alpine derin proxy maliyetini önle.
        // __v_skip, Alpine'in kullandığı Vue reactivity katmanının standart raw işaretidir.
        function markStaticCatalog(value) {
            if (!value || typeof value !== 'object') return value;
            try {
                Object.defineProperty(value, '__v_skip', { value: true, configurable: true });
            } catch (error) {
                console.warn('Katalog salt-okunur optimizasyonu uygulanamadı:', error);
            }
            return value;
        }

        function ultimateProApp() {
            return {
                getTmdbImageSrcSet(url, widths = [154, 185, 342, 500]) {
                    if (typeof url !== 'string') return '';
                    const match = url.match(/^(https:\/\/image\.tmdb\.org\/t\/p\/)(?:w\d+|original)(\/.*)$/);
                    if (!match) return '';
                    return widths.map(width => `${match[1]}w${width}${match[2]} ${width}w`).join(', ');
                },

                handleImageError(event) {
                    const image = event && event.target;
                    if (!image || image.dataset.perdeFallbackApplied) return;
                    image.dataset.perdeFallbackApplied = 'true';
                    // Eski srcset/picture kaynakları, src değişse bile tarayıcı tarafından seçilmeye devam edebilir.
                    image.removeAttribute('srcset');
                    image.removeAttribute('sizes');
                    image.parentElement?.querySelectorAll?.('source').forEach(source => source.removeAttribute('srcset'));
                    const placeholder = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 480"><rect width="320" height="480" fill="#171923"/><g fill="none" stroke="#555b6b" stroke-width="8"><rect x="104" y="176" width="112" height="84" rx="10"/><path d="m116 244 34-35 24 22 18-18 20 24"/></g><text x="160" y="310" fill="#9ca3af" font-size="18" text-anchor="middle" font-family="Arial,sans-serif">Görsel yok</text></svg>';
                    image.src = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(placeholder);
                },
                currentPage: 'home',
                activeHeaderMenu: 'home',
                searchQuery: '',
                searchOverlayOpen: false,
                searchPreviousOverflow: '',
                personSearchResults: [],
                personSearchLoading: false,
                personSearchTimer: null,
                personSearchRequestId: 0,
                async schedulePersonSearch(value) {
                    if (this.personSearchTimer) clearTimeout(this.personSearchTimer);
                    const query = String(value || '').trim();
                    const queryTokens = this.normalizeSearchText(query).split(/\s+/).filter(Boolean);
                    const requestId = ++this.personSearchRequestId;
                    this.personSearchResults = [];
                    this.personSearchLoading = false;
                    if (query.length < 2 || !queryTokens.length) return;

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
                        const directorName = item.tmdbDirector || item.director || '';
                        if (directorName) addPerson({ name: directorName }, item, 'Directing');
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
                get quickSearchResults() {
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
                },
                openSearchOverlay() {
                    this.searchPreviousOverflow = document.body.style.overflow;
                    this.searchOverlayOpen = true;
                    this.searchQuery = '';
                    document.body.style.overflow = 'hidden';
                    this.$nextTick(() => this.$refs.globalSearchInput?.focus());
                },
                closeSearchOverlay() {
                    this.searchOverlayOpen = false;
                    document.body.style.overflow = this.searchPreviousOverflow;
                    this.searchPreviousOverflow = '';
                },
                selectSearchResult(item) {
                    if (!item) return;
                    this.closeSearchOverlay();
                    this.searchQuery = '';
                    this.openWatchPage(item);
                },
                quickFilter: 'all',
                homeCatalogShuffleSeed: Math.floor(Math.random() * 0x7fffffff),
                sortBy: 'default',
                discoveryType: 'all',
                discoveryMood: 'all',
                discoveryGenre: 'all',
                discoveryCountry: 'all',
                discoveryCountryCode: '',
                discoveryDirector: '',
                discoveryPlatform: 'all',
                discoveryRating: '0',
                discoveryYearFrom: '',
                discoveryYearTo: '',
                selectedItem: null,
                currentSlideIndex: 0,
                userRating: 8,
                userCommentText: '',
                selectedSeason: 1,
                selectedEpisode: 1,
                currentEpisodePage: 1,
                
                theme: ['ivory','slate','dark'].includes(safeStorageRead('cine_theme_v3','dark')) ? safeStorageRead('cine_theme_v3','dark') : 'dark',
                
                get isDarkMode() {
                    return this.theme === 'dark';
                },

                setTheme(newTheme) {
                    this.theme = newTheme;
                    safeStorageWrite('cine_theme_v3', newTheme);
                },

                getBodyClass() {
                    if (this.theme === 'ivory') return 'bg-ivory-50';
                    if (this.theme === 'slate') return 'bg-slateLight-50';
                    return 'bg-[#0b0d11]';
                },

                getHeaderClass() {
                    if (this.theme === 'ivory') return 'bg-ivory-100/95 border-ivory-200';
                    if (this.theme === 'slate') return 'bg-slateLight-100/95 border-slateLight-200';
                    return 'bg-[#0f1115]/95 border-gray-800/80';
                },

                getCardClass() {
                    if (this.theme === 'ivory') return 'bg-ivory-card border-ivory-200';
                    if (this.theme === 'slate') return 'bg-slateLight-card border-slateLight-200';
                    return 'bg-[#161922] border-gray-800';
                },

                getDiscoveryTileClass() {
                    if (this.theme === 'ivory') return 'bg-ivory-100 border-ivory-200';
                    if (this.theme === 'slate') return 'bg-slateLight-100 border-slateLight-200';
                    return 'bg-white/[0.03] border-gray-700/80';
                },

                getDiscoveryEmptyClass() {
                    if (this.theme === 'ivory') return 'bg-ivory-100 border-ivory-200 text-gray-600';
                    if (this.theme === 'slate') return 'bg-slateLight-100 border-slateLight-200 text-gray-600';
                    return 'bg-white/[0.03] border-gray-700 text-gray-400';
                },

                getDiscoveryTrackClass() {
                    if (this.theme === 'ivory') return 'bg-ivory-200';
                    if (this.theme === 'slate') return 'bg-slateLight-200';
                    return 'bg-gray-700';
                },

                getMutedTextClass() {
                    if (this.theme === 'ivory' || this.theme === 'slate') return 'text-gray-600';
                    return 'text-gray-400';
                },

                getSearchClass() {
                    if (this.theme === 'ivory') return 'bg-ivory-200 border-ivory-200';
                    if (this.theme === 'slate') return 'bg-slateLight-200 border-slateLight-200';
                    return 'bg-gray-900 border-gray-800';
                },

                getButtonClass() {
                    if (this.theme === 'ivory') return 'bg-ivory-200 border-ivory-200 text-gray-800';
                    if (this.theme === 'slate') return 'bg-slateLight-200 border-slateLight-200 text-gray-800';
                    return 'bg-gray-900 border-gray-800 text-amber-400';
                },

                getThemeIcon() {
                    if (this.theme === 'ivory') return 'fa-solid fa-sun text-amber-500 text-xs';
                    if (this.theme === 'slate') return 'fa-solid fa-circle-half-stroke text-sky-500 text-xs';
                    return 'fa-solid fa-moon text-indigo-400 text-xs';
                },

                getWatchCardOrder(cardId) {
                    const defaults = {
                        left: ['player','season','episodes','synopsis','reviews'],
                        right: ['credits','cast','similar']
                    };
                    const saved = this.watchPageConfig || {};
                    const allIds = Object.values(defaults).flat();
                    const removed = Array.isArray(saved.removed) ? saved.removed : [];
                    const left = Array.isArray(saved.left) ? saved.left.filter(id => allIds.includes(id) && !removed.includes(id)) : [];
                    const right = Array.isArray(saved.right) ? saved.right.filter(id => allIds.includes(id) && !removed.includes(id) && !left.includes(id)) : [];
                    const all = [...left,...right];
                    allIds.forEach(id => { if (!all.includes(id) && !removed.includes(id)) (defaults.left.includes(id) ? left : right).push(id); });
                    const side = left.includes(cardId) ? left : right;
                    return side.indexOf(cardId);
                },

                applyWatchPageLayout() {
                    const config = this.watchPageConfig || {};
                    const defaults = {
                        left: ['player','season','episodes','synopsis','reviews'],
                        right: ['credits','cast','similar']
                    };
                    const allIds = Object.values(defaults).flat();
                    const removed = Array.isArray(config.removed) ? config.removed : [];
                    const hidden = Array.isArray(config.hidden) ? config.hidden : [];
                    const left = Array.isArray(config.left) ? config.left.filter((id,index,arr) => allIds.includes(id) && !removed.includes(id) && arr.indexOf(id) === index) : [];
                    const right = Array.isArray(config.right) ? config.right.filter((id,index,arr) => allIds.includes(id) && !removed.includes(id) && !left.includes(id) && arr.indexOf(id) === index) : [];
                    const used = new Set([...left,...right]);
                    allIds.forEach(id => { if (!used.has(id) && !removed.includes(id)) (defaults.left.includes(id) ? left : right).push(id); });
                    this.$nextTick(() => {
                        const leftColumn = document.getElementById('watch-left-column');
                        const rightColumn = document.getElementById('watch-right-column');
                        if (!leftColumn || !rightColumn) return;
                        const cards = new Map(Array.from(document.querySelectorAll('[data-watch-card]')).map(node => [node.dataset.watchCard,node]));
                        allIds.forEach(id => { const node=cards.get(id); if(node) node.hidden=removed.includes(id)||hidden.includes(id); });
                        left.forEach((id,index) => { const node=cards.get(id); if(node){node.hidden=hidden.includes(id);node.style.order=String(index);leftColumn.appendChild(node);} });
                        right.forEach((id,index) => { const node=cards.get(id); if(node){node.hidden=hidden.includes(id);node.style.order=String(index);rightColumn.appendChild(node);} });
                    });
                },

                getThemeName() {
                    if (this.theme === 'ivory') return 'Fil Dişi';
                    if (this.theme === 'slate') return 'Modern Gri';
                    return 'Karanlık';
                },
                
                catalog: [],
                heroCatalog: [],
                collections: [],
                franchises: [],
                selectedFranchiseId: null,
                homepageConfig: window.__CV_HERO_BOOTSTRAP__?.homepageConfig || null,
                headerConfigReady: false,
                headerConfig: { enabled:true, sticky:true, showLogoIcon:true, brandPrimary:'CINE', brandAccent:'VERSE', showHome:true, homeLabel:'Ana Sayfa', showExplore:true, exploreLabel:'Keşfet', showVideo:true, videoLabel:'Video Bağlantıları', showSearch:true, showProfile:true, showMobileMenu:true, catalogMenusInitialized:false, customLinks:[] },
                footerConfigReady: false,
                footerConfig: { enabled:true, customLinks:[], brandPrimary:'CINE', brandAccent:'VERSE', description:'Filmlerini keşfet, dizilerini takip et, izleme yolculuğunu kendi kütüphanende biriktir.', showBadges:true, badgeOne:'KİŞİSEL KÜTÜPHANE', badgeTwo:'DİZİ TAKİBİ', columnOneTitle:'CineVerse', homeLabel:'Ana Sayfa', exploreLabel:'Keşfet', libraryLabel:'Kütüphanem', columnTwoTitle:'İzleme Alanım', watchlistLabel:'İzleme Listem', statsLabel:'İstatistikler', featureTitle:'İzleme keyfini kişiselleştir', featureDescription:'Listeni oluştur, kaldığın yerden devam et ve izleme geçmişini tek yerde düzenle.', ctaLabel:'Kütüphaneme Git', showCta:true, copyright:'© 2026 CineVerse. Tüm hakları saklıdır.', showBackToTop:true },
                watchPageConfig: null,
                heroAutoplayTimer: null,
                heroPaused: false,
                catalogLoading: true,
                catalogError: null,
                homeSectionReady: {
                    personalized: false,
                    continue: false,
                    watchlist: false,
                    watched: false,
                    favorites: false,
                    'new-arrivals': false,
                    'series-tracking': false,
                    'genre-discovery': false,
                    franchises: false,
                    'published-collections': false,
                    catalog: false
                },
                homeSectionLoading: {
                    personalized: true
                },
                tmdbApiKey: '3108265ab3fdbf3af14175edf64a9c7f',
                tmdbLanguage: 'tr-TR',
                tmdbDetailsCache: {},
                selectedActor: null,
                actorProfileLoading: false,
                actorProfileError: '',
                actorProfileCache: {},
                directorProfileCache: {},
                tmdbDetailsLoading: false,
                tmdbSeasonLoading: false,
                tmdbSeasonRequests: {},
                tmdbDetailsError: '',

                heroEnglishTitleRequests: {},
                getHeroEnglishTitle(item = this.currentHero) {
                    if (!item) return '';
                    const english = String(item.englishTitle || item.tmdbEnglishTitle || '').trim();
                    const title = String(item.title || '').trim();
                    if (!english) return '';
                    const normalize = value => value.toLocaleLowerCase('en-US').replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
                    return normalize(english) && normalize(english) !== normalize(title) ? english : '';
                },
                async loadHeroEnglishTitles() {
                    const slides = [...new Map((this.heroSlides || []).filter(Boolean).map(item => [String(item.id), item])).values()];
                    let cursor = 0;
                    const normalize = value => String(value || '').toLocaleLowerCase('en-US')
                        .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
                        .replace(/[’‘]/g, "'").replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, ' ').trim();
                    const requestWithRetry = async (path, language = 'en-US') => {
                        let lastError;
                        for (let attempt = 0; attempt < 3; attempt++) {
                            try {
                                return await this.fetchTmdb(path, language);
                            } catch (error) {
                                lastError = error;
                                if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
                            }
                        }
                        throw lastError;
                    };
                    const worker = async () => {
                        while (cursor < slides.length) {
                            const item = slides[cursor++];
                            if (!item || item.englishTitle || item.tmdbEnglishTitle || this.heroEnglishTitleRequests[item.id]) continue;
                            this.heroEnglishTitleRequests[item.id] = true;
                            try {
                                const mediaType = item.type === 'tv' || item.type === 'series' ? 'tv' : 'movie';
                                const expectedImdb = String(item.imdbId || item.tmdbImdbId || '').trim();
                                let tmdbId = item.tmdbId || null;
                                let details = null;

                                if (tmdbId) {
                                    details = await requestWithRetry(mediaType + '/' + tmdbId + '?append_to_response=external_ids,alternative_titles&country=US');
                                }

                                // TMDB kimliği eksikse veya IMDb eşleşmesi farklıysa IMDb üzerinden doğru kaydı bul.
                                const actualImdb = String(details?.external_ids?.imdb_id || details?.imdb_id || '').trim();
                                if (expectedImdb && (!tmdbId || (actualImdb && expectedImdb !== actualImdb))) {
                                    const found = await requestWithRetry('find/' + encodeURIComponent(expectedImdb) + '?external_source=imdb_id');
                                    const matches = mediaType === 'tv' ? (found?.tv_results || []) : (found?.movie_results || []);
                                    if (matches.length) {
                                        tmdbId = matches[0].id;
                                        details = await requestWithRetry(mediaType + '/' + tmdbId + '?append_to_response=external_ids,alternative_titles&country=US');
                                    }
                                }

                                // Kimlik yoksa başlık ve yıl ile İngilizce TMDB kaydını ara.
                                if (!details && !expectedImdb) {
                                    const title = String(item.title || item.originalTitle || '').trim();
                                    if (title) {
                                        const year = String(item.year || '').slice(0, 4);
                                        const searchPath = 'search/' + mediaType + '?query=' + encodeURIComponent(title) +
                                            (year && /^\d{4}$/.test(year) ? (mediaType === 'tv' ? '&first_air_date_year=' : '&year=') + year : '');
                                        const found = await requestWithRetry(searchPath);
                                        const match = (found?.results || [])[0];
                                        if (match?.id) {
                                            tmdbId = match.id;
                                            details = await requestWithRetry(mediaType + '/' + tmdbId + '?append_to_response=external_ids,alternative_titles&country=US');
                                        }
                                    }
                                }

                                if (!details) continue;
                                const localizedEnglish = String(details.title || details.name || '').trim();
                                const originalEnglish = details.original_language === 'en'
                                    ? String(details.original_title || details.original_name || '').trim()
                                    : '';
                                const alternatives = details.alternative_titles?.titles || details.alternative_titles?.results || [];
                                const englishAlternative = alternatives.find(entry =>
                                    ['US', 'GB', 'CA', 'AU'].includes(String(entry?.iso_3166_1 || '').toUpperCase()) &&
                                    String(entry?.title || entry?.name || '').trim()
                                );
                                const candidates = [localizedEnglish, englishAlternative?.title || englishAlternative?.name, originalEnglish];
                                const english = candidates.find(value => value && normalize(value) && normalize(value) !== normalize(item.title));
                                if (english) {
                                    item.englishTitle = String(english).trim();
                                    item.tmdbEnglishTitle = item.englishTitle;
                                    if (tmdbId && !item.tmdbId) item.tmdbId = tmdbId;
                                }
                            } catch (error) {
                                delete this.heroEnglishTitleRequests[item.id];
                                console.warn('İngilizce manşet adı alınamadı; sonraki yüklemede yeniden denenecek:', item.title, error);
                            }
                        }
                    };
                    // Mobilde arka plan TMDB trafiğini azalt; masaüstü paralelliğini koru.
                    const workerCount = window.matchMedia('(max-width: 767px)').matches ? 1 : 3;
                    await Promise.all(Array.from({ length: Math.min(workerCount, slides.length) }, worker));
                },

                async fetchTmdb(path, language = this.tmdbLanguage) {
                    const separator = path.includes('?') ? '&' : '?';
                    const response = await fetch('https://api.themoviedb.org/3/' + path + separator + 'api_key=' + this.tmdbApiKey + '&language=' + language);
                    if (!response.ok) throw new Error('TMDB isteği başarısız (HTTP ' + response.status + ')');
                    return response.json();
                },

                async loadSeasonEpisodes(seasonNumber, targetItem = this.selectedItem) {
                    const season = Number(seasonNumber);
                    if (!targetItem || targetItem.type !== 'tv' || !targetItem.tmdbId || !Number.isInteger(season) || season < 1) return;
                    if (!targetItem.tmdbEpisodesBySeason || typeof targetItem.tmdbEpisodesBySeason !== 'object') {
                        targetItem.tmdbEpisodesBySeason = {};
                    }
                    if (Object.prototype.hasOwnProperty.call(targetItem.tmdbEpisodesBySeason, season)) return;

                    const requestKey = String(targetItem.id) + ':' + season;
                    if (this.tmdbSeasonRequests[requestKey]) return this.tmdbSeasonRequests[requestKey];

                    this.tmdbSeasonLoading = true;
                    const request = (async () => {
                        try {
                            const seasonDetails = await this.fetchTmdb('tv/' + targetItem.tmdbId + '/season/' + season);
                            const episodes = (seasonDetails.episodes || []).map(episode => ({
                                number: episode.episode_number,
                                title: episode.name || ('Bölüm ' + episode.episode_number),
                                desc: episode.overview || 'Bu bölüm için açıklama bulunmuyor.',
                                duration: episode.runtime ? episode.runtime + ' dk' : '',
                                still: episode.still_path
                                    ? 'https://image.tmdb.org/t/p/w500' + episode.still_path
                                    : (targetItem.poster || '')
                            }));
                            targetItem.tmdbEpisodesBySeason[season] = episodes;
                            if (this.selectedItem?.id === targetItem.id) {
                                this.selectedItem.tmdbEpisodesBySeason = targetItem.tmdbEpisodesBySeason;
                            }
                        } catch (error) {
                            console.warn('TMDB sezon verisi alınamadı:', season, error);
                            targetItem.tmdbEpisodesBySeason[season] = [];
                        } finally {
                            delete this.tmdbSeasonRequests[requestKey];
                            this.tmdbSeasonLoading = Object.keys(this.tmdbSeasonRequests).length > 0;
                        }
                    })();
                    this.tmdbSeasonRequests[requestKey] = request;
                    return request;
                },

                async fetchTmdbDetails(item) {
                    if (!item || !item.tmdbId) return;
                    const cacheKey = item.type + ':' + item.tmdbId;
                    if (this.tmdbDetailsCache[cacheKey]) {
                        Object.assign(item, this.tmdbDetailsCache[cacheKey]);
                        if (item.type === 'tv') await this.loadSeasonEpisodes(this.selectedSeason || 1, item);
                        return;
                    }

                    this.tmdbDetailsLoading = true;
                    this.tmdbDetailsError = '';
                    try {
                        const mediaType = item.type === 'tv' ? 'tv' : 'movie';
                        const details = await this.fetchTmdb(mediaType + '/' + item.tmdbId + '?append_to_response=credits,videos');
                        const englishDetails = await this.fetchTmdb(mediaType + '/' + item.tmdbId, 'en-US').catch(() => null);
                        const realSeasons = mediaType === 'tv'
                            ? (Array.isArray(details.seasons) ? details.seasons.filter(season => Number(season.season_number) > 0) : [])
                            : [];
                        const credits = details.credits || {};
                        const cast = (credits.cast || []).map((person, index) => ({
                            id: person.id,
                            name: person.name || '',
                            character: person.character || '',
                            profile: person.profile_path ? 'https://image.tmdb.org/t/p/w185' + person.profile_path : '',
                            order: person.order ?? index
                        }));
                        const crew = credits.crew || [];
                        const directorPerson = crew.find(person => person.job === 'Director') || (mediaType === 'tv' ? crew.find(person => person.job === 'Executive Producer') : null);
                        const director = directorPerson?.name || item.director || '';
                        const directorPersonId = directorPerson?.id || item.directorPersonId || null;
                        const videos = details.videos?.results || [];
                        const trailer = videos.find(video => video.site === 'YouTube' && video.type === 'Trailer');
                        const poster = details.poster_path ? 'https://image.tmdb.org/t/p/w500' + details.poster_path : item.poster;
                        const backdrop = details.backdrop_path ? 'https://image.tmdb.org/t/p/w1280' + details.backdrop_path : item.backdrop;
                        const genres = (details.genres || []).map(genre => genre.name).join(' / ');
                        const enriched = {
                            poster,
                            image: poster,
                            backdrop,
                            desc: details.overview || item.desc,
                            tmdbOverview: details.overview || item.tmdbOverview,
                            rating: String(details.vote_average ?? item.rating),
                            tmdbRating: String(details.vote_average ?? item.tmdbRating),
                            year: String((details.release_date || details.first_air_date || item.year || '')).slice(0, 4),
                            duration: mediaType === 'movie'
                                ? (details.runtime ? details.runtime + ' dk' : item.duration)
                                : (details.episode_run_time?.[0] ? details.episode_run_time[0] + ' dk / bölüm' : item.duration),
                            genre: genres || item.genre,
                            category: genres || item.category,
                            country: (details.production_countries || details.origin_country || []).map(country => typeof country === 'string' ? country : country.name).join(', ') || item.country,
                            director,
                            directorPersonId,
                            originalTitle: details.original_title || details.original_name || item.originalTitle,
                            englishTitle: englishDetails?.title || englishDetails?.name || item.englishTitle || '',
                            tmdbCast: cast.length ? cast : (item.tmdbCast || []),
                            starring: cast.slice(0, 3).map(person => person.name).filter(Boolean).join(' / ') || item.starring,
                            trailerUrl: trailer ? 'https://www.youtube.com/watch?v=' + trailer.key : item.trailerUrl,
                            seasons: mediaType === 'tv' ? realSeasons.length : item.seasons,
                            episodes: mediaType === 'tv' ? realSeasons.reduce((sum, season) => sum + Number(season.episode_count || 0), 0) : item.episodes,
                            tmdbEpisodesBySeason: item.tmdbEpisodesBySeason || {},
                            tmdbDetailsLoaded: true
                        };
                        this.tmdbDetailsCache[cacheKey] = enriched;
                        Object.assign(item, enriched);
                        if (this.selectedItem?.id === item.id) Object.assign(this.selectedItem, enriched);
                        if (mediaType === 'tv') await this.loadSeasonEpisodes(this.selectedSeason || 1, item);
                    } catch (error) {
                        this.tmdbDetailsError = error.message || 'TMDB verileri alınamadı.';
                        console.error('TMDB veri eşitleme hatası:', error);
                    } finally {
                        this.tmdbDetailsLoading = false;
                    }
                },

                normalizeCatalogItem(item) {
                    const cast = Array.isArray(item.tmdbCast) && item.tmdbCast.length
                        ? item.tmdbCast
                        : (Array.isArray(item.cast) ? item.cast.map((person, index) => ({
                            name: typeof person === 'string' ? person : (person && typeof person === 'object' ? (person.name || '') : ''),
                            character: typeof person === 'string' || !person || typeof person !== 'object' ? '' : (person.character || ''),
                            profile: typeof person === 'string' || !person || typeof person !== 'object' ? '' : (person.profile || ''),
                            order: index
                        })) : []);
                    const genreText = item.genre || item.tmdbGenres || item.category || '';
                    return {
                        ...item,
                        id: item.id || item.tmdbId || item.title,
                        title: item.title || item.tmdbTitle || item.originalTitle || 'İsimsiz yapım',
                        type: item.type === 'tv' || item.type === 'series' ? 'tv' : 'movie',
                        category: item.category || item.tmdbGenres || genreText,
                        genre: String(genreText).split('/')[0].trim(),
                        rating: String(item.rating ?? item.tmdbRating ?? '0'),
                        year: String(item.year || item.tmdbReleaseDate || '').slice(0, 4),
                        duration: item.duration || item.tmdbRuntime || '',
                        country: item.country || item.tmdbCountries || '',
                        countryFlag: item.countryFlag || '',
                        poster: item.poster || item.tmdbPoster || item.image || '',
                        backdrop: item.backdrop || item.tmdbBackdrop || item.tmdbPoster || item.image || '',
                        starring: item.starring || cast.slice(0, 3).map(person => person.name).filter(Boolean).join(' / '),
                        desc: item.desc || item.tmdbOverview || '',
                        director: item.director || item.tmdbDirector || '',
                        originalTitle: item.originalTitle || item.tmdbOriginalTitle || item.title || '',
                        tmdbCast: cast,
                        trailerUrl: item.trailerUrl || item.tmdbTrailerUrl || '',
                        seasons: item.seasons ?? item.tmdbSeasons ?? null,
                        episodes: item.episodes ?? item.tmdbEpisodes ?? null
                    };
                },

                async loadCatalogCastData() {
                    if (window.__cvCatalogCastPromise) return window.__cvCatalogCastPromise;
                    window.__cvCatalogCastPromise = (async () => {
                        const response = await fetch('./catalog-cast.json', { cache: 'default' });
                        if (!response.ok) throw new Error('Oyuncu verileri yüklenemedi: HTTP ' + response.status);
                        const castById = await response.json();
                        const entries = Object.entries(castById || {});
                        const byId = new Map((this.catalog || []).map(item => [String(item.id), item]));
                        let cursor = 0;
                        return await new Promise(resolve => {
                            const applyBatch = deadline => {
                                let processed = 0;
                                while (cursor < entries.length && (processed < 8 || (deadline && deadline.timeRemaining() > 3))) {
                                    const [id, cast] = entries[cursor++];
                                    const item = byId.get(String(id));
                                    if (item && Array.isArray(cast)) item.tmdbCast = cast;
                                    processed++;
                                }
                                if (cursor < entries.length) {
                                    if ('requestIdleCallback' in window) window.requestIdleCallback(applyBatch, { timeout: 1200 });
                                    else window.setTimeout(() => applyBatch(null), 40);
                                    return;
                                }
                                const selectedId = this.selectedItem?.id;
                                const selectedCatalogItem = selectedId != null ? byId.get(String(selectedId)) : null;
                                if (selectedCatalogItem) {
                                    // Salt-okunur katalogdaki oyuncu verisi seçili detay ekranına da yansısın.
                                    this.selectedItem = { ...this.selectedItem, tmdbCast: selectedCatalogItem.tmdbCast };
                                }
                                personalizedRecommendationCache.delete(this);
                                resolve(entries.length);
                            };
                            if ('requestIdleCallback' in window) window.requestIdleCallback(applyBatch, { timeout: 1200 });
                            else window.setTimeout(() => applyBatch(null), 0);
                        });
                    })().catch(error => {
                        window.__cvCatalogCastPromise = null;
                        console.warn('Oyuncu verileri arka planda yüklenemedi:', error);
                        return 0;
                    });
                    return window.__cvCatalogCastPromise;
                },

                async init() {
                    this.routeHistoryReady = false;
                    this.initDeferredChrome();
                    const heroViewportQuery = window.matchMedia('(max-width: 767px)');
                    const hydrateActiveHeroOnResize = () => {
                        const root = document.getElementById('home-page');
                        if (root && !root.hasAttribute('x-ignore')) this.prepareHomeHeroVariant(root);
                        const personalized = document.getElementById('home-personalized-section');
                        if (personalized && !personalized.hasAttribute('x-ignore')) this.prepareHomePersonalizedVariant(personalized);
                    };
                    if (heroViewportQuery.addEventListener) heroViewportQuery.addEventListener('change', hydrateActiveHeroOnResize);
                    else if (heroViewportQuery.addListener) heroViewportQuery.addListener(hydrateActiveHeroOnResize);
                    window.addEventListener('popstate', event => {
                        this.routeHistoryIndex = Number(event.state?.cineverseRouteIndex || 0);
                        this.restoreRouteFromUrl();
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    });
                    this.$watch('currentPage', page => {
                        if (page === 'home') this.$nextTick(() => {
                            // x-if anasayfayı yeniden oluşturur; rafları yeniden sırala ve görünürlüklerini tembel yüklemeye hazırla.
                            Object.keys(this.homeSectionReady).forEach(key => { this.homeSectionReady[key] = false; });
                            this.homeSectionLoading.personalized = true;
                            this.applyHomepageSectionOrder();
                            this.scheduleHomePageHydration();
                            this.initHomeSectionObserver();
                        });
                    });
                    // Manşet ayrı bootstrap verisiyle çizilir; ana katalog isteğini bekletmeden başlat.
                    // Düşük öncelik, ilk manşet görsellerinin ağ önceliğini korurken indirmeyi erkenden başlatır.
                    const catalogRequest = window.__CV_CATALOG_PROMISE__ || fetch('./catalog-lite.json?v=20261117-franchise-data-v1', { cache: 'default' });
                    try {
                        // Üretim sırasında HTML'e gömülen küçük manşet verisi ağ isteği beklemeden hazırdır.
                        // Yerel geliştirme/önbellek senaryolarında gömülü veri yoksa JSON dosyasına geri dön.
                        let heroData = window.__CV_HERO_BOOTSTRAP__ || null;
                        if (!heroData) {
                            const heroResponse = await fetch('./hero-data.json', { cache: 'default' });
                            if (heroResponse.ok) heroData = await heroResponse.json();
                        }
                        const heroSource = Array.isArray(heroData?.catalog) ? heroData.catalog : [];
                        if (heroSource.length) {
                            this.homepageConfig = heroData.homepageConfig || this.homepageConfig;
                            this.heroCatalog = heroSource.map(item => this.normalizeCatalogItem(item));
                            this.currentSlideIndex = 0;
                            this.startHeroAutoplay();
                            this.$nextTick(() => {
                                this.removeHeroInitialShell();
                            });
                        }
                    } catch (heroError) {
                        console.warn('Hızlı manşet verisi yüklenemedi; ana katalog kullanılacak:', heroError);
                    }
                    if (this.currentPage === 'home') this.scheduleHomePageHydration();
                    try {
                        const response = await catalogRequest;
                        if (!response.ok) {
                            throw new Error('Katalog dosyası yüklenemedi (HTTP ' + response.status + ')');
                        }

                        const data = await response.json();
                        this.homepageConfig = data && typeof data === 'object' ? (data.homepageConfig || null) : null;
                        this.headerConfig = { ...this.headerConfig, ...(data?.headerConfig || {}) };
                        this.headerConfigReady = true;
                        if (!this.headerConfig.catalogMenusInitialized) {
                            const requiredCatalogMenus = [{label:'Filmler',page:'movies'},{label:'Diziler',page:'series'},{label:'Yerli Yapımlar',page:'turkish'}];
                            const links = Array.isArray(this.headerConfig.customLinks) ? this.headerConfig.customLinks : [];
                            requiredCatalogMenus.forEach(link => { if (!links.some(existing => existing.page === link.page)) links.push(link); });
                            this.headerConfig.customLinks = links;
                            this.headerConfig.catalogMenusInitialized = true;
                        }
                        this.footerConfig = { ...this.footerConfig, ...(data?.footerConfig || {}) };
                        this.collections = Array.isArray(data?.collections) ? data.collections : [];
                        this.franchises = Array.isArray(data?.franchises) ? data.franchises : [];
                        this.watchPageConfig = data && typeof data === 'object' ? (data.watchPageConfig || null) : null;
                        const sourceCatalog = Array.isArray(data) ? data : (data && typeof data === 'object' ? data.catalog : null);

                        if (!Array.isArray(sourceCatalog)) {
                            throw new Error('JSON dosyasında geçerli bir catalog listesi bulunamadı.');
                        }

                        // Kayıtları tek geçişte doğrula ve dönüştür; ara filtre dizisi oluşturma.
                        const normalizedCatalog = [];
                        let invalidCatalogCount = 0;
                        for (const item of sourceCatalog) {
                            if (!item || typeof item !== 'object' || Array.isArray(item) || !(item.id != null || item.tmdbId != null || item.title || item.tmdbTitle || item.originalTitle)) {
                                invalidCatalogCount++;
                                continue;
                            }
                            normalizedCatalog.push(this.normalizeCatalogItem(item));
                        }
                        if (!normalizedCatalog.length) throw new Error('Katalogda kullanılabilir bir film veya dizi kaydı bulunamadı.');
                        if (invalidCatalogCount) console.warn('Geçersiz katalog kayıtları atlandı:', invalidCatalogCount);
                        this.catalog = markStaticCatalog(normalizedCatalog);
                        this.heroCatalog = this.catalog;
                        // İngilizce alternatif başlıklar kritik değil; mobilde manşet açılışından sonra yükle.
                        const loadEnglishTitlesWhenIdle = () => this.loadHeroEnglishTitles();
                        const mobileDevice = window.matchMedia('(max-width: 767px)').matches;
                        const scheduleEnglishTitles = () => {
                            if ('requestIdleCallback' in window) {
                                window.requestIdleCallback(loadEnglishTitlesWhenIdle, { timeout: mobileDevice ? 2500 : 1800 });
                            } else {
                                window.setTimeout(loadEnglishTitlesWhenIdle, mobileDevice ? 500 : 900);
                            }
                        };
                        const tvDevice = document.documentElement.classList.contains('cv-tv-mode');
                        if (mobileDevice) window.setTimeout(scheduleEnglishTitles, 5000);
                        else if (!tvDevice) scheduleEnglishTitles();

                        this.currentSlideIndex = 0;
                        this.startHeroAutoplay();
                        this.restoreRouteFromUrl();
                        this.routeHistoryReady = true;
                    } catch (error) {
                        this.catalogError = error.message || 'Bilinmeyen katalog hatası';
                        this.headerConfigReady = true;
                        console.error('Perde katalog yükleme hatası:', error);
                    } finally {
                        // Bölüm sırasını katalog verileri DOM'a işlenmeden belirle;
                        // Alpine'ın bekleyen x-for güncellemeleri doğru sıraya yerleşsin ve CLS oluşmasın.
                        this.applyHomepageSectionOrder();
                        this.homeSectionReady.catalog = true;
                        this.catalogLoading = false;
                        // Footer ayarı katalogdan doğrulanana ve ilk ana sayfa yerleşimi oturana kadar görünmesin.
                        window.setTimeout(() => { this.footerConfigReady = true; }, 1200);
                        this.$nextTick(() => {
                            if (this.currentPage !== 'home') this.removeHeroInitialShell();
                            this.initHomeSectionObserver();
                        });
                        // 300 KB'lık kadro verisini ilk açılışın kritik yolundan çıkar.
                        // Oyuncu araması daha erken yapılırsa schedulePersonSearch yüklemeyi hemen başlatır.
                        // TV arayüzünde kadro/kişi keşfi kullanılmadığından 290 KB'lık ek veriyi hiç indirme.
                        if (!document.documentElement.classList.contains('cv-tv-mode')) {
                            const castDelay = window.matchMedia('(max-width: 767px)').matches ? 12000 : 6000;
                            window.setTimeout(() => {
                                const scheduleCastLoad = () => this.loadCatalogCastData();
                                if ('requestIdleCallback' in window) window.requestIdleCallback(scheduleCastLoad, { timeout: 5000 });
                                else window.setTimeout(scheduleCastLoad, 500);
                            }, castDelay);
                        }
                    }
                },

                isHomepageSectionVisible(sectionKey) {
                    if (sectionKey === 'hero') return true;
                    if (document.documentElement.classList.contains('cv-tv-mode') && sectionKey === 'personalized') return false;
                    // Yapılandırma gelene kadar varsayılan olarak görünür tut;
                    // veri geldikten sonra kapalı bölümler normal şekilde gizlenir.
                    return this.homepageConfig?.layout?.visibility?.[sectionKey] !== false;
                },

                removeHeroInitialShell() {
                    document.getElementById('hero-initial-shell')?.remove();
                    document.getElementById('hero-initial-shell-desktop')?.remove();
                },

                onHomePageReady() {
                    this.$nextTick(() => this.removeHeroInitialShell());
                },

                hydrateDeferredElement(element) {
                    if (!element || !element.hasAttribute('x-ignore')) return;
                    element.removeAttribute('x-ignore');
                    element._x_ignore = false;
                    window.Alpine?.initTree?.(element);
                },

                initDeferredChrome() {
                    const header = document.querySelector('body > header');
                    if (header?.hasAttribute('x-ignore')) {
                        const hydrateHeader = () => this.hydrateDeferredElement(header);
                        if ('requestAnimationFrame' in window) {
                            window.requestAnimationFrame(() => window.requestAnimationFrame(hydrateHeader));
                        } else {
                            window.setTimeout(hydrateHeader, 50);
                        }
                    }
                    const footer = document.getElementById('cineverse-footer');
                    if (footer?.hasAttribute('x-ignore')) {
                        // Footer zaten ilk 1,2 saniye kapalı; Alpine taramasını da bu sürenin dışına al.
                        window.setTimeout(() => this.hydrateDeferredElement(footer), 1300);
                    }
                },

                prepareHomePersonalizedVariant(section) {
                    if (!section) return;
                    const mobile = window.matchMedia('(max-width: 767px)').matches;
                    const targets = [
                        { element: section.querySelector('.home-personalized-feature'), active: !mobile },
                        { element: section.querySelector('#home-personalized-rail'), active: !mobile },
                        { element: section.querySelector('.home-personalized-mobile-card'), active: mobile }
                    ];
                    targets.forEach(({ element, active }) => {
                        if (!element) return;
                        if (active && element.hasAttribute('x-ignore')) {
                            element.removeAttribute('x-ignore');
                            element._x_ignore = false;
                            window.Alpine?.initTree?.(element);
                        }
                    });
                },

                prepareHomeHeroVariant(root) {
                    if (!root) return;
                    const mobile = window.matchMedia('(max-width: 767px)').matches;
                    const activeHero = root.querySelector(mobile ? '#mobileHeroBanner' : '#desktopEditorialHero');
                    const inactiveHero = root.querySelector(mobile ? '#desktopEditorialHero' : '#mobileHeroBanner');
                    // Görünmeyen cihaz varyantını ilk Alpine taramasının dışında tut.
                    if (inactiveHero && inactiveHero.dataset.cvHeroHydrated !== 'true' && !inactiveHero.hasAttribute('x-ignore')) {
                        inactiveHero.setAttribute('x-ignore', '');
                    }
                    if (activeHero?.hasAttribute('x-ignore')) {
                        activeHero.removeAttribute('x-ignore');
                        activeHero._x_ignore = false;
                        if (!root.hasAttribute('x-ignore')) {
                            window.Alpine?.initTree?.(activeHero);
                            activeHero.dataset.cvHeroHydrated = 'true';
                        }
                    }
                },

                scheduleHomePageHydration() {
                    if (this.currentPage !== 'home') return;
                    this.$nextTick(() => {
                        const root = document.getElementById('home-page');
                        if (!root) {
                            window.setTimeout(() => this.scheduleHomePageHydration(), 50);
                            return;
                        }
                        this.prepareHomeHeroVariant(root);
                        if (!root.hasAttribute('x-ignore') || root.dataset.homeHydrationScheduled === 'true') return;
                        root.dataset.homeHydrationScheduled = 'true';
                        const delay = window.matchMedia('(min-width: 1024px)').matches ? 450 : 0;
                        window.setTimeout(() => {
                            const currentRoot = document.getElementById('home-page');
                            if (!currentRoot || !currentRoot.hasAttribute('x-ignore')) return;
                            currentRoot.removeAttribute('x-ignore');
                            currentRoot._x_ignore = false;
                            window.Alpine?.initTree?.(currentRoot);
                            const mobile = window.matchMedia('(max-width: 767px)').matches;
                            const activeHero = currentRoot.querySelector(mobile ? '#mobileHeroBanner' : '#desktopEditorialHero');
                            if (activeHero) activeHero.dataset.cvHeroHydrated = 'true';
                            this.$nextTick(() => this.initHomeSectionObserver());
                        }, delay);
                    });
                },

                applyHomepageSectionOrder() {
                    const root = document.getElementById('home-page');
                    if (!root) return;
                    const defaultOrder = ['hero', 'personalized', 'continue', 'watchlist', 'watched', 'favorites', 'new-arrivals', 'series-tracking', 'genre-discovery', 'franchises', 'published-collections', 'catalog'];
                    const configured = this.homepageConfig?.layout?.order;
                    const order = Array.isArray(configured) ? [...configured, ...defaultOrder.filter(key => !configured.includes(key))] : defaultOrder;
                    const contentIds = {
                        continue: 'home-continue-section',
                        watchlist: 'home-watchlist-section',
                        'new-arrivals': 'home-new-arrivals-section'
                    };
                    const children = [...root.children];
                    const groups = new Map();
                    children.forEach(element => {
                        const key = element.dataset.homeSection;
                        if (!key) return;
                        if (!groups.has(key)) groups.set(key, []);
                        groups.get(key).push(element);
                    });
                    Object.entries(contentIds).forEach(([key, id]) => {
                        const content = document.getElementById(id);
                        if (content && content.parentElement === root) {
                            if (!groups.has(key)) groups.set(key, []);
                            groups.get(key).push(content);
                        }
                    });
                    const ordered = [];
                    const placed = new Set();
                    order.forEach(key => {
                        const group = groups.get(key) || [];
                        group.forEach(element => {
                            if (!placed.has(element)) {
                                ordered.push(element);
                                placed.add(element);
                            }
                        });
                    });
                    children.forEach(element => {
                        if (!placed.has(element)) ordered.push(element);
                    });
                    // Sıra zaten doğruysa DOM'a dokunma; değişiklik gerekiyorsa tek fragment eklemesiyle uygula.
                    const orderChanged = ordered.length !== children.length || ordered.some((element, index) => element !== children[index]);
                    if (orderChanged) {
                        const fragment = document.createDocumentFragment();
                        ordered.forEach(element => fragment.appendChild(element));
                        root.appendChild(fragment);
                    }
                    const labels = this.homepageConfig?.layout?.labels || {};
                    Object.entries(labels).forEach(([key, values]) => {
                        if (!values || typeof values !== 'object') return;
                        const section = root.querySelector('[data-home-section="'+key+'"]');
                        if (!section) return;
                        const heading = section.querySelector('h2');
                        const title = typeof values.title === 'string' ? values.title.trim() : '';
                        if (heading && title && heading.textContent !== title) heading.textContent = title;
                        const subtitle = heading?.nextElementSibling;
                        const description = typeof values.description === 'string' ? values.description.trim() : '';
                        if (subtitle?.tagName === 'P' && subtitle.textContent !== description && typeof values.description === 'string') subtitle.textContent = description;
                    });
                },

                initHomeSectionObserver() {
                    const root = document.getElementById('home-page');
                    if (!root || this.catalogLoading) return;
                    window.__cineverseHomeSectionObserver?.disconnect();

                    const sections = [...root.children].filter(element =>
                        element.hasAttribute('data-home-section') &&
                        element.dataset.homeSection !== 'hero' &&
                        !(document.documentElement.classList.contains('cv-tv-mode') && element.dataset.homeSection === 'personalized') &&
                        element.hasAttribute('x-ignore')
                    );

                    const hydrateSection = section => {
                        const key = section.dataset.homeSection;
                        if (!key) return;
                        if (key !== 'personalized') this.homeSectionReady[key] = true;
                        if (section.hasAttribute('x-ignore')) {
                            section.removeAttribute('x-ignore');
                            // Alpine x-ignore ilk taramada _x_ignore bayrağı bırakır;
                            // niteliği DOM'dan silmek tek başına initTree çağrısını açmaz.
                            section._x_ignore = false;
                            window.Alpine?.initTree?.(section);
                        }
                        if (key === 'personalized') {
                            const activate = () => {
                                if (!section.isConnected || this.currentPage !== 'home') return;
                                // Öneri puanlaması tamamlanınca tüm alanı tek seferde aç.
                                this.displayedPersonalizedRecommendations;
                                this.homeSectionReady.personalized = true;
                                this.$nextTick(() => {
                                    this.prepareHomePersonalizedVariant(section);
                                    this.homeSectionLoading.personalized = false;
                                    if (section.isConnected && this.currentPage === 'home') {
                                        section.style.removeProperty('visibility');
                                    }
                                });
                            };
                            if (window.matchMedia('(max-width: 767px)').matches) {
                                // Mobilde öneri puanlamasını ilk çizimden sonraya al.
                                window.setTimeout(() => {
                                    if ('requestIdleCallback' in window) window.requestIdleCallback(activate, { timeout: 2200 });
                                    else window.setTimeout(activate, 0);
                                }, 1400);
                            } else {
                                activate();
                            }
                        }
                        window.requestAnimationFrame(() => {
                            section.style.removeProperty('visibility');
                        });
                    };

                    // Yönetici tarafından kapatılan rafları hemen işle; görünür rafları ekrana yaklaşınca başlat.
                    sections.forEach(section => {
                        const key = section.dataset.homeSection;
                        section.removeAttribute('x-cloak');
                        if (!this.isHomepageSectionVisible(key)) {
                            hydrateSection(section);
                            return;
                        }
                        section.style.visibility = 'hidden';
                    });

                    const pending = sections.filter(section =>
                        section.hasAttribute('x-ignore') &&
                        this.isHomepageSectionVisible(section.dataset.homeSection)
                    );

                    if (!pending.length) return;
                    if (!('IntersectionObserver' in window)) {
                        pending.forEach(hydrateSection);
                        return;
                    }

                    const mobileObserver = window.matchMedia('(max-width: 767px)').matches;
                    const tvObserver = document.documentElement.classList.contains('cv-tv-mode');
                    const observer = new IntersectionObserver(entries => {
                        entries.forEach(entry => {
                            if (!entry.isIntersecting) return;
                            // Mobilde ağır öneri rafı ve Son Eklenenler, görünür alanın anlamlı kısmına gelmeden başlatılmasın.
                            const sectionKey = entry.target.dataset.homeSection;
                            if (mobileObserver && ['personalized', 'new-arrivals'].includes(sectionKey) && entry.intersectionRatio < 0.5) return;
                            hydrateSection(entry.target);
                            observer.unobserve(entry.target);
                        });
                    }, { rootMargin: tvObserver ? '72px 0px' : (mobileObserver ? '100px 0px' : '180px 0px'), threshold: [0, 0.5] });

                    pending.forEach(section => observer.observe(section));
                    window.__cineverseHomeSectionObserver = observer;
                },

                get heroSlides() {
                    const mobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
                    const sourceCatalog = this.heroCatalog.length ? this.heroCatalog : this.catalog;
                    const device = mobile ? 'mobile' : 'desktop';
                    const personalMode = this.homepageConfig?.[device + 'Mode'] || 'manual';
                    const personalCategory = this.homepageConfig?.[device + 'Category'] || '';
                    if (personalMode === 'auto' && ['user-watchlist','user-watched','user-favorites'].includes(personalCategory)) {
                        const personalItems = this.getPersonalStatusItems(personalCategory).filter(item => item && (item.backdrop || item.poster || item.image || item.tmdbPoster));
                        const personalCount = Number(this.homepageConfig?.settings?.[mobile ? 'mobileCount' : 'desktopCount']) || (mobile ? 6 : 10);
                        // Kişisel kaynak boşsa genel katalog/manşet seçimine düşme.
                        return personalItems.slice(0, Math.max(1, personalCount));
                    }
                    if (personalMode === 'auto' && personalCategory === 'new-arrivals') {
                        const newestCount = Number(this.homepageConfig?.settings?.[mobile ? 'mobileCount' : 'desktopCount']) || (mobile ? 6 : 10);
                        return this.catalog.slice(-Math.max(1, newestCount)).reverse()
                            .filter(item => item && (item.backdrop || item.poster || item.image || item.tmdbPoster));
                    }
                    const configured = this.homepageConfig?.[mobile ? 'mobileHeroSlides' : 'desktopHeroSlides'] || this.homepageConfig?.heroSlides;
                    if (!Array.isArray(configured) || !configured.length) return sourceCatalog;
                    const byId = new Map(sourceCatalog.map(item => [String(item.id), item]));
                    const selected = configured.filter(entry => entry && entry.active !== false)
                        .map(entry => byId.get(String(entry.id))).filter(Boolean);
                    if (!selected.length) return sourceCatalog;
                    if (!mobile) {
                        const configuredCount = Number(this.homepageConfig?.settings?.desktopCount);
                        const count = Math.max(5, Math.min(15, configuredCount || 10));
                        return selected.slice(0, count);
                    }
                    return selected;
                },

                get publishedCollections() {
                    const byId = new Map(this.catalog.map(item => [String(item.id), item]));
                    return (Array.isArray(this.collections) ? this.collections : [])
                        .filter(collection => collection && collection.active !== false && String(collection.title || '').trim())
                        .map(collection => ({
                            ...collection,
                            items: (Array.isArray(collection.items) ? collection.items : [])
                                .map(id => byId.get(String(id)))
                                .filter(item => item && (item.poster || item.image || item.backdrop))
                        }))
                        .filter(collection => collection.items.length > 0);
                },

                get heroThumbSlides() {
                    const settings = this.homepageConfig?.settings || {};
                    const mobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
                    const configuredCount = Number(mobile ? settings.mobileCount : settings.desktopCount);
                    const count = Math.max(1, Math.min(mobile ? 12 : 20, configuredCount || (mobile ? 6 : 10)));
                    return this.heroSlides.slice(0, count);
                },

                startHeroAutoplay() {
                    if (this.heroAutoplayTimer) {
                        window.clearTimeout(this.heroAutoplayTimer);
                        window.clearInterval(this.heroAutoplayTimer);
                    }
                    const settings = this.homepageConfig?.settings || {};
                    if (document.documentElement.classList.contains('cv-tv-mode') || settings.autoplay === false || this.heroSlides.length < 2) return;
                    const seconds = Math.max(2, Math.min(60, Number(settings.interval) || 6));
                    const isMobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
                    const advance = () => {
                        if (this.heroPaused || document.hidden || this.heroSlides.length < 2) return;
                        this.currentSlideIndex = (this.currentSlideIndex + 1) % this.heroSlides.length;
                    };
                    // Mobilde ilk manşet görseli tam yüklenip LCP ölçümü tamamlanmadan değişmesin.
                    const initialDelay = isMobile ? Math.max(seconds * 1000, 15000) : seconds * 1000;
                    this.heroAutoplayTimer = window.setTimeout(() => {
                        advance();
                        this.heroAutoplayTimer = window.setInterval(advance, seconds * 1000);
                    }, initialDelay);
                },

                setHeroPaused(value) {
                    this.heroPaused = !!value;
                },

                get currentHero() {
                    const active = this.heroSlides[this.currentSlideIndex] || this.heroSlides[0];
                    if (active) return active;
                    const mobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
                    return mobile ? {
                        id: 'archive-26',
                        title: 'Teach You a Lesson',
                        type: 'tv',
                        backdrop: 'https://image.tmdb.org/t/p/w1280/vyG93jhmPL7tBIhRtCLa5mdBKob.jpg',
                        poster: 'https://image.tmdb.org/t/p/w500/44iAuz8HkEDCOxjBmF4oogaXjnI.jpg',
                        rating: '9.4',
                        year: '2026',
                        genre: 'Aksiyon & Macera',
                        starring: '',
                        desc: 'Okullarda otoriteye saygı yerle bir olduğunda işleri yoluna koymak için gelen sıra dışı müfettişler, ders kitaplarında bulunmayan katı ve ciddi dersler vermeye başlar.'
                    } : {
                        id: 'archive-112',
                        title: 'Yıldızlararası',
                        type: 'movie',
                        backdrop: 'https://image.tmdb.org/t/p/w1280/8sNiAPPYU14PUepFNeSNGUTiHW.jpg',
                        poster: 'https://image.tmdb.org/t/p/w500/xbiycuc84TrieEWwkkuH2hoEa9S.jpg',
                        rating: '8.5',
                        year: '2014',
                        genre: 'Macera',
                        starring: 'Matthew McConaughey / Anne Hathaway / Michael Caine',
                        desc: "Dünya'nın kuraklık ve kıtlıkla yok oluşun eşiğine geldiği bir gelecekte, insanlığın hayatta kalabilmesi için yeni bir yuva bulmak şarttır."
                    };
                },

                get heroDescription() {
                    const text = String(this.currentHero?.desc || '');
                    const max = Math.max(80, Math.min(500, Number(this.homepageConfig?.settings?.descriptionLength) || 220));
                    return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
                },

                selectHeroSlide(idx) {
                    this.currentSlideIndex = idx;
                },

                navigateHeroSlide(direction, containerId = 'heroThumbContainer') {
                    if (this.heroSlides.length < 2) return;
                    this.currentSlideIndex = (this.currentSlideIndex + direction + this.heroSlides.length) % this.heroSlides.length;
                    const container = document.getElementById(containerId);
                    if (container) {
                        requestAnimationFrame(() => {
                            const activeThumb = container.querySelector('[data-hero-index="' + this.currentSlideIndex + '"]');
                            if (activeThumb) activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                        });
                    }
                },

                scrollHeroThumbs(dir, containerId = 'heroThumbContainer') {
                    const container = document.getElementById(containerId);
                    if (container) {
                        container.scrollBy({ left: dir * 220, behavior: 'smooth' });
                    }
                },
                scrollHomeCards(containerId, direction) {
                    const container = document.getElementById(containerId);
                    if (!container) return;
                    const distance = Math.max(container.clientWidth * 0.88, 240);
                    container.scrollBy({ left: direction * distance, behavior: 'smooth' });
                },

                getSeasonOptions() {
                    const count = Number(this.selectedItem?.seasons || 0);
                    return Array.from({ length: Math.max(0, count) }, (_, index) => index + 1);
                },

                getEpisodesForSeason(seasonNum) {
                    return this.selectedItem?.tmdbEpisodesBySeason?.[seasonNum] || [];
                },

                get paginatedEpisodes() {
                    const eps = this.getEpisodesForSeason(this.selectedSeason);
                    const start = (this.currentEpisodePage - 1) * 8;
                    return eps.slice(start, start + 8);
                },

                get totalEpisodePages() {
                    const eps = this.getEpisodesForSeason(this.selectedSeason);
                    return Math.ceil(eps.length / 8);
                },

                getEpisodeTracking() {
                    const all = safeStorageRead('cine_episode_tracking_v1', {});
                    if (!all || typeof all !== 'object' || Array.isArray(all)) return { watched: {}, last: null };
                    const key = String(this.selectedItem?.id || '');
                    const tracking = all[key];
                    return tracking && typeof tracking === 'object' && !Array.isArray(tracking) ? { watched: tracking.watched && typeof tracking.watched === 'object' ? tracking.watched : {}, last: tracking.last ?? null } : { watched: {}, last: null };
                },

                saveEpisodeTracking(tracking) {
                    const stored = safeStorageRead('cine_episode_tracking_v1', {});
                    const all = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
                    const key = String(this.selectedItem?.id || '');
                    if (!tracking || typeof tracking !== 'object' || Array.isArray(tracking)) return false;
                    all[key] = tracking;
                    return safeStorageWrite('cine_episode_tracking_v1', all);
                },

                isEpisodeWatched(seasonNum, epNum) {
                    const tracking = this.getEpisodeTracking();
                    return (tracking.watched?.[seasonNum] || []).includes(Number(epNum));
                },

                getWatchedEpisodeCount(seasonNum) {
                    return (this.getEpisodeTracking().watched?.[seasonNum] || []).length;
                },

                getSeasonProgress(seasonNum) {
                    const total = this.getEpisodesForSeason(seasonNum).length;
                    return total ? Math.round(this.getWatchedEpisodeCount(seasonNum) / total * 100) : 0;
                },

                getLastWatchedEpisode() {
                    return this.getEpisodeTracking().last;
                },

                toggleEpisodeWatched(epNum) {
                    const tracking = this.getEpisodeTracking();
                    if (!tracking.watched) tracking.watched = {};
                    const seasonKey = String(this.selectedSeason);
                    const watched = tracking.watched[seasonKey] || [];
                    const index = watched.indexOf(Number(epNum));
                    if (index >= 0) {
                        watched.splice(index, 1);
                        if (tracking.last?.season === Number(this.selectedSeason) && tracking.last?.episode === Number(epNum)) tracking.last = null;
                    } else {
                        watched.push(Number(epNum));
                        tracking.last = { season: Number(this.selectedSeason), episode: Number(epNum), updatedAt: Date.now() };
                    }
                    tracking.watched[seasonKey] = watched;
                    this.saveEpisodeTracking(tracking);
                },

                continueLastWatchedEpisode() {
                    const last = this.getLastWatchedEpisode();
                    if (!last) return;
                    this.selectedSeason = Number(last.season);
                    this.selectedEpisode = Number(last.episode);
                    this.currentEpisodePage = Math.floor((Number(last.episode) - 1) / 8) + 1;
                },

                goToNextEpisode() {
                    const episodes = this.getEpisodesForSeason(this.selectedSeason);
                    const next = episodes.find(ep => ep.number > this.selectedEpisode);
                    if (next) {
                        this.currentEpisodePage = Math.floor((next.number - 1) / 8) + 1;
                        this.selectEpisode(next.number);
                    } else {
                        const nextSeason = this.selectedSeason + 1;
                        const nextSeasonEpisodes = this.getEpisodesForSeason(nextSeason);
                        if (nextSeasonEpisodes.length) {
                            this.selectedSeason = nextSeason;
                            this.currentEpisodePage = 1;
                            this.selectEpisode(nextSeasonEpisodes[0].number);
                        }
                    }
                },

                getSelectedEpisodeWatchUrl() {
                    if (!this.selectedItem || this.selectedItem.type !== 'tv') return '';
                    const key = Number(this.selectedSeason) + ':' + Number(this.selectedEpisode);
                    const url = this.selectedItem.episodeWatchUrls?.[key];
                    return this.isDirectVideoUrl(url) ? url : '';
                },

                getPlaybackProgressKey() {
                    if (this.selectedItem?.type === 'tv') {
                        return String(this.selectedItem.id) + ':s' + Number(this.selectedSeason) + 'e' + Number(this.selectedEpisode);
                    }
                    return this.selectedItem?.id;
                },

                selectEpisode(epNum) {
                    this.selectedEpisode = Number(epNum);
                    this.playbackError = false;
                    this.videoEnded = false;
                    this.videoProgress = 0;
                    const video = document.getElementById('customVideoPlayer');
                    const nextUrl = this.getPlaybackUrl();
                    if (video && nextUrl) {
                        video.pause();
                        video.src = nextUrl;
                        video.load();
                        video.play().catch(() => { this.playbackError = true; });
                    }
                },
                
                isPlaying: false,
                isMuted: false,
                volumeLevel: 0.6,
                previousVolumeLevel: 0.6,
                videoBrightness: 1,
                videoProgress: 0,
                currentTimeFormatted: '00:00',
                durationFormatted: '00:00',
                videoEnded: false,
                playbackError: false,
                playbackRate: 1,
                hasPlaybackStarted: false,
                playerControlsVisible: true,
                playerControlsTimer: null,
                playerSideControlsVisible: true,
                playerSideControlsTimer: null,
                tapSeekSide: '',
                tapSeekAmount: 0,
                tapSeekX: 0,
                tapSeekY: 0,
                tapSeekTimer: null,
                lastSeekTap: null,
                lastSeekTapTimer: null,
                cinemaMode: false,
                cinemaNoticeVisible: false,
                cinemaNoticeTimer: null,
                playbackFeedback: '',
                playbackFeedbackVisible: false,
                pauseNoticeVisible: false,
                playbackFeedbackTimer: null,

                toggleCinemaMode() {
                    this.cinemaMode = !this.cinemaMode;
                    document.body.style.overflow = this.cinemaMode ? 'hidden' : '';
                    if (this.cinemaNoticeTimer) clearTimeout(this.cinemaNoticeTimer);
                    this.cinemaNoticeVisible = this.cinemaMode;
                    if (this.cinemaMode) {
                        this.playerControlsVisible = true;
                        this.showPlayerControls();
                        this.cinemaNoticeTimer = setTimeout(() => {
                            this.cinemaNoticeVisible = false;
                            this.cinemaNoticeTimer = null;
                        }, 5000);
                    }
                },

                setPlaybackRate(rate) {
                    const allowed = [0.75, 1, 1.25, 1.5, 2];
                    const next = Number(rate);
                    if (!allowed.includes(next)) return;
                    this.playbackRate = next;
                    const video = document.getElementById('customVideoPlayer');
                    if (video) video.playbackRate = next;
                },

                applyPlaybackRate() {
                    const video = document.getElementById('customVideoPlayer');
                    if (video) video.playbackRate = this.playbackRate || 1;
                },

                toggleCaptions() {
                    const tracks = document.getElementById('customVideoPlayer')?.textTracks;
                    if (!tracks?.length) return;
                    const showing = Array.from(tracks).findIndex(track => track.mode === 'showing');
                    Array.from(tracks).forEach((track, index) => { track.mode = index === (showing < 0 ? 0 : -1) ? 'showing' : 'disabled'; });
                },

                cycleAudioTrack() {
                    const tracks = document.getElementById('customVideoPlayer')?.audioTracks;
                    if (!tracks?.length) return;
                    let active = Array.from(tracks).findIndex(track => track.enabled);
                    Array.from(tracks).forEach((track, index) => { track.enabled = index === ((active + 1) % tracks.length); });
                },

                handlePlayerKeydown(event) {
                    if (this.currentPage !== 'watch' || !this.hasPlaybackStarted) return;
                    if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName || '') || event.target?.isContentEditable || event.target?.closest?.('button,a,[role="button"]')) return;
                    const key = event.key.toLowerCase();
                    if (key === 'arrowleft' || key === 'arrowright' || key === ' ' || key === 'm' || key === 'f' || key === 'c') {
                        event.preventDefault();
                        if (key === 'arrowleft') this.skipTime(-10);
                        else if (key === 'arrowright') this.skipTime(10);
                        else if (key === ' ') this.togglePlay();
                        else if (key === 'm') this.toggleMute();
                        else if (key === 'f') this.toggleFullscreen();
                        else if (key === 'c') this.toggleCinemaMode();
                        this.showPlayerControls();
                    }
                },

                schedulePlayerSideControls() {
                    this.playerSideControlsVisible = false;
                    if (this.playerSideControlsTimer) clearTimeout(this.playerSideControlsTimer);
                    this.playerSideControlsTimer = setTimeout(() => {
                        this.playerSideControlsVisible = true;
                        this.playerSideControlsTimer = null;
                    }, 3000);
                },

                revealPlayerSideControls() {
                    if (this.playerSideControlsTimer) clearTimeout(this.playerSideControlsTimer);
                    this.playerSideControlsTimer = null;
                    this.playerSideControlsVisible = true;
                },

                showPlayerControls() {
                    this.playerControlsVisible = true;
                    if (this.playerControlsTimer) clearTimeout(this.playerControlsTimer);
                    if (this.isPlaying) this.schedulePlayerControlsHide();
                },

                schedulePlayerControlsHide() {
                    if (this.playerControlsTimer) clearTimeout(this.playerControlsTimer);
                    if (!this.isPlaying) return;
                    this.playerControlsTimer = setTimeout(() => {
                        if (this.isPlaying) this.playerControlsVisible = false;
                    }, 2200);
                },

                hidePlayerControlsOnLeave() {
                    if (this.playerControlsTimer) clearTimeout(this.playerControlsTimer);
                    this.playerControlsVisible = !this.isPlaying;
                },

                isDirectVideoUrl(url) {
                    return typeof url === 'string' && /\.mp4(?:$|[?#])/i.test(url);
                },

                getPlaybackUrl() {
                    const episodeUrl = this.getSelectedEpisodeWatchUrl();
                    if (episodeUrl) return episodeUrl;
                    return this.selectedItem && this.isDirectVideoUrl(this.selectedItem.watchUrl)
                        ? this.selectedItem.watchUrl
                        : '';
                },

                startPlayback() {
                    const video = document.getElementById('customVideoPlayer');
                    const source = this.getPlaybackUrl();
                    this.playerControlsVisible = true;
                    if (!video || !source || !this.isDirectVideoUrl(source)) {
                        this.playbackError = true;
                        return;
                    }
                    this.playbackError = false;
                    // Alpine x-if/x-show geçişlerinde src henüz video elementine
                    // uygulanmamış olabilir; oynatmadan önce kaynağı kesinleştir.
                    if (video.getAttribute('src') !== source) {
                        video.setAttribute('src', source);
                        video.load();
                    }
                    const playRequest = video.play();
                    if (playRequest && typeof playRequest.catch === 'function') {
                        playRequest.catch(error => {
                            this.playbackError = true;
                            this.isPlaying = false;
                            console.warn('Video oynatma başlatılamadı:', error);
                        });
                    }
                },

                showPlaybackFeedback(type, duration = 5000) {
                    this.playbackFeedback = type;
                    this.playbackFeedbackVisible = true;
                    if (this.playbackFeedbackTimer) clearTimeout(this.playbackFeedbackTimer);
                    this.playbackFeedbackTimer = setTimeout(() => {
                        this.playbackFeedbackVisible = false;
                        this.playbackFeedbackTimer = null;
                    }, duration);
                },

                togglePlay() {
                    const video = document.getElementById('customVideoPlayer');
                    if (!video) return;
                    if (video.paused) {
                        this.showPlaybackFeedback('play', 5000);
                        this.startPlayback();
                    } else {
                        video.pause();
                    }
                },

                updateVideoProgress() {
                    const video = document.getElementById('customVideoPlayer');
                    if (!video) return;
                    if (video.duration) {
                        this.videoProgress = (video.currentTime / video.duration) * 100;
                        this.currentTimeFormatted = this.formatTime(video.currentTime);
                        this.durationFormatted = this.formatTime(video.duration);

                        if (this.selectedItem) {
                            this.saveMovieProgress(this.getPlaybackProgressKey(), {
                                time: video.currentTime,
                                duration: video.duration,
                                savedAt: Date.now()
                            });
                        }
                    }
                },

                seekVideo(event) {
                    const video = document.getElementById('customVideoPlayer');
                    if (!video || !video.duration) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    const pos = (event.clientX - rect.left) / rect.width;
                    video.currentTime = pos * video.duration;
                },

                skipTime(seconds) {
                    const video = document.getElementById('customVideoPlayer');
                    if (!video || !Number.isFinite(video.duration)) return;
                    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
                    this.showPlaybackFeedback(seconds < 0 ? 'backward' : 'forward', 850);
                    this.showPlayerControls();
                },

                handleSeekTap(direction, event) {
                    const now = Date.now();
                    const point = event ? { x: event.clientX, y: event.clientY } : { x: 0, y: 0 };
                    const previous = this.lastSeekTap;
                    if (previous && previous.direction === direction && now - previous.time <= 360 &&
                        Math.hypot(point.x - previous.x, point.y - previous.y) <= 64) {
                        if (this.lastSeekTapTimer) clearTimeout(this.lastSeekTapTimer);
                        this.lastSeekTapTimer = null;
                        this.lastSeekTap = null;
                        this.handleDoubleTapSeek(direction, event);
                        return;
                    }
                    this.lastSeekTap = { direction, time: now, x: point.x, y: point.y };
                    if (this.lastSeekTapTimer) clearTimeout(this.lastSeekTapTimer);
                    this.lastSeekTapTimer = setTimeout(() => {
                        this.lastSeekTap = null;
                        this.lastSeekTapTimer = null;
                    }, 380);
                    this.showPlayerControls();
                },

                handleDoubleTapSeek(direction, event) {
                    if (event && event.currentTarget) {
                        const rect = event.currentTarget.getBoundingClientRect();
                        this.tapSeekX = event.clientX - rect.left;
                        this.tapSeekY = event.clientY - rect.top;
                    }
                    const seconds = direction === 'backward' ? -10 : 10;
                    const video = document.getElementById('customVideoPlayer');
                    if (!video || !Number.isFinite(video.duration)) return;
                    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
                    this.updateVideoProgress();
                    this.tapSeekAmount = this.tapSeekSide === direction ? this.tapSeekAmount + 10 : 10;
                    this.tapSeekSide = direction;
                    if (this.tapSeekTimer) clearTimeout(this.tapSeekTimer);
                    this.tapSeekTimer = setTimeout(() => {
                        this.tapSeekSide = '';
                        this.tapSeekAmount = 0;
                        this.tapSeekTimer = null;
                    }, 750);
                    this.showPlayerControls();
                },

                skipIntro() {
                    const video = document.getElementById('customVideoPlayer');
                    if (!video) return;
                    video.currentTime += 85;
                },

                setVideoBrightness(value) {
                    this.videoBrightness = Math.max(0.5, Math.min(1.5, Number(value) || 1));
                },

                setVideoVolume(value) {
                    const video = document.getElementById('customVideoPlayer');
                    const nextVolume = Math.max(0, Math.min(1, Number(value)));
                    this.volumeLevel = nextVolume;
                    if (nextVolume > 0) this.previousVolumeLevel = nextVolume;
                    if (video) {
                        video.volume = nextVolume;
                        video.muted = nextVolume === 0;
                    }
                    this.isMuted = nextVolume === 0;
                },

                toggleMute() {
                    const video = document.getElementById('customVideoPlayer');
                    if (!video) return;
                    if (video.muted || this.volumeLevel === 0) {
                        const restoredVolume = this.previousVolumeLevel || 0.5;
                        this.volumeLevel = restoredVolume;
                        video.volume = restoredVolume;
                        video.muted = false;
                        this.isMuted = false;
                    } else {
                        this.previousVolumeLevel = this.volumeLevel;
                        video.muted = true;
                        this.isMuted = true;
                    }
                },

                toggleFullscreen() {
                    const playerContainer = document.getElementById('customVideoPlayer')?.parentElement;
                    if (!playerContainer) return;
                    if (!document.fullscreenElement) {
                        playerContainer.requestFullscreen();
                    } else {
                        document.exitFullscreen();
                    }
                },

                formatTime(seconds) {
                    const m = Math.floor(seconds / 60);
                    const s = Math.floor(seconds % 60);
                    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
                },

                scrollCast(direction) {
                    const container = document.getElementById('castContainer');
                    if (container) {
                        container.scrollBy({ left: 180 * direction, behavior: 'smooth' });
                    }
                },

                scrollSimilar(direction) {
                    const container = document.getElementById('similarContainer');
                    if (container) {
                        container.scrollBy({ left: 180 * direction, behavior: 'smooth' });
                    }
                },

                currentProfile: {
                    name: 'Ana Profil',
                    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=96&auto=format&fit=crop'
                },

                get profileMovieProgress() {
                    try {
                        const progress = safeStorageRead('cine_movie_progress_v1', {});
                        return progress && typeof progress === 'object' && !Array.isArray(progress) ? progress : {};
                    } catch (error) {
                        console.warn('İzleme geçmişi okunamadı:', error);
                        return {};
                    }
                },

                getMovieProgress(itemId) {
                    const own = this.profileMovieProgress[String(itemId)];
                    if (own) return own;
                    // Eski sürümdeki ortak ilerlemeyi oynatmaya devam edebilmek için yalnızca
                    // devam oynatımında geriye dönük yedek olarak kullan.
                    try {
                        const legacy = safeStorageRead('perde_player_progress_v3', {});
                        return legacy && typeof legacy === 'object' && !Array.isArray(legacy) ? (legacy[String(itemId)] || null) : null;
                    } catch (error) {
                        return null;
                    }
                },

                saveMovieProgress(itemId, progress) {
                    try {
                        const all = this.profileMovieProgress;
                        all[String(itemId)] = progress;
                        safeStorageWrite('cine_movie_progress_v1', all);
                    } catch (error) {
                        console.warn('Profil izleme ilerlemesi kaydedilemedi:', error);
                    }
                },


                get libraryMovieEntries() {
                    return Object.entries(this.profileMovieProgress).map(([id, saved]) => {
                        const item = this.catalog.find(entry => String(entry.id) === String(id));
                        const time = Math.max(0, Number(saved?.time) || 0);
                        const duration = Math.max(0, Number(saved?.duration) || 0);
                        if (!item || item.type !== 'movie' || !duration || !time) return null;
                        const percent = Math.min(100, Math.round(time / duration * 100));
                        return { kind: 'movie', item, time, duration, percent, savedAt: Number(saved.savedAt) || 0, label: percent >= 90 ? 'Tamamlandı' : 'Film • İzlemeye devam et' };
                    }).filter(Boolean).sort((a, b) => b.savedAt - a.savedAt);
                },

                get librarySeriesEntries() {
                    const all = safeStorageRead('cine_episode_tracking_v1', {});
                    if (!all || typeof all !== 'object' || Array.isArray(all)) return [];
                    return Object.entries(all).map(([itemId, tracking]) => {
                        const item = this.catalog.find(entry => String(entry.id) === itemId);
                        if (!item || item.type !== 'tv') return null;
                        const watched = tracking?.watched && typeof tracking.watched === 'object' ? tracking.watched : {};
                        const watchedCount = Object.values(watched).reduce((sum, list) => sum + (Array.isArray(list) ? new Set(list.map(Number)).size : 0), 0);
                        const last = tracking?.last || null;
                        if (!watchedCount && !last) return null;
                        const total = Math.max(0, Number(item.episodes) || 0);
                        const percent = total ? Math.min(100, Math.round(watchedCount / total * 100)) : 0;
                        return {
                            kind: 'series', item, watchedCount, total, percent,
                            season: Math.max(1, Number(last?.season) || 1),
                            episode: Math.max(1, Number(last?.episode) || 1),
                            savedAt: Number(last?.updatedAt) || 0,
                            label: 'Sezon ' + (Number(last?.season) || 1) + ' • Bölüm ' + (Number(last?.episode) || 1)
                        };
                    }).filter(Boolean).sort((a, b) => b.savedAt - a.savedAt);
                },

                get continueWatchingItems() {
                    return [
                        ...this.libraryMovieEntries.filter(entry => entry.percent < 90),
                        ...this.librarySeriesEntries.filter(entry => entry.percent < 100)
                    ].sort((a, b) => b.savedAt - a.savedAt);
                },

                get libraryHistoryItems() {
                    return [...this.libraryMovieEntries, ...this.librarySeriesEntries]
                        .sort((a, b) => b.savedAt - a.savedAt)
                        .slice(0, 24);
                },

                resumeLibraryItem(entry) {
                    if (!entry?.item) return;
                    this.openWatchPage(entry.item);
                    if (entry.kind === 'series') {
                        this.selectedSeason = entry.season;
                        this.selectedEpisode = entry.episode;
                        this.currentEpisodePage = Math.floor((entry.episode - 1) / 8) + 1;
                    }
                },

                userStatusRevision: 0,
                get watchedItems() {
                    this.userStatusRevision;
                    const saved = safeStorageRead('cine_watched_items_v1', []);
                    if (!Array.isArray(saved)) return [];
                    return saved.filter(entry => entry && entry.id != null).map(entry => {
                        const current = this.catalog.find(item => String(item.id) === String(entry.id));
                        return current ? { ...current, _statusSavedAt: Number(entry._statusSavedAt) || 0 } : entry;
                    }).sort((a,b) => (b._statusSavedAt || 0) - (a._statusSavedAt || 0));
                },
                get favoriteItems() {
                    this.userStatusRevision;
                    const saved = safeStorageRead('cine_favorite_items_v1', []);
                    if (!Array.isArray(saved)) return [];
                    return saved.filter(entry => entry && entry.id != null).map(entry => {
                        const current = this.catalog.find(item => String(item.id) === String(entry.id));
                        return current ? { ...current, _statusSavedAt: Number(entry._statusSavedAt) || 0 } : entry;
                    }).sort((a,b) => (b._statusSavedAt || 0) - (a._statusSavedAt || 0));
                },
                togglePersonalStatus(storageKey, item) {
                    if (!item || item.id == null) return;
                    const saved = safeStorageRead(storageKey, []);
                    const list = Array.isArray(saved) ? saved.filter(entry => entry && entry.id != null) : [];
                    const index = list.findIndex(entry => String(entry.id) === String(item.id));
                    if (index >= 0) list.splice(index, 1);
                    else list.unshift({ ...item, _statusSavedAt: Date.now() });
                    if (safeStorageWrite(storageKey, list)) this.userStatusRevision += 1;
                },
                toggleWatched(item) { this.togglePersonalStatus('cine_watched_items_v1', item); },
                toggleFavorite(item) { this.togglePersonalStatus('cine_favorite_items_v1', item); },
                isWatched(item) {
                    this.userStatusRevision;
                    return !!item && this.watchedItems.some(entry => String(entry.id) === String(item.id));
                },
                isFavorite(item) {
                    this.userStatusRevision;
                    return !!item && this.favoriteItems.some(entry => String(entry.id) === String(item.id));
                },
                getPersonalStatusItems(category) {
                    if (category === 'user-watchlist') return this.watchlist;
                    if (category === 'user-watched') return this.watchedItems;
                    if (category === 'user-favorites') return this.favoriteItems;
                    return [];
                },

                watchlistRevision: 0,
                get watchlist() {
                    const list = safeStorageRead('cine_watchlist_v1', []);
                    return Array.isArray(list) ? list.filter(item => item && typeof item === 'object' && item.id != null) : [];
                },
                get currentWatchlist() {
                    this.watchlistRevision;
                    return this.watchlist;
                },

                toggleWatchlist(item) {
                    const list = this.watchlist;
                    const index = list.findIndex(m => m && String(m.id) === String(item.id));
                    if (index > -1) list.splice(index, 1);
                    else list.push(item);
                    safeStorageWrite('cine_watchlist_v1', list);
                    this.watchlistRevision += 1;
                },

                isInWatchlist(item) {
                    this.watchlistRevision;
                    return this.watchlist.some(m => m && String(m.id) === String(item.id));
                },

                recommendationMode: safeStorageRead('cine_recommendation_mode_v1', 'taste'),
                recommendationRefreshIndex: Math.max(0, Number(safeStorageRead('cine_recommendation_rotation_v1', 0)) || 0),
                get personalizedRecommendationModeConfig() {
                    const config = this.homepageConfig?.personalizedSection?.discoveryModes || {};
                    return { taste: config.taste !== false, surprise: config.surprise !== false, series: config.series !== false, gems: config.gems !== false };
                },
                isPersonalizedModeEnabled(mode) { return this.personalizedRecommendationModeConfig[mode] !== false; },
                recommendationDisplayCache: null,
                setPersonalizedRecommendationMode(mode) {
                    if (!this.isPersonalizedModeEnabled(mode) || this.recommendationMode === mode) return;
                    // Görsel seçimi önce güncelle: buton aktif durumu aynı etkileşimde değişir.
                    this.recommendationMode = mode;
                    this.recommendationRefreshIndex += 1;
                    this.recommendationDisplayCache = null;
                    safeStorageWrite('cine_recommendation_mode_v1', mode);
                    safeStorageWrite('cine_recommendation_rotation_v1', this.recommendationRefreshIndex);
                },
                refreshPersonalizedRecommendations() {
                    this.recommendationRefreshIndex += 1;
                    this.recommendationDisplayCache = null;
                    safeStorageWrite('cine_recommendation_rotation_v1', this.recommendationRefreshIndex);
                },
                get displayedPersonalizedRecommendations() {
                    const base = this.personalizedRecommendations;
                    if (!base.length) return [];
                    const cached = this.recommendationDisplayCache;
                    if (cached && cached.base === base && cached.mode === this.recommendationMode && cached.rotation === this.recommendationRefreshIndex) return cached.value;
                    const enabled = this.personalizedRecommendationModeConfig;
                    const mode = enabled[this.recommendationMode] ? this.recommendationMode : 'taste';
                    let pool = [...base];
                    if (mode === 'series') {
                        pool = pool.filter(item => item.type === 'tv').sort((a,b) => (Number(b.year)||0)-(Number(a.year)||0) || (Number(b.rating)||0)-(Number(a.rating)||0));
                    } else if (mode === 'gems') {
                        pool = pool.filter(item => { const rating=Number(item.rating)||0; return rating>=7 && rating<=8.8; })
                            .sort((a,b)=>(Number(b.rating)||0)-(Number(a.rating)||0) || (Number(b.year)||0)-(Number(a.year)||0));
                    } else if (mode === 'surprise') {
                        const seed=this.recommendationRefreshIndex+1;
                        const hash=value=>{let result=seed*2654435761;for(const char of String(value))result=Math.imul(result^char.charCodeAt(0),16777619);return result>>>0;};
                        pool.sort((a,b)=>hash(a.id)-hash(b.id));
                    }
                    if (!pool.length) pool=[...base];
                    const offset=(this.recommendationRefreshIndex*5)%pool.length;
                    const value = mode==='surprise' ? pool : pool.slice(offset).concat(pool.slice(0,offset));
                    this.recommendationDisplayCache = { base, mode: this.recommendationMode, rotation: this.recommendationRefreshIndex, value };
                    return value;
                },

                reviews: (() => { const value = safeStorageRead('cine_reviews', {}); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; })(),

                getReviews(itemId) {
                    return this.reviews[itemId] || [];
                },

                submitReview() {
                    if (!this.userCommentText.trim() || !this.selectedItem) return;
                    if (!Array.isArray(this.reviews[this.selectedItem.id])) this.reviews[this.selectedItem.id] = [];
                    this.reviews[this.selectedItem.id].unshift({
                        author: this.currentProfile.name,
                        rating: this.userRating,
                        comment: this.userCommentText,
                        date: new Date().toLocaleDateString()
                    });
                    safeStorageWrite('cine_reviews', this.reviews);
                    this.userCommentText = '';
                },

                get franchiseEntries() {
                    return (this.franchises || []).filter(franchise => franchise && franchise.active !== false).map(franchise => {
                        const items = (Array.isArray(franchise.items) ? franchise.items : []).map(id => this.catalog.find(item => String(item.id) === String(id))).filter(item => item && item.type === 'movie').sort((a,b) => Number(a.year || 0) - Number(b.year || 0));
                        const years = items.map(item => Number(item.year || String(item.tmdbReleaseDate || '').slice(0, 4))).filter(Number.isFinite);
                        return { ...franchise, items, count: items.length, firstYear: years.length ? Math.min(...years) : '', lastYear: years.length ? Math.max(...years) : '', poster: franchise.poster || items[0]?.poster || items[0]?.image || '', backdrop: franchise.backdrop || items[0]?.backdrop || items[0]?.poster || items[0]?.image || '' };
                    }).filter(franchise => franchise.items.length >= 2);
                },
                get featuredFranchises() { return this.franchiseEntries.slice(0, 8); },
                get selectedFranchise() { return this.franchiseEntries.find(franchise => String(franchise.id) === String(this.selectedFranchiseId)) || null; },
                openFranchise(franchiseOrId, updateRoute = true) {
                    const id = typeof franchiseOrId === 'object' ? franchiseOrId?.id : franchiseOrId;
                    const franchise = this.franchiseEntries.find(entry => String(entry.id) === String(id));
                    if (!franchise) return;
                    this.selectedFranchiseId = String(franchise.id); this.currentPage = 'franchises';
                    if (updateRoute) this.syncRouteToUrl('franchise', franchise);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                },
                closeFranchiseDetail() {
                    this.selectedFranchiseId = null; this.currentPage = 'franchises';
                    this.syncRouteToUrl('franchises', null); window.scrollTo({ top: 0, behavior: 'smooth' });
                },

                getRouteHash(page = this.currentPage, item = this.selectedItem) {
                    if (page === 'watch' && item?.id) return '#/watch/' + encodeURIComponent(item.id);
                    if (page === 'franchise' && item?.id) return '#/franchise/' + encodeURIComponent(item.id);
                    if (page === 'actor' && this.selectedActor?.id) return '#/actor/' + encodeURIComponent(this.selectedActor.id);
                    if (page === 'director' && this.selectedActor?.id) return '#/director/' + encodeURIComponent(this.selectedActor.id);
                    return '#/' + encodeURIComponent(page || 'home');
                },

                syncRouteToUrl(page = this.currentPage, item = this.selectedItem) {
                    const nextHash = this.getRouteHash(page, item);
                    if (window.location.hash !== nextHash) {
                        const nextUrl = window.location.pathname + window.location.search + nextHash;
                        const currentState = window.history.state && typeof window.history.state === 'object' ? window.history.state : {};
                        if (this.routeHistoryReady) {
                            const nextIndex = Number(currentState.cineverseRouteIndex || this.routeHistoryIndex || 0) + 1;
                            window.history.pushState({ ...currentState, cineverseRouteIndex: nextIndex }, '', nextUrl);
                            this.routeHistoryIndex = nextIndex;
                        } else {
                            window.history.replaceState({ ...currentState, cineverseRouteIndex: 0 }, '', nextUrl);
                            this.routeHistoryIndex = 0;
                        }
                    }
                },

                restoreRouteFromUrl() {
                    const hash = window.location.hash || '';
                    const actorMatch = hash.match(/^#\/actor\/(\d+)$/);
                    if (actorMatch) {
                        this.openActorProfile({ id: Number(actorMatch[1]), name: 'Oyuncu' }, false);
                        return;
                    }
                    const directorMatch = hash.match(/^#\/director\/(\d+)$/);
                    if (directorMatch) {
                        this.openDirectorProfile({ id: Number(directorMatch[1]), name: 'Yönetmen' }, false);
                        return;
                    }
                    const franchiseMatch = hash.match(/^#\/franchise\/([^/?#]+)$/);
                    if (franchiseMatch) { this.openFranchise(decodeURIComponent(franchiseMatch[1]), false); return; }
                    const match = hash.match(/^#\/watch\/(.+)$/);
                    if (match) {
                        const itemId = decodeURIComponent(match[1]);
                        const item = this.catalog.find(entry => String(entry.id) === itemId);
                        if (item) {
                            this.openWatchPage(item, false);
                            return;
                        }
                    }

                    const pageMatch = hash.match(/^#\/([^/?#]+)$/);
                    const page = pageMatch ? decodeURIComponent(pageMatch[1]) : 'home';
                    const catalogPages = ['movies', 'series', 'turkish'];
                    if (catalogPages.includes(page)) { this.navigateTo(page); return; }
                    const allowedPages = ['home', 'explore', 'video-links', 'library', 'watchlist', 'stats', 'franchises'];
                    this.currentPage = allowedPages.includes(page) ? page : 'home';
                    this.activeHeaderMenu = this.currentPage;
                    if (this.currentPage === 'franchises') this.selectedFranchiseId = null;
                    this.syncRouteToUrl(this.currentPage, null);
                },

                isHeaderMenuActive(page) {
                    if (this.currentPage === 'explore') return this.activeHeaderMenu === page;
                    return this.currentPage === page;
                },

                navigateTo(page) {
                    if (page === 'new-arrivals') {
                        this.activeHeaderMenu = 'explore';
                        this.searchQuery = '';
                        this.discoveryType = 'all';
                        this.discoveryMood = 'all';
                        this.discoveryGenre = 'all';
                        this.discoveryCountry = 'all';
                        this.discoveryCountryCode = '';
                        this.discoveryDirector = '';
                        this.discoveryPlatform = 'all';
                        this.discoveryRating = '0';
                        this.discoveryYearFrom = '';
                        this.discoveryYearTo = '';
                        this.quickFilter = 'all';
                        this.sortBy = 'newest';
                        this.currentPage = 'explore';
                        this.syncRouteToUrl('explore', null);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        return;
                    }
                    const catalogViews = { movies: 'movies', series: 'series', turkish: 'turkish' };
                    this.activeHeaderMenu = page;
                    if (catalogViews[page]) {
                        this.searchQuery = '';
                        this.discoveryType = 'all';
                        this.discoveryMood = 'all';
                        this.discoveryGenre = 'all';
                        this.discoveryCountry = page === 'turkish' ? 'Türkiye' : 'all';
                        this.discoveryCountryCode = '';
                        this.discoveryDirector = '';
                        this.discoveryPlatform = 'all';
                        this.discoveryRating = '0';
                        this.discoveryYearFrom = '';
                        this.discoveryYearTo = '';
                        this.quickFilter = page === 'movies' ? 'movies' : (page === 'series' ? 'series' : 'all');
                        this.sortBy = 'newest';
                        this.currentPage = 'explore';
                        this.syncRouteToUrl(page, null);
                    } else {
                        if (page === 'franchises') this.selectedFranchiseId = null;
                        this.currentPage = page;
                        this.syncRouteToUrl(page, null);
                    }
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                },

                navigateBack() {
                    const historyIndex = Number(window.history.state?.cineverseRouteIndex ?? this.routeHistoryIndex ?? 0);
                    if (historyIndex > 0) {
                        window.history.back();
                    } else if (this.currentPage !== 'home') {
                        this.navigateTo('home');
                    }
                },

                async fetchActorAwards(wikidataId) {
                    if (!wikidataId) return [];
                    try {
                        const response = await fetch('https://www.wikidata.org/wiki/Special:EntityData/' + encodeURIComponent(wikidataId) + '.json');
                        if (!response.ok) throw new Error('Wikidata yanıt vermedi');
                        const payload = await response.json();
                        const entity = payload.entities?.[wikidataId];
                        const claims = entity?.claims?.P166 || [];
                        const awardClaims = claims.map(claim => {
                            const id = claim.mainsnak?.datavalue?.value?.id;
                            if (!id) return null;
                            const rawDate = claim.qualifiers?.P585?.[0]?.datavalue?.value?.time || '';
                            const yearMatch = rawDate.match(/[+-](\d{4})-/);
                            return { id, year: yearMatch ? yearMatch[1] : '' };
                        }).filter(Boolean);
                        const ids = [...new Set(awardClaims.map(item => item.id))];
                        if (!ids.length) return [];
                        const labelsResponse = await fetch('https://www.wikidata.org/w/api.php?action=wbgetentities&ids=' + encodeURIComponent(ids.join('|')) + '&props=labels&languages=tr|en&format=json&origin=*');
                        if (!labelsResponse.ok) throw new Error('Ödül adları alınamadı');
                        const labelsPayload = await labelsResponse.json();
                        const awards = awardClaims.map(item => ({
                            name: labelsPayload.entities?.[item.id]?.labels?.tr?.value || labelsPayload.entities?.[item.id]?.labels?.en?.value || '',
                            year: item.year
                        })).filter(item => item.name);
                        const unique = new Map();
                        awards.forEach(item => {
                            const key = item.name + '|' + item.year;
                            if (!unique.has(key)) unique.set(key, item);
                        });
                        return [...unique.values()].sort((a,b) => String(b.year).localeCompare(String(a.year)) || a.name.localeCompare(b.name, 'tr'));
                    } catch (error) {
                        console.warn('Oyuncu ödülleri alınamadı:', error);
                        return [];
                    }
                },

                async openActorProfile(actor, updateUrl = true) {
                    if (!actor || !actor.id) return;
                    this.selectedActor = { ...actor, id: Number(actor.id) };
                    this.currentPage = 'actor';
                    this.actorProfileError = '';
                    if (updateUrl) this.syncRouteToUrl('actor', null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    const cacheKey = String(actor.id);
                    if (this.actorProfileCache[cacheKey]) {
                        Object.assign(this.selectedActor, this.actorProfileCache[cacheKey]);
                        return;
                    }
                    this.actorProfileLoading = true;
                    try {
                        const personPath = 'person/' + encodeURIComponent(actor.id) + '?append_to_response=movie_credits,tv_credits,external_ids';
                        const person = await this.fetchTmdb(personPath);
                        const awards = await this.fetchActorAwards(person.external_ids?.wikidata_id);
                        let biography = person.biography || '';
                        if (!biography.trim()) {
                            try {
                                const englishPerson = await this.fetchTmdb('person/' + encodeURIComponent(actor.id), 'en-US');
                                biography = englishPerson.biography || '';
                            } catch (fallbackError) {
                                console.warn('Oyuncu biyografisinin İngilizce kaynağı alınamadı:', fallbackError);
                            }
                        }
                        const credits = [
                            ...(person.movie_credits?.cast || []).map(item => ({ ...item, mediaType: 'movie' })),
                            ...(person.tv_credits?.cast || []).map(item => ({ ...item, mediaType: 'tv' }))
                        ];
                        const seen = new Set();
                        const catalogByTmdb = new Map((this.catalog || [])
                            .filter(entry => entry && entry.tmdbId != null)
                            .map(entry => [entry.type + ':' + String(entry.tmdbId), entry]));
                        const filmography = credits
                            .filter(item => item.id && !seen.has(item.mediaType + ':' + item.id) && seen.add(item.mediaType + ':' + item.id))
                            .map(item => {
                                const archiveItem = catalogByTmdb.get(item.mediaType + ':' + String(item.id));
                                const imdbRating = Number.parseFloat(archiveItem?.imdbRating ?? archiveItem?.imdb_rating ?? archiveItem?.imdbScore ?? item.imdbRating ?? 0) || 0;
                                const tmdbRating = Number(item.vote_average || archiveItem?.tmdbRating || archiveItem?.rating || 0);
                                return {
                                    id: item.id,
                                    type: item.mediaType,
                                    title: item.title || item.name || 'İsimsiz yapım',
                                    character: item.character || item.job || '',
                                    year: String(item.release_date || item.first_air_date || '').slice(0,4),
                                    poster: item.poster_path ? 'https://image.tmdb.org/t/p/w342' + item.poster_path : '',
                                    rating: tmdbRating,
                                    imdbRating,
                                    inCatalog: Boolean(archiveItem),
                                    sortRating: imdbRating || tmdbRating,
                                    genres: (item.genre_ids || []).map(id => ({28:'Aksiyon',12:'Macera',16:'Animasyon',35:'Komedi',80:'Suç',99:'Belgesel',18:'Dram',10751:'Aile',14:'Fantastik',36:'Tarih',27:'Korku',10402:'Müzik',9648:'Gizem',10749:'Romantik',878:'Bilim Kurgu',10770:'TV Filmi',53:'Gerilim',10752:'Savaş',37:'Vahşi Batı',10759:'Aksiyon & Macera',10762:'Çocuk',10763:'Haber',10764:'Reality',10765:'Bilim Kurgu & Fantastik',10766:'Pembe Dizi',10767:'Talk Show',10768:'Savaş & Politika'})[id]).filter(Boolean),
                                    overview: item.overview || ''
                                };
                            })
                            .sort((a,b) => Number(b.inCatalog) - Number(a.inCatalog) || b.sortRating - a.sortRating || String(b.year).localeCompare(String(a.year)));
                        const profile = {
                            id: person.id,
                            name: person.name || actor.name || 'Oyuncu',
                            biography,
                            biographyIsEnglish: this.isEnglishBiography(biography),
                            biographyTranslated: '',
                            biographyShowOriginal: false,
                            biographyTranslationLoading: false,
                            biographyTranslationError: '',
                            awards,
                            birthday: person.birthday || '',
                            deathday: person.deathday || '',
                            placeOfBirth: person.place_of_birth || '',
                            knownFor: person.known_for_department || 'Oyuncu',
                            profile: person.profile_path ? 'https://image.tmdb.org/t/p/h632' + person.profile_path : (actor.profile || ''),
                            alsoKnownAs: person.also_known_as || [],
                            filmography
                        };
                        this.actorProfileCache[cacheKey] = profile;
                        Object.assign(this.selectedActor, profile);
                    } catch (error) {
                        this.actorProfileError = error.message || 'Oyuncu bilgileri alınamadı.';
                    } finally {
                        this.actorProfileLoading = false;
                    }
                },

                async resolveDirectorPerson(actor) {
                    if (actor?.id) return actor;
                    const directorName = String(actor?.name || '').trim();
                    if (!directorName) return actor;
                    const normalizedName = this.normalizeSearchText(directorName);
                    const candidates = (this.catalog || []).filter(item =>
                        this.normalizeSearchText(item.tmdbDirector || item.director || '') === normalizedName &&
                        item.tmdbId
                    );
                    for (const item of candidates) {
                        try {
                            const mediaType = item.type === 'tv' || item.type === 'series' ? 'tv' : 'movie';
                            const credits = await this.fetchTmdb(mediaType + '/' + item.tmdbId + '/credits');
                            const match = (credits.crew || []).find(person =>
                                person.job === 'Director' &&
                                this.normalizeSearchText(person.name || '') === normalizedName
                            );
                            if (match?.id) {
                                return {
                                    ...actor,
                                    id: Number(match.id),
                                    name: match.name || directorName,
                                    profile: match.profile_path ? 'https://image.tmdb.org/t/p/h632' + match.profile_path : (actor.profile || '')
                                };
                            }
                        } catch (error) {
                            console.warn('Yönetmen kimliği katalog yapımından çözümlenemedi:', item.title, error);
                        }
                    }
                    return actor;
                },

                async openDirectorProfile(actor, updateUrl = true) {
                    if (!actor || (!actor.id && !actor.name)) return;
                    actor = await this.resolveDirectorPerson(actor);
                    this.selectedActor = { ...actor, id: actor.id ? Number(actor.id) : null };
                    this.currentPage = 'director';
                    this.actorProfileError = '';
                    if (!actor.id) {
                        this.actorProfileError = 'Bu yönetmen için Perde kataloğundaki yapımlardan profil bilgisi bulunamadı.';
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        return;
                    }
                    if (updateUrl) this.syncRouteToUrl('director', null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    const cacheKey = String(actor.id);
                    if (this.directorProfileCache[cacheKey]) {
                        Object.assign(this.selectedActor, this.directorProfileCache[cacheKey]);
                        return;
                    }
                    this.actorProfileLoading = true;
                    try {
                        const personPath = 'person/' + encodeURIComponent(actor.id) + '?append_to_response=movie_credits,tv_credits,external_ids';
                        const person = await this.fetchTmdb(personPath);
                        const awards = await this.fetchActorAwards(person.external_ids?.wikidata_id);
                        let biography = person.biography || '';
                        if (!biography.trim()) {
                            try {
                                const englishPerson = await this.fetchTmdb('person/' + encodeURIComponent(actor.id), 'en-US');
                                biography = englishPerson.biography || '';
                            } catch (fallbackError) {
                                console.warn('Oyuncu biyografisinin İngilizce kaynağı alınamadı:', fallbackError);
                            }
                        }
                        const credits = [
                            ...(person.movie_credits?.crew || []).filter(item => item.job === 'Director').map(item => ({ ...item, mediaType: 'movie' })),
                            ...(person.tv_credits?.crew || []).filter(item => item.job === 'Director').map(item => ({ ...item, mediaType: 'tv' }))
                        ];
                        const seen = new Set();
                        const catalogByTmdb = new Map((this.catalog || [])
                            .filter(entry => entry && entry.tmdbId != null)
                            .map(entry => [entry.type + ':' + String(entry.tmdbId), entry]));
                        const filmography = credits
                            .filter(item => item.id && !seen.has(item.mediaType + ':' + item.id) && seen.add(item.mediaType + ':' + item.id))
                            .map(item => {
                                const archiveItem = catalogByTmdb.get(item.mediaType + ':' + String(item.id));
                                const imdbRating = Number.parseFloat(archiveItem?.imdbRating ?? archiveItem?.imdb_rating ?? archiveItem?.imdbScore ?? item.imdbRating ?? 0) || 0;
                                const tmdbRating = Number(item.vote_average || archiveItem?.tmdbRating || archiveItem?.rating || 0);
                                return {
                                    id: item.id,
                                    type: item.mediaType,
                                    title: item.title || item.name || 'İsimsiz yapım',
                                    character: item.character || item.job || '',
                                    year: String(item.release_date || item.first_air_date || '').slice(0,4),
                                    poster: item.poster_path ? 'https://image.tmdb.org/t/p/w342' + item.poster_path : '',
                                    rating: tmdbRating,
                                    imdbRating,
                                    inCatalog: Boolean(archiveItem),
                                    sortRating: imdbRating || tmdbRating,
                                    genres: (item.genre_ids || []).map(id => ({28:'Aksiyon',12:'Macera',16:'Animasyon',35:'Komedi',80:'Suç',99:'Belgesel',18:'Dram',10751:'Aile',14:'Fantastik',36:'Tarih',27:'Korku',10402:'Müzik',9648:'Gizem',10749:'Romantik',878:'Bilim Kurgu',10770:'TV Filmi',53:'Gerilim',10752:'Savaş',37:'Vahşi Batı',10759:'Aksiyon & Macera',10762:'Çocuk',10763:'Haber',10764:'Reality',10765:'Bilim Kurgu & Fantastik',10766:'Pembe Dizi',10767:'Talk Show',10768:'Savaş & Politika'})[id]).filter(Boolean),
                                    overview: item.overview || ''
                                };
                            })
                            .sort((a,b) => Number(b.inCatalog) - Number(a.inCatalog) || b.sortRating - a.sortRating || String(b.year).localeCompare(String(a.year)));
                        const profile = {
                            id: person.id,
                            name: person.name || actor.name || 'Yönetmen',
                            biography,
                            biographyIsEnglish: this.isEnglishBiography(biography),
                            biographyTranslated: '',
                            biographyShowOriginal: false,
                            biographyTranslationLoading: false,
                            biographyTranslationError: '',
                            awards,
                            birthday: person.birthday || '',
                            deathday: person.deathday || '',
                            placeOfBirth: person.place_of_birth || '',
                            knownFor: 'Yönetmen',
                            profile: person.profile_path ? 'https://image.tmdb.org/t/p/h632' + person.profile_path : (actor.profile || ''),
                            alsoKnownAs: person.also_known_as || [],
                            filmography
                        };
                        this.directorProfileCache[cacheKey] = profile;
                        Object.assign(this.selectedActor, profile);
                    } catch (error) {
                        this.actorProfileError = error.message || 'Oyuncu bilgileri alınamadı.';
                    } finally {
                        this.actorProfileLoading = false;
                    }
                },

                openActorCredit(item) {
                    const match = this.catalog.find(entry => String(entry.tmdbId || '') === String(item.id) && entry.type === item.type);
                    if (match) this.openWatchPage(match);
                },

                formatActorDate(value) {
                    if (!value) return '';
                    const parts = String(value).split('-');
                    return parts.length === 3 ? parts[2] + '.' + parts[1] + '.' + parts[0] : value;
                },

                isEnglishBiography(text) {
                    const words = String(text || '').toLowerCase().match(/[a-z']+/g) || [];
                    if (words.length < 12) return false;
                    const markers = new Set(['the','and','was','were','is','are','has','have','had','his','her','he','she','they','their','with','from','for','born','known','career','actor','actress','director','film','films','television','worked','appeared','studied','began','best','including','who','which','that','in','of','to','on','at','by','as']);
                    const count = words.filter(word => markers.has(word)).length;
                    return count >= 3 && count / words.length >= 0.035;
                },

                async translateSelectedBiography() {
                    const person = this.selectedActor;
                    if (!person?.biography || !person.biographyIsEnglish) return;
                    if (person.biographyTranslated) {
                        person.biographyShowOriginal = !person.biographyShowOriginal;
                        return;
                    }
                    if (person.biographyTranslationLoading) return;
                    person.biographyTranslationLoading = true;
                    person.biographyTranslationError = '';
                    try {
                        const remainingText = String(person.biography).trim();
                        const chunks = [];
                        let remaining = remainingText;
                        while (remaining.length > 0) {
                            if (remaining.length <= 3200) {
                                chunks.push(remaining);
                                break;
                            }
                            let splitAt = remaining.lastIndexOf(' ', 3200);
                            if (splitAt < 1200) splitAt = 3200;
                            chunks.push(remaining.slice(0, splitAt));
                            remaining = remaining.slice(splitAt).trimStart();
                        }
                        const translated = [];
                        for (const chunk of chunks) {
                            const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=' + encodeURIComponent(chunk);
                            const response = await fetch(url);
                            if (!response.ok) throw new Error('Çeviri servisi şu anda yanıt vermiyor. Lütfen tekrar dene.');
                            const data = await response.json();
                            const result = Array.isArray(data?.[0]) ? data[0].map(part => part?.[0] || '').join('') : '';
                            if (!result.trim()) throw new Error('Çeviri sonucu alınamadı. Lütfen tekrar dene.');
                            translated.push(result);
                        }
                        person.biographyTranslated = translated.join(' ').replace(/\s+([,.;!?])/g, '$1');
                        person.biographyShowOriginal = false;
                    } catch (error) {
                        person.biographyTranslationError = error.message || 'Biyografi Türkçeye çevrilemedi.';
                    } finally {
                        person.biographyTranslationLoading = false;
                    }
                },

                formatActorDeathInfo(deathday, birthday) {
                    if (!deathday) return '';
                    const dateLabel = this.formatActorDate(deathday);
                    if (!birthday) return dateLabel;
                    const deathParts = String(deathday).split('-').map(Number);
                    const birthParts = String(birthday).split('-').map(Number);
                    if (deathParts.length !== 3 || birthParts.length !== 3 || [...deathParts, ...birthParts].some(part => !Number.isFinite(part) || part <= 0)) return dateLabel;
                    let age = deathParts[0] - birthParts[0];
                    if (deathParts[1] < birthParts[1] || (deathParts[1] === birthParts[1] && deathParts[2] < birthParts[2])) age--;
                    return dateLabel + ' · ' + age + ' yaşında';
                },

                openWatchPage(item, updateUrl = true) {
                    this.selectedItem = item;
                    this.selectedSeason = 1;
                    this.selectedEpisode = 1;
                    this.currentEpisodePage = 1;
                    this.isPlaying = false;
                    this.hasPlaybackStarted = false;
                    this.playerControlsVisible = true;
                    this.cinemaMode = false;
                    document.body.style.overflow = '';
                    this.playbackRate = 1;
                    this.videoProgress = 0;
                    this.playbackError = false;
                    this.tmdbDetailsError = '';
                    this.currentPage = 'watch';
                    this.applyWatchPageLayout();
                    if (updateUrl) this.syncRouteToUrl('watch', item);
                    this.fetchTmdbDetails(item);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    
                    setTimeout(() => {
                        const video = document.getElementById('customVideoPlayer');
                        const savedProgress = this.getMovieProgress(this.getPlaybackProgressKey());
                        if (video && savedProgress && this.isDirectVideoUrl(this.getPlaybackUrl())) {
                            video.currentTime = savedProgress.time || 0;
                        }
                    }, 200);
                },

                normalizeSearchText(value) {
                    return String(value || '').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/\bturkey\b/g, 'turkiye').trim();
                },

                normalizeGenreName(value) {
                    const name = this.normalizeSearchText(value).replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
                    const aliases = { drama: 'dram', comedy: 'komedi', 'science fiction': 'bilim kurgu', 'sci fi': 'bilim kurgu' };
                    return aliases[name] || name;
                },

                getItemGenreNames(item) {
                    const source = [item?.category, item?.genre, item?.tmdbGenres].filter(Boolean).join(' / ');
                    return [...new Set(source.split(/[\\/;,|&]/).map(value => this.normalizeGenreName(value)).filter(Boolean))];
                },

                getGenreDisplayName(value) {
                    const name = this.normalizeGenreName(value);
                    const labels = { aksiyon:'Aksiyon', macera:'Macera', dram:'Dram', komedi:'Komedi', diger:'Diğer', suc:'Suç', gerilim:'Gerilim', korku:'Korku', 'bilim kurgu':'Bilim-Kurgu', romantik:'Romantik', animasyon:'Animasyon', aile:'Aile', gizem:'Gizem', tarih:'Tarih', belgesel:'Belgesel', spor:'Spor', biyografi:'Biyografi', fantastik:'Fantastik', fantazi:'Fantazi', savas:'Savaş', politik:'Politik', muzik:'Müzik', 'vahsi bati':'Vahşi Batı', western:'Vahşi Batı', polisiye:'Polisiye' };
                    return labels[name] || name.replace(/(^|\s)\S/g, value => value.toLocaleUpperCase('tr-TR'));
                },

                getCountryEntries(value) {
                    const countries = {
                        'turkey':['TR','Türkiye'],'turkiye':['TR','Türkiye'],
                        'united states of america':['US','ABD'],'united states':['US','ABD'],'usa':['US','ABD'],'us':['US','ABD'],
                        'united kingdom':['GB','Birleşik Krallık'],'uk':['GB','Birleşik Krallık'],'great britain':['GB','Birleşik Krallık'],
                        'germany':['DE','Almanya'],'france':['FR','Fransa'],'spain':['ES','İspanya'],'italy':['IT','İtalya'],'japan':['JP','Japonya'],
                        'south korea':['KR','Güney Kore'],'korea, republic of':['KR','Güney Kore'],'republic of korea':['KR','Güney Kore'],'china':['CN','Çin'],
                        'canada':['CA','Kanada'],'australia':['AU','Avustralya'],'india':['IN','Hindistan'],'russia':['RU','Rusya'],'brazil':['BR','Brezilya'],
                        'mexico':['MX','Meksika'],'netherlands':['NL','Hollanda'],'belgium':['BE','Belçika'],'sweden':['SE','İsveç'],'norway':['NO','Norveç'],
                        'denmark':['DK','Danimarka'],'switzerland':['CH','İsviçre'],'ireland':['IE','İrlanda'],'new zealand':['NZ','Yeni Zelanda'],
                        'poland':['PL','Polonya'],'czech republic':['CZ','Çekya'],'czechia':['CZ','Çekya'],'greece':['GR','Yunanistan'],'portugal':['PT','Portekiz'],
                        'argentina':['AR','Arjantin'],'south africa':['ZA','Güney Afrika'],'iran':['IR','İran'],'israel':['IL','İsrail'],
                        'united arab emirates':['AE','Birleşik Arap Emirlikleri'],'uae':['AE','Birleşik Arap Emirlikleri'],'saudi arabia':['SA','Suudi Arabistan'],
                        'taiwan':['TW','Tayvan'],'hong kong':['HK','Hong Kong'],'romania':['RO','Romanya'],'hungary':['HU','Macaristan'],
                        'austria':['AT','Avusturya'],'finland':['FI','Finlandiya'],'iceland':['IS','İzlanda'],'thailand':['TH','Tayland'],
                        'indonesia':['ID','Endonezya'],'malaysia':['MY','Malezya'],'philippines':['PH','Filipinler'],'vietnam':['VN','Vietnam'],
                        'pakistan':['PK','Pakistan'],'ukraine':['UA','Ukrayna'],'serbia':['RS','Sırbistan'],'croatia':['HR','Hırvatistan'],
                        'bulgaria':['BG','Bulgaristan'],'egypt':['EG','Mısır'],'morocco':['MA','Fas'],'nigeria':['NG','Nijerya'],'kenya':['KE','Kenya'],
                        'turkish':['TR','Türkiye'],'united mexican states':['MX','Meksika'],'abd':['US','ABD'],'england':['GB','Birleşik Krallık'],'ingiltere':['GB','Birleşik Krallık'],'gb':['GB','Birleşik Krallık'],'ca':['CA','Kanada'],'canada':['CA','Kanada'],'hk':['HK','Hong Kong'],'ir':['IR','İran'],'it':['IT','İtalya'],'jp':['JP','Japonya'],'kr':['KR','Güney Kore'],'tr':['TR','Türkiye'],'us':['US','ABD'],'kuwait':['KW','Kuveyt'],'lebanon':['LB','Lübnan'],'libyan arab jamahiriya':['LY','Libya'],'libya':['LY','Libya']
                    };
                    return [...new Set(String(value || '').split(/[,;|/]+/).map(country => country.trim()).filter(country => country && country.toLocaleLowerCase('tr-TR') !== 'bilinmiyor'))].map(country => {
                        const key = country.toLocaleLowerCase('en-US').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
                        const match = countries[key];
                        const code = match?.[0] || '';
                        const flagUrl = code ? 'https://flagcdn.com/w40/' + code.toLowerCase() + '.png' : '';
                        return { code: code || key, name: match?.[1] || country, flagUrl };
                    });
                },

                openRelatedDiscoveries(kind, value, countryCode = '') {
                    const selected = String(value || '').trim();
                    if (!selected) return;
                    this.searchQuery = '';
                    this.discoveryType = 'all';
                    this.discoveryMood = 'all';
                    this.discoveryGenre = 'all';
                    this.discoveryCountry = 'all';
                    this.discoveryCountryCode = '';
                    this.discoveryDirector = '';
                    this.discoveryPlatform = 'all';
                    this.discoveryRating = '0';
                    this.discoveryYearFrom = '';
                    this.discoveryYearTo = '';
                    this.quickFilter = 'all';
                    this.sortBy = 'default';
                    if (kind === 'genre') this.discoveryGenre = selected;
                    if (kind === 'country') {
                        this.discoveryCountry = selected;
                        this.discoveryCountryCode = countryCode;
                    }
                    if (kind === 'director') this.discoveryDirector = selected;
                    this.currentPage = 'explore';
                    this.syncRouteToUrl('explore', null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                },

                get availableGenres() {
                    const values = this.catalog.flatMap(item => this.getItemGenreNames(item));
                    return [...new Set(values)].map(value => this.getGenreDisplayName(value)).sort((a, b) => a.localeCompare(b, 'tr'));
                },

                get availableCountries() {
                    const values = this.catalog.flatMap(item => String(item.country || '').split(/[,\/;]/).map(value => value.trim()).filter(Boolean));
                    return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'tr'));
                },

                get availablePlatforms() {
                    const values = this.catalog.flatMap(item => Array.isArray(item.platform) ? item.platform : (item.platform ? [item.platform] : []));
                    return [...new Set(values.map(value => String(value).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
                },

                setDiscoveryMood(mood) {
                    const allowed = ['all','feelgood','thriller','comedy','emotional','mind','family','top'];
                    if (!allowed.includes(mood)) return;
                    this.discoveryMood = mood;
                },

                resetDiscoveryFilters() {
                    this.searchQuery = '';
                    this.discoveryType = 'all';
                    this.discoveryMood = 'all';
                    this.discoveryGenre = 'all';
                    this.discoveryCountry = 'all';
                    this.discoveryCountryCode = '';
                    this.discoveryDirector = '';
                    this.discoveryPlatform = 'all';
                    this.discoveryRating = '0';
                    this.discoveryYearFrom = '';
                    this.discoveryYearTo = '';
                    this.quickFilter = 'all';
                    this.sortBy = 'default';
                },

                get viewingStats() {
                    const safeRead = key => {
                        try { const value = safeStorageRead(key, {}); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
                        catch (error) { console.warn('İstatistik kaydı okunamadı:', key, error); return {}; }
                    };
                    const progressItems = Object.entries(this.profileMovieProgress).map(([id, saved]) => {
                        const item = this.catalog.find(entry => String(entry.id) === String(id));
                        const time = Math.max(0, Number(saved?.time) || 0);
                        const duration = Math.max(0, Number(saved?.duration) || 0);
                        if (!item || item.type !== 'movie' || !duration || !time) return null;
                        const percent = Math.min(100, time / duration * 100);
                        return { item, time, duration, percent, status: percent >= 90 ? 'Tamamlandı' : 'İzlemeye devam edebilirsin', savedAt: Number(saved.savedAt) || 0 };
                    }).filter(Boolean).sort((a, b) => b.savedAt - a.savedAt);
                    const episodeMap = safeRead('cine_episode_tracking_v1');
                    const seriesItems = [];
                    let watchedEpisodes = 0;
                    Object.entries(episodeMap).forEach(([id, value]) => {
                        const item = this.catalog.find(entry => String(entry.id) === id);
                        if (!item || item.type !== 'tv') return;
                        let count = 0;
                        Object.values(value?.watched || {}).forEach(list => { if (Array.isArray(list)) count += new Set(list.map(Number)).size; });
                        watchedEpisodes += count;
                        if (count || value?.last?.updatedAt) seriesItems.push({ item, watchedCount: count, savedAt: Number(value?.last?.updatedAt) || 0 });
                    });
                    const completed = progressItems.filter(entry => entry.percent >= 90);
                    const inProgress = progressItems.filter(entry => entry.percent > 0 && entry.percent < 90);
                    const minutes = Math.floor(progressItems.reduce((sum, entry) => sum + entry.time, 0) / 60);
                    const savedTimeLabel = minutes >= 60 ? Math.floor(minutes / 60) + ' sa ' + (minutes % 60) + ' dk' : minutes + ' dk';
                    const genreCounts = {};
                    const addGenres = item => String(item?.category || item?.genre || 'Diğer').split(/[\\/;,]/).map(value => value.trim()).filter(Boolean).forEach(genre => { genreCounts[genre] = (genreCounts[genre] || 0) + 1; });
                    completed.forEach(entry => addGenres(entry.item));
                    seriesItems.filter(entry => entry.watchedCount > 0).forEach(entry => addGenres(entry.item));
                    const topGenresRaw = Object.entries(genreCounts).sort((a,b) => b[1]-a[1]).slice(0,6);
                    const maxGenre = Math.max(1,...topGenresRaw.map(entry => entry[1]));
                    const topGenres = topGenresRaw.map(([name,count]) => ({name,count,percent:count/maxGenre*100}));
                    const now = new Date();
                    const monthKeys = [];
                    for (let offset=5; offset>=0; offset--) { const date = new Date(now.getFullYear(),now.getMonth()-offset,1); monthKeys.push({key:date.getFullYear()+'-'+date.getMonth(),label:date.toLocaleDateString('tr-TR',{month:'short'})}); }
                    const activityCounts = new Map(monthKeys.map(entry => [entry.key,0]));
                    [...progressItems.map(entry => entry.savedAt),...seriesItems.map(entry => entry.savedAt)].forEach(timestamp => {
                        if (!timestamp) return;
                        const date = new Date(timestamp); const key = date.getFullYear()+'-'+date.getMonth();
                        if (activityCounts.has(key)) activityCounts.set(key,activityCounts.get(key)+1);
                    });
                    const monthlyActivity = monthKeys.map(entry => ({label:entry.label,count:activityCounts.get(entry.key)||0}));
                    const maxActivity = Math.max(1,...monthlyActivity.map(entry => entry.count));
                    monthlyActivity.forEach(entry => entry.percent = entry.count/maxActivity*100);
                    const trackedSeries = seriesItems.length;
                    const totalTracked = progressItems.length + trackedSeries;
                    return {
                        completedMovies:completed.length,inProgressMovies:inProgress.length,watchedEpisodes,savedTimeLabel,
                        progressItems:progressItems.slice(0,8),topGenres,trackedSeries,totalTracked,
                        watchlistCount:this.watchlist.length,monthlyActivity,
                        contentBreakdown:[{label:'Filmler',count:progressItems.length},{label:'Diziler',count:trackedSeries}]
                    };
                },

                getSimilarItems(item) {
                    if (!item) return [];
                    const tokens = value => String(value || '').split(/[\/;,]/).map(part => this.normalizeSearchText(part)).filter(Boolean);
                    const sourceGenres = new Set([...tokens(item.category), ...tokens(item.genre)]);
                    const sourceCast = new Set((item.tmdbCast || item.cast || []).slice(0, 12).map(person => this.normalizeSearchText(typeof person === 'string' ? person : person.name)).filter(Boolean));
                    const sourceCountries = new Set(tokens(item.country));
                    const sourceYear = Number.parseInt(item.year, 10) || 0;
                    const sourceRating = Number.parseFloat(item.rating) || 0;

                    return this.catalog.filter(candidate => candidate.id !== item.id).map(candidate => {
                        const candidateGenres = new Set([...tokens(candidate.category), ...tokens(candidate.genre)]);
                        const candidateCast = (candidate.tmdbCast || candidate.cast || []).slice(0, 12).map(person => this.normalizeSearchText(typeof person === 'string' ? person : person.name)).filter(Boolean);
                        const candidateCountries = tokens(candidate.country);
                        let score = 0;
                        candidateGenres.forEach(genre => { if (sourceGenres.has(genre)) score += 5; });
                        candidateCast.forEach(name => { if (sourceCast.has(name)) score += 2; });
                        if (item.director && candidate.director && this.normalizeSearchText(item.director) === this.normalizeSearchText(candidate.director)) score += 4;
                        candidateCountries.forEach(country => { if (sourceCountries.has(country)) score += 1; });
                        if (item.type === candidate.type) score += 1;
                        const year = Number.parseInt(candidate.year, 10) || 0;
                        if (sourceYear && year) {
                            const distance = Math.abs(sourceYear - year);
                            if (distance <= 3) score += 2;
                            else if (distance <= 7) score += 1;
                        }
                        const rating = Number.parseFloat(candidate.rating) || 0;
                        if (sourceRating && rating && Math.abs(sourceRating - rating) <= 1) score += 1;
                        return { item: candidate, score };
                    }).sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, 'tr')).slice(0, 12).map(entry => entry.item);
                },

                get personalizedRecommendations() {
                    const catalog = Array.isArray(this.catalog) ? this.catalog : [];
                    if (!catalog.length) return [];

                    const safeRead = key => {
                        const value = safeStorageRead(key, {});
                        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
                    };
                    const progress = this.profileMovieProgress;
                    const episodes = safeRead('cine_episode_tracking_v1');
                    const watchlist = this.watchlist;
                    const sectionConfig = this.homepageConfig?.personalizedSection || {};
                    const watchedItems = sectionConfig.excludeWatched === false ? [] : this.watchedItems;
                    const favoriteItems = sectionConfig.excludeFavorites === false ? [] : this.favoriteItems;
                    const cacheKey = JSON.stringify([
                        progress,
                        Object.entries(episodes),
                        watchlist.map(item => String(item.id)),
                        watchedItems.map(item => String(item.id)),
                        favoriteItems.map(item => String(item.id)),
                    ]);
                    const cached = personalizedRecommendationCache.get(this);
                    if (cached && cached.catalog === catalog && cached.key === cacheKey) return cached.value;
                    const cacheResult = value => {
                        personalizedRecommendationCache.set(this, { catalog, key: cacheKey, value });
                        return value;
                    };
                    const catalogById = new Map(catalog.filter(item => item && item.id != null).map(item => [String(item.id), item]));
                    const normalize = value => this.normalizeSearchText(value);
                    const tokens = value => [...new Set(String(value || '').split(/[\\/;,|]/).map(normalize).filter(Boolean))];
                    const people = item => {
                        const tmdb = Array.isArray(item?.tmdbCast) ? item.tmdbCast.map(person => person?.name) : [];
                        const fallback = Array.isArray(item?.cast) ? item.cast.map(person => typeof person === 'string' ? person : person?.name) : [];
                        return [...new Set([...tmdb, ...fallback].map(normalize).filter(Boolean))];
                    };
                    const plotTerms = item => {
                        const cachedTerms = recommendationPlotTermsCache.get(item);
                        if (cachedTerms) return cachedTerms;
                        const source = item?.tmdbOverview || item?.desc || '';
                        const terms = [...new Set(String(source).toLocaleLowerCase('tr').match(/[a-z0-9ğüşöçıİ]{4,}/gi) || [])]
                            .map(normalize).filter(word => word.length >= 4 && !recommendationStopWords.has(word)).slice(0, 40);
                        recommendationPlotTermsCache.set(item, terms);
                        return terms;
                    };
                    const history = new Map();
                    const recentBoost = timestamp => {
                        const savedAt = Number(timestamp) || 0;
                        if (!savedAt) return 0;
                        const ageDays = Math.max(0, (Date.now() - savedAt) / 86400000);
                        return ageDays <= 30 ? 0.45 : ageDays <= 120 ? 0.2 : 0;
                    };
                    Object.entries(progress).forEach(([id, saved]) => {
                        const item = catalogById.get(String(id));
                        const time = Math.max(0, Number(saved?.time) || 0);
                        if (!item || time < 300) return;
                        const duration = Math.max(0, Number(saved?.duration) || 0);
                        const completion = duration ? Math.min(1, time / duration) : 0;
                        const weight = 1 + Math.min(time / 3600, 1.8) + (completion >= 0.9 ? 0.65 : 0) + recentBoost(saved?.savedAt);
                        history.set(String(item.id), { item, weight });
                    });
                    Object.entries(episodes).forEach(([id, tracking]) => {
                        const item = catalogById.get(String(id));
                        if (!item) return;
                        const watched = tracking?.watched && typeof tracking.watched === 'object' ? tracking.watched : {};
                        const count = Object.values(watched).reduce((sum, list) => sum + (Array.isArray(list) ? new Set(list.map(Number).filter(number => number > 0)).size : 0), 0);
                        const last = tracking?.last || null;
                        if (!count && !last) return;
                        const weight = 1.15 + Math.min(count / 7, 2.4) + recentBoost(last?.updatedAt);
                        const previous = history.get(String(item.id));
                        history.set(String(item.id), { item, weight: Math.max(previous?.weight || 0, weight) });
                    });
                    const watchedHistoryIds = new Set(history.keys());
                    const watchlistItems = watchlist.map(saved => catalogById.get(String(saved.id))).filter(Boolean);
                    watchlistItems.forEach(item => {
                        const id = String(item.id);
                        if (!history.has(id)) history.set(id, { item, weight: 0.85 });
                    });
                    const excluded = new Set([...watchedHistoryIds, ...(sectionConfig.excludeWatchlist === false ? [] : watchlist.map(item => String(item.id))), ...watchedItems.map(item => String(item.id)), ...favoriteItems.map(item => String(item.id))]);
                    const prefs = {
                        genres: new Map(), types: new Map(), countries: new Map(),
                        directors: new Map(), actors: new Map(), themes: new Map(),
                    };
                    const add = (map, key, value) => {
                        if (key) map.set(key, (map.get(key) || 0) + value);
                    };
                    history.forEach(({ item, weight }) => {
                        tokens(item.category || item.genre).forEach(value => add(prefs.genres, value, weight));
                        if (item.type) add(prefs.types, item.type, weight);
                        tokens(item.country).forEach(value => add(prefs.countries, value, weight * 0.3));
                        tokens(item.director).forEach(value => add(prefs.directors, value, weight));
                        people(item).forEach(actor => add(prefs.actors, actor, weight * 0.8));
                        plotTerms(item).forEach(value => add(prefs.themes, value, weight * 0.25));
                    });
                    const currentYear = new Date().getFullYear();
                    const selectDiverse = ranked => {
                        const remaining = [...ranked];
                        const selected = [];
                        const genreCounts = new Map();
                        const typeCounts = new Map();
                        const availableByType = new Map();
                        remaining.forEach(entry => {
                            const type = entry.item.type || 'unknown';
                            availableByType.set(type, (availableByType.get(type) || 0) + 1);
                        });
                        const typeTargets = new Map([...availableByType.entries()].map(([type, count]) => [
                            type, Math.max(1, Math.round(40 * count / Math.max(1, ranked.length)))
                        ]));
                        while (remaining.length && selected.length < 40) {
                            const remainingTypes = new Set(remaining.map(candidate => candidate.item.type || 'unknown'));
                            const typesNeedingRoom = new Set([...typeTargets.entries()]
                                .filter(([type, target]) => (typeCounts.get(type) || 0) < target && remainingTypes.has(type))
                                .map(([type]) => type));
                            // İlk 5 görünür öneride (1 büyük + 4 küçük) en az 3 film ve 2 dizi bulunsun.
                            // Puan sıralaması korunur; yalnızca film/dizi kotası dolduğunda seçim dengelenir.
                            let visibleCandidates = remaining;
                            if (selected.length < 5) {
                                const selectedMovies = typeCounts.get('movie') || 0;
                                const selectedTv = typeCounts.get('tv') || 0;
                                const missingMovies = Math.max(0, 3 - selectedMovies);
                                const missingTv = Math.max(0, 2 - selectedTv);
                                const remainingMovies = remaining.filter(entry => entry.item.type === 'movie').length;
                                const remainingTv = remaining.filter(entry => entry.item.type === 'tv').length;
                                if (remainingMovies < missingMovies && remainingTv >= missingTv) {
                                    visibleCandidates = remaining.filter(entry => entry.item.type === 'tv');
                                } else if (remainingTv < missingTv && remainingMovies >= missingMovies) {
                                    visibleCandidates = remaining.filter(entry => entry.item.type === 'movie');
                                } else if (remainingMovies >= missingMovies && remainingTv >= missingTv) {
                                    if (remainingMovies === missingMovies || selectedTv >= 2) {
                                        visibleCandidates = remaining.filter(entry => entry.item.type === 'movie');
                                    } else if (remainingTv === missingTv || selectedMovies >= 3) {
                                        visibleCandidates = remaining.filter(entry => entry.item.type === 'tv');
                                    }
                                }
                                if (!visibleCandidates.length) visibleCandidates = remaining;
                            }
                            let bestEntry = null;
                            let bestAdjusted = -Infinity;
                            visibleCandidates.forEach(entry => {
                                const genre = entry.primaryGenre || 'diger';
                                const type = entry.item.type || 'unknown';
                                const genreCount = genreCounts.get(genre) || 0;
                                const typeCount = typeCounts.get(type) || 0;
                                const otherTypeNeedsRoom = [...typesNeedingRoom].some(otherType => otherType !== type);
                                const typeBalancePenalty = typeCount >= (typeTargets.get(type) || 40) && otherTypeNeedsRoom ? 1000 : 0;
                                const diversityPenalty = Math.max(0, genreCount - 1) * 1.7 + typeBalancePenalty;
                                const adjusted = entry.score - diversityPenalty;
                                if (adjusted > bestAdjusted) {
                                    bestAdjusted = adjusted;
                                    bestEntry = entry;
                                }
                            });
                            const bestIndex = remaining.indexOf(bestEntry);
                            const [chosen] = remaining.splice(bestIndex, 1);
                            selected.push(chosen);
                            const genre = chosen.primaryGenre || 'diger';
                            const type = chosen.item.type || 'unknown';
                            genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
                            typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
                        }
                        return selected;
                    };
                    if (!history.size) {
                        const coldStart = catalog.filter(item => item && item.id != null && !excluded.has(String(item.id))).map(item => {
                            const rating = Math.max(0, Number.parseFloat(item.rating) || 0);
                            const year = Number.parseInt(item.year, 10) || 0;
                            return {
                                item,
                                score: Math.max(0, rating * 0.35 + (year >= currentYear - 4 ? 0.25 : 0)),
                                primaryGenre: tokens(item.category || item.genre)[0] || 'diger',
                                reason: 'Arşivden yüksek puanlı'
                            };
                        }).sort((a, b) => b.score - a.score || (Number.parseFloat(b.item.rating) || 0) - (Number.parseFloat(a.item.rating) || 0) || a.item.title.localeCompare(b.item.title, 'tr'));
                        const result = cacheResult(selectDiverse(coldStart).map(entry => ({ ...entry.item, recommendationReason: entry.reason })));
                        return result;
                    }
                    const ranked = catalog.filter(item => item && item.id != null && !excluded.has(String(item.id))).map(item => {
                        const reasons = [];
                        const push = (score, label) => {
                            if (score > 0.15) reasons.push({ score, label });
                        };
                        const candidateGenres = tokens(item.category || item.genre);
                        const genreMatches = candidateGenres.map(value => ({ value, weight: prefs.genres.get(value) || 0 })).filter(entry => entry.weight > 0).sort((a, b) => b.weight - a.weight);
                        if (genreMatches.length) push(genreMatches.reduce((sum, entry) => sum + entry.weight, 0) * 3.1, 'Sevdiğin tür: ' + genreMatches[0].value);
                        const directorMatches = tokens(item.director).map(value => prefs.directors.get(value) || 0).sort((a, b) => b - a);
                        if (directorMatches[0]) push(directorMatches[0] * 2.8, 'Sevdiğin yönetmen');
                        const actorMatches = people(item).map(actor => prefs.actors.get(actor) || 0).filter(Boolean).sort((a, b) => b - a);
                        if (actorMatches.length) push(actorMatches[0] * 2.1 + (actorMatches[1] || 0) * 0.45, 'Tanıdık oyuncu kadrosu');
                        const themeMatches = prefs.themes.size ? plotTerms(item).map(value => prefs.themes.get(value) || 0).filter(Boolean).sort((a, b) => b - a) : [];
                        if (themeMatches.length) push(themeMatches.slice(0, 4).reduce((sum, value) => sum + value, 0) * 0.35, 'İzlediğin yapımlara benzer konu');
                        const countryMatches = tokens(item.country).map(value => prefs.countries.get(value) || 0).sort((a, b) => b - a);
                        if (countryMatches[0]) push(countryMatches[0] * 0.9, 'Tercih ettiğin ülke sineması');
                        push((prefs.types.get(item.type) || 0) * 0.45, item.type === 'tv' ? 'Dizi tercihine uygun' : 'Film tercihine uygun');
                        const rating = Math.max(0, Number.parseFloat(item.rating) || 0);
                        if (rating > 6) push((rating - 6) * 0.42, 'Yüksek puanlı yapım');
                        const year = Number.parseInt(item.year, 10) || 0;
                        const freshness = year >= currentYear - 3 ? 0.25 : year >= currentYear - 8 ? 0.1 : 0;
                        const reason = reasons.sort((a, b) => b.score - a.score)[0]?.label || 'İzleme profiline uygun';
                        return {
                            item,
                            score: Math.max(0, reasons.reduce((sum, entry) => sum + entry.score, 0) + freshness),
                            primaryGenre: candidateGenres[0] || 'diger',
                            reason
                        };
                    }).sort((a, b) => b.score - a.score || (Number.parseFloat(b.item.rating) || 0) - (Number.parseFloat(a.item.rating) || 0) || a.item.title.localeCompare(b.item.title, 'tr'));
                    const result = cacheResult(selectDiverse(ranked).map(entry => ({ ...entry.item, recommendationReason: entry.reason })));
                    return result;
                },


                get personalizedDiscoveryGenres() {
                    const read = key => {
                        try {
                            const value = safeStorageRead(key, {});
                            return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
                        } catch (error) {
                            console.warn('Keşif tercihleri okunamadı:', key, error);
                            return {};
                        }
                    };
                    const normalize = value => this.normalizeSearchText(value);
                    const counts = new Map();
                    const catalogById = new Map(this.catalog.map(item => [String(item.id), item]));
                    const catalogGenreCounts = new Map();
                    this.catalog.forEach(item => {
                        const genres = new Set(String(item.category || item.genre || '').split(/[\\/;,]/).map(normalize).filter(Boolean));
                        genres.forEach(genre => catalogGenreCounts.set(genre, (catalogGenreCounts.get(genre) || 0) + 1));
                    });
                    const addItem = (item, weight) => {
                        if (!item) return;
                        const genres = [...new Set(String(item.category || item.genre || '').split(/[\\/;,]/).map(normalize).filter(Boolean))];
                        genres.forEach(genre => {
                            const existing = counts.get(genre) || { name: genre, score: 0 };
                            existing.score += weight;
                            counts.set(genre, existing);
                        });
                    };
                    const progress = this.profileMovieProgress;
                    Object.entries(progress).forEach(([id, saved]) => {
                        const item = catalogById.get(String(id));
                        const seconds = Math.max(0, Number(saved?.time) || 0);
                        if (item && seconds >= 300) addItem(item, 1 + Math.min(seconds / 3600, 2));
                    });
                    const episodeMap = read('cine_episode_tracking_v1');
                    Object.entries(episodeMap).forEach(([id, tracking]) => {
                        const item = catalogById.get(String(id));
                        const count = Object.values(tracking?.watched || {}).reduce((sum, list) => sum + (Array.isArray(list) ? new Set(list.map(Number)).size : 0), 0);
                        if (item && count > 0) addItem(item, 1 + Math.min(count / 5, 3));
                    });
                    this.watchlist.forEach(saved => {
                        const item = catalogById.get(String(saved.id));
                        if (item) addItem(item, 1.5);
                    });
                    return [...counts.values()]
                        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'tr'))
                        .slice(0, 4)
                        .map(entry => ({
                            ...entry,
                            label: entry.name.charAt(0).toLocaleUpperCase('tr-TR') + entry.name.slice(1),
                            count: catalogGenreCounts.get(entry.name) || 0
                        }));
                },

                get homeDiscoveryGenres() {
                    const counts = new Map();
                    this.catalog.forEach(item => {
                        this.getItemGenreNames(item).forEach(name => {
                            const current = counts.get(name) || { name, count: 0 };
                            current.count += 1;
                            counts.set(name, current);
                        });
                    });
                    return [...counts.values()]
                        .filter(entry => entry.name !== 'diger' && this.getGenreDisplayName(entry.name).toLocaleLowerCase('tr-TR') !== 'diğer')
                        .map(entry => ({
                            ...entry,
                            label: this.getGenreDisplayName(entry.name),
                            score: entry.count
                        }))
                        .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
                },

                selectPersonalizedGenre(genre) {
                    this.searchQuery = '';
                    this.discoveryType = 'all';
                    this.discoveryCountry = 'all';
                    this.discoveryCountryCode = '';
                    this.discoveryPlatform = 'all';
                    this.discoveryRating = '0';
                    this.discoveryYearFrom = '';
                    this.discoveryYearTo = '';
                    this.quickFilter = 'all';
                    this.sortBy = 'default';
                    this.discoveryGenre = genre;
                },

                get watchableCatalog() {
                    return this.catalog.filter(item => typeof item.watchUrl === 'string' && item.watchUrl.trim().length > 0);
                },

                get sortedFilteredCatalog() {
                    const query = this.normalizeSearchText(this.searchQuery);
                    let result = this.catalog.filter(item => {
                        const castNames = (item.tmdbCast || item.cast || []).map(person => typeof person === 'string' ? person : [person.name, person.character].filter(Boolean).join(' ')).join(' ');
                        const searchable = [
                            item.title, item.originalTitle, item.genre, item.category, item.desc,
                            item.director, item.starring, item.country, castNames, item.awards,
                            ...(Array.isArray(item.platform) ? item.platform : [item.platform || ''])
                        ].join(' ');
                        const matchesSearch = !query || this.normalizeSearchText(searchable).includes(query);
                        const matchesType = this.discoveryType === 'all' || item.type === this.discoveryType;
                        const moodText = this.normalizeSearchText([
                            item.category, item.genre, item.desc, item.title, item.originalTitle
                        ].filter(Boolean).join(' '));
                        const moodGenreTokens = String([item.category, item.genre].filter(Boolean).join(','))
                            .split(/[;,]/)
                            .flatMap(value => value.split('/'))
                            .map(value => this.normalizeSearchText(value).trim())
                            .filter(Boolean);
                        const hasMoodGenre = (...genres) => moodGenreTokens.some(genre => genres.includes(genre));
                        const hasBlockedMoodGenre = (...genres) => hasMoodGenre(...genres);
                        const moodRules = {
                            feelgood: {
                                include: ['komedi', 'aile', 'animasyon', 'romantik', 'muzik'],
                                exclude: ['suc', 'korku', 'gerilim', 'polisiye', 'savas & politik']
                            },
                            comedy: {
                                include: ['komedi'],
                                exclude: ['suc', 'korku', 'gerilim', 'savas & politik']
                            },
                            thriller: {
                                include: ['gerilim', 'gizem', 'suc', 'korku', 'polisiye', 'aksiyon'],
                                exclude: []
                            },
                            emotional: {
                                include: ['dram', 'drama', 'romantik', 'tarih'],
                                exclude: ['suc', 'korku', 'gerilim', 'aksiyon', 'aksiyon & macera', 'savas & politik']
                            },
                            mind: {
                                include: ['bilim-kurgu', 'bilim kurgu', 'bilim kurgu & fantazi', 'gizem', 'fantastik'],
                                exclude: ['korku', 'suc', 'polisiye', 'savas & politik']
                            },
                            family: {
                                include: ['aile', 'cocuk', 'cocuk filmi', 'family'],
                                exclude: ['suc', 'korku', 'gerilim', 'polisiye', 'erotik', 'yetiskin', 'savas & politik']
                            }
                        };
                        const matchesMood = this.discoveryMood === 'all'
                            || (this.discoveryMood === 'top'
                                ? (Number.parseFloat(item.rating) || 0) >= 7.5
                                : (() => {
                                    const rule = moodRules[this.discoveryMood];
                                    if (!rule) return false;
                                    const hasIncludedGenre = this.discoveryMood === 'feelgood'
                                        ? hasMoodGenre('komedi', 'aile', 'animasyon', 'romantik', 'muzik')
                                            || (hasMoodGenre('macera') && hasMoodGenre('fantastik'))
                                        : rule.include.some(genre => hasMoodGenre(genre));
                                    return hasIncludedGenre && !hasBlockedMoodGenre(...rule.exclude);
                                })());
                        const genres = this.getItemGenreNames(item);
                        const selectedGenres = String(this.discoveryGenre || '').split(/[\\/;,|&]/).map(value => this.normalizeGenreName(value)).filter(Boolean);
                        const matchesGenre = this.discoveryGenre === 'all' || selectedGenres.some(genre => genres.includes(genre));
                        const countries = String(item.country || '').split(/[,\/;]/).map(value => this.normalizeSearchText(value));
                        const selectedCountries = String(this.discoveryCountry || '').split(/[,\/;]/).map(value => this.normalizeSearchText(value)).filter(Boolean);
                        const matchesCountry = this.discoveryCountry === 'all' || (this.discoveryCountryCode
                            ? this.getCountryEntries(item.country).some(country => country.code === this.discoveryCountryCode)
                            : selectedCountries.some(country => countries.includes(country)));
                        const matchesDirector = !this.discoveryDirector || this.normalizeSearchText(item.director || '').includes(this.normalizeSearchText(this.discoveryDirector));
                        const platforms = Array.isArray(item.platform) ? item.platform : (item.platform ? [item.platform] : []);
                        const matchesPlatform = this.discoveryPlatform === 'all' || platforms.some(value => this.normalizeSearchText(value) === this.normalizeSearchText(this.discoveryPlatform));
                        const rating = Number.parseFloat(item.rating) || 0;
                        const matchesRating = rating >= (Number(this.discoveryRating) || 0);
                        const year = Number.parseInt(item.year, 10) || 0;
                        const matchesYearFrom = !this.discoveryYearFrom || (year > 0 && year >= Number(this.discoveryYearFrom));
                        const matchesYearTo = !this.discoveryYearTo || (year > 0 && year <= Number(this.discoveryYearTo));
                        let matchesQuick = true;
                        if (this.quickFilter === 'imdb8') matchesQuick = rating >= 8;
                        if (this.quickFilter === 'series') matchesQuick = item.type === 'tv';
                        if (this.quickFilter === 'movies') matchesQuick = item.type === 'movie';
                        return matchesSearch && matchesType && matchesMood && matchesGenre && matchesCountry && matchesDirector && matchesPlatform && matchesRating && matchesYearFrom && matchesYearTo && matchesQuick;
                    });

                    if (this.sortBy === 'newest') result.sort((a, b) => this.catalog.indexOf(b) - this.catalog.indexOf(a));
                    else if (this.sortBy === 'rating') result.sort((a, b) => (Number.parseFloat(b.rating) || 0) - (Number.parseFloat(a.rating) || 0));
                    else if (this.sortBy === 'year') result.sort((a, b) => (Number.parseInt(b.year, 10) || 0) - (Number.parseInt(a.year, 10) || 0));
                    else if (this.sortBy === 'oldest') result.sort((a, b) => this.catalog.indexOf(a) - this.catalog.indexOf(b));
                    else if (this.sortBy === 'title') result.sort((a, b) => a.title.localeCompare(b.title, 'tr'));
                    return result;
                },

                get homeNewArrivals() {
                    // Admin paneli yeni kayıtları kataloğun sonuna ekler; güncellemeler mevcut sırayı korur.
                    return this.catalog.slice(-15).reverse();
                },

                get homeCatalogPreview() {
                    const result = this.sortedFilteredCatalog.slice();
                    if (this.sortBy === 'default') {
                        const seed = String(this.homeCatalogShuffleSeed || 1);
                        const score = item => {
                            const key = seed + '|' + String(item.id ?? item.title ?? '');
                            let hash = 2166136261;
                            for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
                            return hash >>> 0;
                        };
                        result.sort((a, b) => score(a) - score(b));
                    }
                    return result.slice(0, 15);
                }
            }
        }
    