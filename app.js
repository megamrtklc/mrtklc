
        // PERDE ANA UYGULAMASI: Alpine.js durumunu, sayfa gezinmesini ve ekran özelliklerini tanımlar.
        function ultimateProApp() {
            return {
                // Görsel yardımcılarını ana Alpine kapsamına aktarır; işlevler şablonlardan this üzerinden çağrılabilir.
                ...window.PerdeImageHelpers,
                currentPage: 'home',
                mobileMenuOpen: false,
                headerScrolled: window.scrollY > 40,
                isMobileHeroViewport: false,
                activeHeaderMenu: 'home',
                searchQuery: '',
                searchOverlayOpen: false,
                searchPreviousOverflow: '',
                personSearchResults: [],
                personSearchLoading: false,
                personSearchTimer: null,
                personSearchRequestId: 0,
                // Arama mantığı, arama penceresi ilk açıldığında yüklenen modüle devredilir.
                async schedulePersonSearch(value) {
                    return window.PerdeSearchPeople?.schedulePersonSearch.call(this, value);
                },
                get quickSearchResults() {
                    return window.PerdeSearchPeople?.getQuickSearchResults.call(this) || [];
                },
                // [ARAMA PENCERESİ] Büyük arama arayüzünü yalnızca ilk açılışta indirir ve Alpine kapsamına alır.
                // Arama penceresinin HTML ve CSS dosyalarını yalnızca ilk kullanımda, paralel indirir.
                async ensureSearchOverlay() {
                    if (this.searchOverlayLoaded) return true;
                    if (this.searchOverlayPromise) return this.searchOverlayPromise;
                    this.searchOverlayPromise = (async () => {
                        try {
                            // Oyuncu/yönetmen arama kodunu HTML eklenmeden önce hazırla.
                            if (!window.PerdeSearchPeople) {
                                await new Promise((resolve, reject) => {
                                    const script = document.createElement('script');
                                    script.src = './js/search-people.js?v=20261125-search-people-v3';
                                    script.onload = resolve;
                                    script.onerror = () => {
                                        script.remove();
                                        reject(new Error('Arama modülü yüklenemedi.'));
                                    };
                                    document.head.appendChild(script);
                                });
                            }
                            const stylePromise = new Promise(resolve => {
                                const link = document.createElement('link');
                                link.rel = 'stylesheet';
                                link.href = './css/perde-search.css?v=20261124-search-css-v1';
                                link.dataset.perdeSearchStyle = 'true';
                                link.onload = () => resolve(true);
                                link.onerror = () => {
                                    console.warn('[Perde search overlay] Stil dosyası yüklenemedi.');
                                    link.remove();
                                    resolve(false);
                                };
                                document.head.appendChild(link);
                            });
                            const response = await fetch('./runtime-pages/search-overlay.html?v=20261124-search-overlay-v1', { cache: 'default' });
                            if (!response.ok) throw new Error('Arama penceresi yüklenemedi (HTTP ' + response.status + ').');
                            const html = await response.text();
                            if (!html.trim()) throw new Error('Arama penceresi boş döndü.');
                            await stylePromise;
                            const host = document.createElement('div');
                            host.id = 'perde-search-overlay-host';
                            host.innerHTML = html;
                            document.body.appendChild(host);
                            window.Alpine?.initTree?.(host);
                            this.searchOverlayLoaded = true;
                            return true;
                        } catch (error) {
                            console.error('[Perde search overlay]', error);
                            return false;
                        } finally {
                            this.searchOverlayPromise = null;
                        }
                    })();
                    return this.searchOverlayPromise;
                },
                async openSearchOverlay() {
                    if (!await this.ensureSearchOverlay()) return;
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
                discoveryShuffleSeed: String(safeStorageRead('perde_discovery_shuffle_seed_v1', '') || Math.floor(Math.random() * 0x7fffffff)),
                discoveryShowcaseSeed: String(safeStorageRead('perde_discovery_showcase_seed_v1', '') || Math.floor(Math.random() * 0x7fffffff)),
                discoveryCurrentItemId: String(safeStorageRead('perde_discovery_current_v1', '') || ''),
                discoverySeenIds: Array.isArray(safeStorageRead('perde_discovery_seen_v1', [])) ? safeStorageRead('perde_discovery_seen_v1', []) : [],
                selectedItem: null,
                // Fragman penceresi body içine taşındığında da ana Alpine kapsamından yönetilir.
                watchTrailerOpen: false,
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
                    if (!['ivory', 'slate', 'dark'].includes(newTheme)) return;
                    this.theme = newTheme;
                    safeStorageWrite('cine_theme_v3', newTheme);
                    applyPerdeTheme(newTheme);
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

                getCardClass(...args) {
                    return window.PerdeWatchPage?.getCardClass.apply(this, args) || 'bg-[#161922] border-gray-800';
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
                    return window.PerdeWatchPage?.getWatchCardOrder.call(this, cardId) ?? 0;
                },

                applyWatchPageLayout() {
                    return window.PerdeWatchPage?.applyWatchPageLayout.call(this);
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
                headerConfig: { enabled:true, sticky:true, showLogoIcon:false, brandPrimary:'', brandAccent:'', logoImage:'/assets/logos/perde-header.png', faviconImage:'/assets/logos/perde-favicon-32.png', faviconWidth:32, faviconHeight:32, showHome:true, homeLabel:'Ana Sayfa', showExplore:true, exploreLabel:'Keşfet', showVideo:true, videoLabel:'Video Bağlantıları', showSearch:true, showProfile:true, showMobileMenu:true, catalogMenusInitialized:false, customLinks:[] },
                footerConfigReady: false,
                footerConfig: { enabled:true, customLinks:[], brandPrimary:'', brandAccent:'', logoImage:'/assets/logos/perde-footer.png', logoWidth:160, logoHeight:40, description:'Filmlerini keşfet, dizilerini takip et, izleme yolculuğunu kendi kütüphanende biriktir.', showBadges:true, badgeOne:'KİŞİSEL KÜTÜPHANE', badgeTwo:'DİZİ TAKİBİ', columnOneTitle:'Perde', homeLabel:'Ana Sayfa', exploreLabel:'Keşfet', libraryLabel:'Kütüphanem', columnTwoTitle:'İzleme Alanım', watchlistLabel:'İzleme Listem', statsLabel:'İstatistikler', featureTitle:'İzleme keyfini kişiselleştir', featureDescription:'Listeni oluştur, kaldığın yerden devam et ve izleme geçmişini tek yerde düzenle.', ctaLabel:'Kütüphaneme Git', showCta:true, copyright:'© 2026 Perde. Tüm hakları saklıdır.', showBackToTop:true },
                watchPageConfig: null,
                heroAutoplayTimer: null,
                heroPaused: false,
                catalogLoading: true,
                catalogError: null,
                catalogDetailsById: null,
                catalogDetailsPromise: null,
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
                    const english = String(item.englishTitle || item.tmdbEnglishTitle ||
                        (item.originalLanguage === 'en' ? (item.originalTitle || item.title) : '') || '').trim();
                    if (!english) return '';
                    const normalize = value => value.toLocaleLowerCase('en-US').replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
                    // Mobil manşette orijinal ad, Türkçe başlıkla aynı olsa bile daima gösterilir.
                    if (window.matchMedia('(max-width: 767px)').matches) return english;
                    const title = String(item.title || '').trim();
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
                                const mobileHero = window.matchMedia('(max-width: 767px)').matches;
                                const english = candidates.find(value => value && normalize(value) &&
                                    (mobileHero || normalize(value) !== normalize(item.title)));
                                if (details.original_language) item.originalLanguage = details.original_language;
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
                    const workerCount = window.matchMedia('(max-width: 767px)').matches ? 2 : 3;
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
                        const localDescription = this.catalogDetailsById?.[String(item.id)]?.desc;
                        if (localDescription) item.desc = localDescription;
                        if (this.selectedItem && String(this.selectedItem.id) === String(item.id)) this.selectedItem.desc = item.desc;
                        this.updateSelectedWatchRoute(item);
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
                            desc: this.catalogDetailsById?.[String(item.id)]?.desc || details.overview || item.desc,
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
                            tmdbOriginalTitle: details.original_title || details.original_name || item.tmdbOriginalTitle || '',
                            englishTitle: englishDetails?.title || englishDetails?.name || item.englishTitle || item.tmdbEnglishTitle || '',
                            tmdbEnglishTitle: englishDetails?.title || englishDetails?.name || item.tmdbEnglishTitle || item.englishTitle || '',
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
                        this.updateSelectedWatchRoute(item);
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
                        title: item.title || item.tmdbTitle || item.name || item.originalTitle || item.original_title || item.original_name || 'İsimsiz yapım',
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
                        originalTitle: item.originalTitle || item.tmdbOriginalTitle || item.original_title || item.original_name || item.tmdb?.original_title || item.tmdb?.original_name || item.title || item.tmdbTitle || '',
                        tmdbCast: cast,
                        trailerUrl: item.trailerUrl || item.tmdbTrailerUrl || '',
                        seasons: item.seasons ?? item.tmdbSeasons ?? null,
                        episodes: item.episodes ?? item.tmdbEpisodes ?? null
                    };
                },

                // Açıklama dosyasını yalnızca arama, keşif, görünür ana sayfa rafı veya detay sayfası istediğinde indir.
                async loadCatalogDescriptionsData() {
                    if (!this.catalogDetailsPromise) {
                        this.catalogDetailsPromise = (async () => {
                            const response = await fetch('./catalog-details.json?v=20261125-details-v1', { cache: 'default' });
                            if (!response.ok) throw new Error('Yapım detayları yüklenemedi: HTTP ' + response.status);
                            const data = await response.json();
                            if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Yapım detay dosyası geçersiz.');
                            this.catalogDetailsById = data;
                            return data;
                        })().catch(error => {
                            this.catalogDetailsPromise = null;
                            console.warn('Yapım açıklamaları yüklenemedi:', error);
                            return null;
                        });
                    }
                    const details = await this.catalogDetailsPromise;
                    if (!details) return null;
                    const byId = new Map((this.catalog || []).map(item => [String(item.id), item]));
                    Object.entries(details).forEach(([id, entry]) => {
                        const description = entry?.desc;
                        if (typeof description !== 'string' || !description.trim()) return;
                        const item = byId.get(String(id));
                        if (item && !item.desc) item.desc = description;
                        if (this.selectedItem && String(this.selectedItem.id) === String(id) && this.selectedItem.desc !== description) {
                            this.selectedItem = { ...this.selectedItem, desc: item?.desc || description };
                        }
                    });
                    return details;
                },

                async loadCatalogDetailsData(itemId) {
                    const details = await this.loadCatalogDescriptionsData();
                    const description = details?.[String(itemId)]?.desc;
                    if (typeof description !== 'string' || !description.trim()) return false;
                    const catalogItem = (this.catalog || []).find(entry => String(entry.id) === String(itemId));
                    if (catalogItem && !catalogItem.desc) catalogItem.desc = description;
                    if (this.selectedItem && String(this.selectedItem.id) === String(itemId) && this.selectedItem.desc !== description) {
                        this.selectedItem = { ...this.selectedItem, desc: catalogItem?.desc || description };
                    }
                    return true;
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
                    // Anasayfa öneri ve tür keşif algoritmaları, izleme sayfası modülü içinden paylaşılır.
                    // Ana sayfa bölümlerini başlatmadan önce ilgili modülün hazır olmasını bekle.
                    const homeAlgorithmsPromise = this.currentPage === 'home' && window.perdeEnsurePageScript
                        ? window.perdeEnsurePageScript('home')
                        : Promise.resolve();
                    this.initDeferredChrome();
                    const heroViewportQuery = window.matchMedia('(max-width: 767px)');
                    this.isMobileHeroViewport = heroViewportQuery.matches;
                    const hydrateActiveHeroOnResize = () => {
                        this.isMobileHeroViewport = heroViewportQuery.matches;
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
                        if (['explore', 'movies', 'series', 'turkish', 'new-arrivals'].includes(page)) this.loadCatalogDescriptionsData();
                        if (page === 'home') this.$nextTick(async () => {
                            // x-if anasayfayı yeniden oluşturur; öneri algoritmasını bölümlerden önce yükle.
                            Object.keys(this.homeSectionReady).forEach(key => { this.homeSectionReady[key] = false; });
                            this.homeSectionLoading.personalized = true;
                            try {
                                await (window.perdeEnsurePageScript?.('home') || Promise.resolve());
                            } catch (error) {
                                console.error('[Perde home recommendations] Modül yüklenemedi:', error);
                                this.homeSectionReady.personalized = true;
                                this.homeSectionLoading.personalized = false;
                            }
                            this.applyHomepageSectionOrder();
                            this.scheduleHomePageHydration();
                            this.initHomeSectionObserver();
                        });
                    });
                    // Manşet ayrı bootstrap verisiyle çizilir; ana katalog isteğini bekletmeden başlat.
                    // Düşük öncelik, ilk manşet görsellerinin ağ önceliğini korurken indirmeyi erkenden başlatır.
                    const catalogRequest = window.__CV_CATALOG_PROMISE__ || fetch('./catalog-lite.json?v=20261125-desc-lazy-v1', { cache: 'no-cache' });
                    try {
                        // İlk açılışta başlatılan ortak JSON isteğini kullan; mobil görsel ön yükleyici de aynı yanıtı paylaşır.
                        // Ortak istek yoksa JSON dosyasına doğrudan geri dön.
                        let heroData = window.__CV_HERO_BOOTSTRAP__ || null;
                        if (!heroData && window.__CV_HERO_DATA_PROMISE__) {
                            heroData = await window.__CV_HERO_DATA_PROMISE__;
                        }
                        if (!heroData) {
                            const heroResponse = await fetch('./hero-data.json', { cache: 'no-cache' });
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
                    if (this.currentPage === 'home') {
                        try {
                            await homeAlgorithmsPromise;
                        } catch (error) {
                            console.error('[Perde home recommendations] Modül yüklenemedi:', error);
                            this.homeSectionReady.personalized = true;
                            this.homeSectionLoading.personalized = false;
                        }
                        this.scheduleHomePageHydration();
                    }
                    try {
                        const response = await catalogRequest;
                        if (!response.ok) {
                            throw new Error('Katalog dosyası yüklenemedi (HTTP ' + response.status + ')');
                        }

                        const data = await response.json();
                        this.homepageConfig = data && typeof data === 'object' ? (data.homepageConfig || null) : null;
                        this.headerConfig = { ...this.headerConfig, ...(data?.headerConfig || {}) };
                        this.headerConfig.logoImage = this.headerConfig.logoImage || '/assets/logos/perde-header.png';
                        this.headerConfig.faviconImage = this.headerConfig.faviconImage || '/assets/logos/perde-favicon-32.png';
                        this.headerConfigReady = true;
                        if (!this.headerConfig.catalogMenusInitialized) {
                            const requiredCatalogMenus = [{label:'Filmler',page:'movies'},{label:'Diziler',page:'series'},{label:'Yerli Yapımlar',page:'turkish'}];
                            const links = Array.isArray(this.headerConfig.customLinks) ? this.headerConfig.customLinks : [];
                            requiredCatalogMenus.forEach(link => { if (!links.some(existing => existing.page === link.page)) links.push(link); });
                            this.headerConfig.customLinks = links;
                            this.headerConfig.catalogMenusInitialized = true;
                        }
                        this.footerConfig = { ...this.footerConfig, ...(data?.footerConfig || {}) };
                        this.footerConfig.logoImage = this.footerConfig.logoImage || '/assets/logos/perde-footer.png';
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
                        // Mobil manşetin İngilizce adlarını katalog hazır olur olmaz yükle.
                        const loadEnglishTitlesWhenIdle = () => this.loadHeroEnglishTitles();
                        const scheduleEnglishTitles = () => {
                            if ('requestIdleCallback' in window) {
                                window.requestIdleCallback(loadEnglishTitlesWhenIdle, { timeout: 1800 });
                            } else {
                                window.setTimeout(loadEnglishTitlesWhenIdle, 300);
                            }
                        };
                        const tvDevice = document.documentElement.classList.contains('cv-tv-mode');
                        // İngilizce manşet başlıkları ilk ekran için kritik değil; mobilde de katalog ve görsellerin önceliğini koru.
                        if (!tvDevice) scheduleEnglishTitles();

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
                        // Ayrıntılı kadro ayrı dosyada; ilk katalog yanıtında tekrar eden isim listelerini taşımıyoruz.
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
                    const desktopHero = root.querySelector('#desktopEditorialHero');
                    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
                    if (!isDesktop) {
                        if (desktopHero && desktopHero.dataset.cvHeroHydrated !== 'true' && !desktopHero.hasAttribute('x-ignore')) desktopHero.setAttribute('x-ignore', '');
                        return;
                    }
                    if (desktopHero?.hasAttribute('x-ignore')) {
                        desktopHero.removeAttribute('x-ignore');
                        desktopHero._x_ignore = false;
                        if (!root.hasAttribute('x-ignore')) {
                            window.Alpine?.initTree?.(desktopHero);
                            desktopHero.dataset.cvHeroHydrated = 'true';
                        }
                    }
                    if (desktopHero?.dataset.cvHeroHydrated === 'true') this.$nextTick(() => this.removeHeroInitialShell());
                },

                scheduleHomePageHydration() {
                    if (this.currentPage !== 'home') return;
                    this.$nextTick(() => {
                        const root = document.getElementById('home-page');
                        if (!root) {
                            window.setTimeout(() => this.scheduleHomePageHydration(), 50);
                            return;
                        }
                        // İlk boyamada hazır olan hero bootstrap ayarlarıyla bölümlerin nihai sırasını uygula.
                        // Katalog yanıtı geldiğinde aynı sıra tekrar uygulanacağı için görünür raflar yer değiştirmez.
                        this.applyHomepageSectionOrder();
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
                            const desktopHero = window.matchMedia('(min-width: 768px)').matches ? currentRoot.querySelector('#desktopEditorialHero') : null;
                            if (desktopHero) desktopHero.dataset.cvHeroHydrated = 'true';
                            this.$nextTick(() => {
                                this.initHomeSectionObserver();
                                this.removeHeroInitialShell();
                            });
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

                    // Açıklamaları ilk katalog isteğine ekleme; ana sayfada açıklama kullanan raf görünür olunca yükle.
                    window.__cineverseHomeDescriptionObserver?.disconnect();
                    const descriptionSections = sections.filter(section =>
                        ['personalized', 'new-arrivals', 'catalog'].includes(section.dataset.homeSection) &&
                        this.isHomepageSectionVisible(section.dataset.homeSection)
                    );
                    if (descriptionSections.length && 'IntersectionObserver' in window) {
                        const descriptionObserver = new IntersectionObserver(entries => {
                            if (!entries.some(entry => entry.isIntersecting)) return;
                            descriptionObserver.disconnect();
                            window.__cineverseHomeDescriptionObserver = null;
                            this.loadCatalogDescriptionsData();
                        }, { rootMargin: '0px', threshold: 0.01 });
                        descriptionSections.forEach(section => descriptionObserver.observe(section));
                        window.__cineverseHomeDescriptionObserver = descriptionObserver;
                    } else if (descriptionSections.some(section => {
                        const rect = section.getBoundingClientRect();
                        return rect.top < window.innerHeight && rect.bottom > 0;
                    })) {
                        this.loadCatalogDescriptionsData();
                    }

                    // Büyük katalog rafının HTML'ini yalnızca kullanıcı o bölüme yaklaşınca indir.
                    const fragmentFallbacks = new WeakMap();
                    const hydrateSection = section => {
                        const key = section.dataset.homeSection;
                        if (!key) return true;
                        // Ana sayfa alt bölümlerinin stillerini ilk ekran sonrasına, ilk bölüm etkinleşene kadar ertele.
                        if (section.dataset.homeStylesReady !== 'true') {
                            if (section.dataset.homeStylesLoading === 'true') return false;
                            section.dataset.homeStylesLoading = 'true';
                            const stylePromise = window.__perdeHomeSectionsCssPromise || (window.__perdeHomeSectionsCssPromise = new Promise(resolve => {
                                const link = document.createElement('link');
                                link.rel = 'stylesheet';
                                link.href = './css/perde-home-sections.css?v=20261124-home-sections-css-v1';
                                link.onload = () => resolve();
                                link.onerror = () => { console.warn('[Perde home styles] Stil dosyası yüklenemedi.'); resolve(); };
                                document.head.appendChild(link);
                            }));
                            stylePromise.then(() => {
                                if (!section.isConnected) return;
                                section.dataset.homeStylesReady = 'true';
                                delete section.dataset.homeStylesLoading;
                                const hydrated = hydrateSection(section);
                                if (hydrated !== false) window.__cineverseHomeSectionObserver?.unobserve(section);
                            });
                            return false;
                        }
                        const fragmentUrl = section.dataset.homeFragment;
                        if (fragmentUrl && section.dataset.homeFragmentLoaded !== 'true') {
                            if (section.dataset.homeFragmentLoading === 'true') return false;
                            if (!fragmentFallbacks.has(section)) fragmentFallbacks.set(section, section.innerHTML);
                            section.dataset.homeFragmentLoading = 'true';
                            fetch(fragmentUrl, { cache: 'default' })
                                .then(response => {
                                    if (!response.ok) throw new Error('Bölüm dosyası yüklenemedi (HTTP ' + response.status + ')');
                                    return response.text();
                                })
                                .then(html => {
                                    if (!section.isConnected) return;
                                    if (!html || !html.trim()) throw new Error('Bölüm dosyası boş döndü.');
                                    section.innerHTML = html;
                                    section.dataset.homeFragmentLoaded = 'true';
                                    delete section.dataset.homeFragmentLoading;
                                    hydrateSection(section);
                                    window.__cineverseHomeSectionObserver?.unobserve(section);
                                })
                                .catch(error => {
                                    if (!section.isConnected) return;
                                    delete section.dataset.homeFragmentLoading;
                                    console.error('[Perde home fragment]', key, error);
                                    section.innerHTML = '<div class="home-catalog-fragment-error"><p>Bu ana sayfa bölümü şu anda yüklenemedi.</p><button type="button" data-home-fragment-retry>Yeniden dene</button></div>';
                                    section.querySelector('[data-home-fragment-retry]')?.addEventListener('click', () => {
                                        section.innerHTML = fragmentFallbacks.get(section) || '';
                                        hydrateSection(section);
                                    });
                                    section.style.removeProperty('visibility');
                                });
                            return false;
                        }
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
                                try {
                                    // Öneri hesabı hata verse veya boş sonuç dönse bile yükleme göstergesi açık kalmasın.
                                    this.displayedPersonalizedRecommendations;
                                } catch (error) {
                                    console.error('[Perde personalized recommendations]', error);
                                } finally {
                                    this.homeSectionReady.personalized = true;
                                    this.$nextTick(() => {
                                        this.prepareHomePersonalizedVariant(section);
                                        this.homeSectionLoading.personalized = false;
                                        if (section.isConnected && this.currentPage === 'home') section.style.removeProperty('visibility');
                                    });
                                }
                            };
                            if (window.matchMedia('(max-width: 767px)').matches) {
                                window.setTimeout(() => {
                                    if ('requestIdleCallback' in window) window.requestIdleCallback(activate, { timeout: 2200 });
                                    else window.setTimeout(activate, 0);
                                }, 1400);
                            } else activate();
                        }
                        if (key !== 'personalized') window.requestAnimationFrame(() => section.style.removeProperty('visibility'));
                        return true;
                    };

                    // Yönetici tarafından kapatılan rafları hemen işle; görünür rafları ekrana yaklaşınca başlat.
                    sections.forEach(section => {
                        const key = section.dataset.homeSection;
                        if (!this.isHomepageSectionVisible(key)) {
                            // Yönetimde kapalı raflar x-ignore olarak kalmalı; Alpine ağacını başlatma.
                            // Kişiselleştirilmiş alan x-cloak kullanmadığından display:none ile gizle.
                            section.style.display = 'none';
                            section.style.visibility = 'hidden';
                            return;
                        }
                        section.removeAttribute('x-cloak');
                        section.style.removeProperty('display');
                        // Harici HTML parçası yüklenirken katalog iskeletini görünür tut.
                        section.style.visibility = section.dataset.homeFragment ? 'visible' : 'hidden';
                    });

                    const pending = sections.filter(section =>
                        section.hasAttribute('x-ignore') &&
                        this.isHomepageSectionVisible(section.dataset.homeSection)
                    );

                    if (!pending.length) return;

                    // Boş HTML iskeletleri sıfır yükseklikte kaldığında IntersectionObserver bunları göremeyebilir.
                    // Görünür ve genişliği olan sıfır-yükseklikli rafları doğrudan yükleyerek bölümlerin takılmasını önle.
                    const zeroHeightPending = pending.filter(section => {
                        const rect = section.getBoundingClientRect();
                        return rect.width > 0 && rect.height === 0 && window.getComputedStyle(section).display !== 'none';
                    });
                    zeroHeightPending.forEach(hydrateSection);

                    // Ana sayfanın küçük rafları eski düzende ilk yüklemede hazırdı.
                    // Modüler HTML parçalarını da etkin olduklarında hemen yükle; yalnızca büyük katalog rafı gözlemciyle geciksin.
                    pending.filter(section => section.dataset.homeSection !== 'catalog').forEach(hydrateSection);

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
                            const hydrated = hydrateSection(entry.target);
                            if (hydrated !== false) observer.unobserve(entry.target);
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
                        .map(entry => byId.get(String(entry.id)))
                        .filter(item => item && (item.backdrop || item.poster || item.image || item.tmdbPoster));
                    if (!selected.length) return sourceCatalog;
                    const configuredCount = Number(this.homepageConfig?.settings?.[mobile ? 'mobileCount' : 'desktopCount']);
                    const count = Math.max(1, Math.min(mobile ? 12 : 15, configuredCount || (mobile ? 6 : 10)));
                    if (selected.length >= count) return selected.slice(0, count);
                    // Yönetim panelinde seçili olup katalogdan silinmiş kayıtlar boş slayt oluşturmasın.
                    // Seçilenlerin sırasını koru; eksik sayıyı görseli bulunan diğer katalog yapımlarıyla tamamla.
                    const selectedIds = new Set(selected.map(item => String(item.id)));
                    const fallbackSlides = sourceCatalog.filter(item =>
                        item && !selectedIds.has(String(item.id)) &&
                        (item.backdrop || item.poster || item.image || item.tmdbPoster)
                    );
                    return selected.concat(fallbackSlides.slice(0, count - selected.length));
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
                    if (document.documentElement.classList.contains('cv-tv-mode') || window.matchMedia('(max-width: 767px)').matches || settings.autoplay === false || this.heroSlides.length < 2) return;
                    const seconds = Math.max(2, Math.min(60, Number(settings.interval) || 6));
                    const advance = () => {
                        if (this.heroPaused || document.hidden || this.heroSlides.length < 2) return;
                        this.currentSlideIndex = (this.currentSlideIndex + 1) % this.heroSlides.length;
                    };
                    this.heroAutoplayTimer = window.setTimeout(() => {
                        advance();
                        this.heroAutoplayTimer = window.setInterval(advance, seconds * 1000);
                    }, seconds * 1000);
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
                    const max = Math.max(80, Math.min(5000, Number(this.homepageConfig?.settings?.descriptionLength) || 220));
                    return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
                },

                get desktopHeroDescription() {
                    const text = String(this.currentHero?.desc || '');
                    const settings = this.homepageConfig?.settings || {};
                    const mode = settings.desktopDescriptionMode || 'medium';
                    const limits = { short: 120, medium: 220, long: 360, custom: 500 };
                    const max = limits[mode] || 220;
                    return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
                },

                get heroDescriptionLines() {
                    const settings = this.homepageConfig?.settings || {};
                    const mode = settings.desktopDescriptionMode || 'medium';
                    if (mode === 'short') return 2;
                    if (mode === 'long') return 4;
                    if (mode === 'custom') return Math.max(1, Math.min(8, Number(settings.desktopDescriptionLines) || 3));
                    return 3;
                },

                get desktopHeroDescriptionWidth() {
                    const settings = this.homepageConfig?.settings || {};
                    const mode = settings.desktopDescriptionWidthMode || 'medium';
                    const widths = { narrow: 560, medium: 720, wide: 900 };
                    const width = mode === 'custom'
                        ? Math.max(360, Math.min(1200, Number(settings.desktopDescriptionWidthPx) || 720))
                        : (widths[mode] || 720);
                    return width + 'px';
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
                getSeasonOptions(...args) {
                    return window.PerdePlayerControls?.getSeasonOptions.apply(this, args) || [];
                },
                getEpisodesForSeason(...args) {
                    return window.PerdePlayerControls?.getEpisodesForSeason.apply(this, args) || [];
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
                getEpisodeTracking(...args) {
                    return window.PerdePlayerControls?.getEpisodeTracking.apply(this, args);
                },
                saveEpisodeTracking(...args) {
                    return window.PerdePlayerControls?.saveEpisodeTracking.apply(this, args);
                },
                isEpisodeWatched(...args) {
                    return window.PerdePlayerControls?.isEpisodeWatched.apply(this, args);
                },
                getWatchedEpisodeCount(...args) {
                    return window.PerdePlayerControls?.getWatchedEpisodeCount.apply(this, args);
                },
                getSeasonProgress(...args) {
                    return window.PerdePlayerControls?.getSeasonProgress.apply(this, args);
                },
                getLastWatchedEpisode(...args) {
                    return window.PerdePlayerControls?.getLastWatchedEpisode.apply(this, args);
                },
                toggleEpisodeWatched(...args) {
                    return window.PerdePlayerControls?.toggleEpisodeWatched.apply(this, args);
                },
                continueLastWatchedEpisode(...args) {
                    return window.PerdePlayerControls?.continueLastWatchedEpisode.apply(this, args);
                },

                goToNextEpisode(...args) {
                    return window.PerdePlayerControls?.goToNextEpisode.apply(this, args);
                },

                getSelectedEpisodeWatchUrl(...args) {
                    return window.PerdePlayerControls?.getSelectedEpisodeWatchUrl.apply(this, args);
                },

                getPlaybackProgressKey() {
                    if (this.selectedItem?.type === 'tv') {
                        return String(this.selectedItem.id) + ':s' + Number(this.selectedSeason) + 'e' + Number(this.selectedEpisode);
                    }
                    return this.selectedItem?.id;
                },

                selectEpisode(epNum) {
                    return window.PerdePlayerControls?.selectEpisode.call(this, epNum);
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
                tapSeekPulse: false,
                lastSeekTap: null,
                lastSeekTapTimer: null,
                cinemaMode: false,
                cinemaNoticeVisible: false,
                cinemaNoticeTimer: null,
                playbackFeedback: '',
                playbackFeedbackVisible: false,
                pauseNoticeVisible: false,
                playbackFeedbackTimer: null,

                toggleCinemaMode(...args) {
                    return window.PerdePlayerControls?.toggleCinemaMode.apply(this, args);
                },

                setPlaybackRate(rate) {
                    return window.PerdePlayerControls?.setPlaybackRate.call(this, rate);
                },

                applyPlaybackRate(...args) {
                    return window.PerdePlayerControls?.applyPlaybackRate.apply(this, args);
                },

                toggleCaptions(...args) {
                    return window.PerdePlayerControls?.toggleCaptions.apply(this, args);
                },

                cycleAudioTrack(...args) {
                    return window.PerdePlayerControls?.cycleAudioTrack.apply(this, args);
                },

                handlePlayerKeydown(...args) {
                    return window.PerdePlayerControls?.handlePlayerKeydown.apply(this, args);
                },

                schedulePlayerSideControls(...args) {
                    return window.PerdePlayerControls?.schedulePlayerSideControls.apply(this, args);
                },

                revealPlayerSideControls(...args) {
                    return window.PerdePlayerControls?.revealPlayerSideControls.apply(this, args);
                },

                showPlayerControls(...args) {
                    return window.PerdePlayerControls?.showPlayerControls.apply(this, args);
                },

                schedulePlayerControlsHide(...args) {
                    return window.PerdePlayerControls?.schedulePlayerControlsHide.apply(this, args);
                },

                hidePlayerControlsOnLeave(...args) {
                    return window.PerdePlayerControls?.hidePlayerControlsOnLeave.apply(this, args);
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
                    return window.PerdePlayerControls?.startPlayback.call(this);
                },

                showPlaybackFeedback(...args) {
                    return window.PerdePlayerControls?.showPlaybackFeedback.apply(this, args);
                },

                togglePlay(...args) {
                    return window.PerdePlayerControls?.togglePlay.apply(this, args);
                },

                updateVideoProgress() {
                    return window.PerdePlayerControls?.updateVideoProgress.call(this);
                },

                seekVideo(event) {
                    return window.PerdePlayerControls?.seekVideo.call(this, event);
                },

                skipTime(...args) {
                    return window.PerdePlayerControls?.skipTime.apply(this, args);
                },

                handleSeekTap(...args) {
                    return window.PerdePlayerControls?.handleSeekTap.apply(this, args);
                },

                handleDoubleTapSeek(direction, event) {
                    return window.PerdePlayerControls?.handleDoubleTapSeek.call(this, direction, event);
                },

                skipIntro(...args) {
                    return window.PerdePlayerControls?.skipIntro.apply(this, args);
                },

                setVideoBrightness(...args) {
                    return window.PerdePlayerControls?.setVideoBrightness.apply(this, args);
                },

                setVideoVolume(...args) {
                    return window.PerdePlayerControls?.setVideoVolume.apply(this, args);
                },

                toggleMute(...args) {
                    return window.PerdePlayerControls?.toggleMute.apply(this, args);
                },

                toggleFullscreen(...args) {
                    return window.PerdePlayerControls?.toggleFullscreen.apply(this, args);
                },

                formatTime(seconds) {
                    const m = Math.floor(seconds / 60);
                    const s = Math.floor(seconds % 60);
                    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
                },

                scrollCast(...args) {
                    return window.PerdeWatchPage?.scrollCast.apply(this, args);
                },

                scrollSimilar(...args) {
                    return window.PerdeWatchPage?.scrollSimilar.apply(this, args);
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
                    return window.PerdePlayerControls?.saveMovieProgress.call(this, itemId, progress);
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

                // Kütüphane geçmişi ve devam işlemleri yalnızca Kütüphanem rotasında yüklenen modüle devredilir.
                get libraryHistoryItems() {
                    return window.PerdeLibraryPage?.getLibraryHistoryItems.call(this) || [];
                },

                resumeLibraryItem(entry) {
                    return window.PerdeLibraryPage?.resumeLibraryItem.call(this, entry);
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
                // Video bağlantıları sayfası için yalnızca en az bir oynatma URL'si bulunan kayıtları listeler.
                get watchableCatalog() {
                    return this.catalog.filter(item => item && (
                        String(item.watchUrl || '').trim() ||
                        Object.values(item.episodeWatchUrls || {}).some(url => typeof url === 'string' && url.trim())
                    ));
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
                get personalizedRecommendationModes() {
                    const config=this.homepageConfig?.personalizedSection||{};
                    const defaults={taste:'Zevkime Uygun',surprise:'Beni Şaşırt',series:'Yeni Diziler',gems:'Gizli Hazineler'};const labels={...defaults,...(config.discoveryModeLabels||{})};
                    const valid=['taste','surprise','series','gems'];
                    const order=Array.isArray(config.discoveryModeOrder)?config.discoveryModeOrder:[];
                    return [...order.filter((mode,index)=>valid.includes(mode)&&order.indexOf(mode)===index),...valid.filter(mode=>!order.includes(mode))].map(id=>({id,label:labels[id]}));
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
                    const sectionRules=this.homepageConfig?.personalizedSection||{};
                    const defaults={taste:{mediaType:'all',minRating:0,maxRating:10,minYear:1900,maxYear:2099,limit:8},surprise:{mediaType:'all',minRating:0,maxRating:10,minYear:1900,maxYear:2099,limit:8},series:{mediaType:'tv',minRating:6.5,maxRating:10,minYear:2015,maxYear:2099,limit:8},gems:{mediaType:'all',minRating:7,maxRating:8.8,minYear:1900,maxYear:2099,limit:8}};
                    const legacy=mode==='gems'?{minRating:sectionRules.gemsMinRating??7,maxRating:sectionRules.gemsMaxRating??8.8,minYear:sectionRules.gemsMinYear??1900,maxYear:sectionRules.gemsMaxYear??2099}:{};
                    const rules={...defaults[mode],...legacy,...(sectionRules.personalizedRules?.[mode]||{})};
                    if(mode==='series')rules.mediaType='tv';
                    const minRating=Math.max(0,Math.min(10,Number(rules.minRating)||0));
                    const maxRating=Math.max(minRating,Math.min(10,Number(rules.maxRating??10)));
                    const minYear=Math.max(1900,Math.min(2099,Number(rules.minYear??1900)));
                    const maxYear=Math.max(minYear,Math.min(2099,Number(rules.maxYear??2099)));
                    pool=pool.filter(item=>{
                        const type=item.type==='tv'||item.type==='series'?'tv':'movie';
                        const rating=Number(item.rating)||0,year=Number(item.year)||0;
                        const typeMatch=rules.mediaType==='all'||rules.mediaType===type;
                        const ratingMatch=!rating||(rating>=minRating&&rating<=maxRating);
                        const yearMatch=!year||(year>=minYear&&year<=maxYear);
                        return typeMatch&&ratingMatch&&yearMatch;
                    });
                    if(mode==='series')pool.sort((a,b)=>(Number(b.year)||0)-(Number(a.year)||0)||(Number(b.rating)||0)-(Number(a.rating)||0));
                    else if(mode==='gems')pool.sort((a,b)=>(Number(b.rating)||0)-(Number(a.rating)||0)||(Number(b.year)||0)-(Number(a.year)||0));
                    else if(mode==='surprise'){
                        const seed=this.recommendationRefreshIndex+1;
                        const hash=value=>{let result=seed*2654435761;for(const char of String(value))result=Math.imul(result^char.charCodeAt(0),16777619);return result>>>0;};
                        pool.sort((a,b)=>hash(a.id)-hash(b.id));
                    }else pool.sort((a,b)=>(Number(b.rating)||0)-(Number(a.rating)||0));
                    if(!pool.length)pool=[...base];
                    const offset=(this.recommendationRefreshIndex*5)%pool.length;
                    const limit=Math.max(4,Math.min(20,Number(rules.limit)||8));
                    const value=(mode==='surprise'?pool:pool.slice(offset).concat(pool.slice(0,offset))).slice(0,limit);
                    this.recommendationDisplayCache = { base, mode: this.recommendationMode, rotation: this.recommendationRefreshIndex, value };
                    return value;
                },

                reviews: (() => { const value = safeStorageRead('cine_reviews', {}); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; })(),

                getReviews(...args) {
                    return window.PerdeWatchPage?.getReviews.apply(this, args) || [];
                },

                submitReview(...args) {
                    return window.PerdeWatchPage?.submitReview.apply(this, args);
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

                getRouteSlug(value) {
                    return this.normalizeSearchText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                },

                getItemRouteAliases(item) {
                    return [...new Set([
                        item?.title, item?.tmdbTitle, item?.name,
                        item?.originalTitle, item?.tmdbOriginalTitle, item?.original_title,
                        item?.original_name, item?.tmdb?.original_title, item?.tmdb?.original_name,
                        item?.englishTitle, item?.tmdbEnglishTitle, item?.english_title
                    ].map(value => this.getRouteSlug(value || '')).filter(Boolean))];
                },

                getItemRouteTitle(item) {
                    if (!item) return '';
                    const countryValues = [item.country, item.tmdbCountries, item.productionCountries, item.production_countries]
                        .flatMap(value => Array.isArray(value) ? value : [value])
                        .filter(Boolean)
                        .map(value => typeof value === 'object' ? (value.iso_3166_1 || value.name || '') : String(value))
                        .join(' ').toLocaleLowerCase('en-US');
                    const isTurkishProduction = /(^|[\\s,;])tr([\\s,;]|$)/i.test(countryValues) ||
                        /turkey|türkiye|turkiye/.test(countryValues) ||
                        String(item.originalLanguage || item.original_language || '').toLowerCase() === 'tr';
                    if (isTurkishProduction) {
                        return item.title || item.tmdbTitle || item.name || item.originalTitle || item.tmdbOriginalTitle || '';
                    }

                    const original = item.originalTitle || item.tmdbOriginalTitle || item.original_title ||
                        item.original_name || item.tmdb?.original_title || item.tmdb?.original_name || '';
                    // Latin harfli özgün adları (La Casa de Papel gibi) İngilizce çeviriye tercih et.
                    if (original && /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(original)) return original;

                    return item.englishTitle || item.tmdbEnglishTitle || item.english_title ||
                        original || item.title || item.tmdbTitle || item.name || '';
                },

                getItemRouteSlug(item) {
                    const manualSlug = this.getRouteSlug(item?.routeSlug || '');
                    if (manualSlug && !/^\d+$/.test(manualSlug)) return manualSlug;
                    const titleSlug = entry => {
                        const preferred = this.getRouteSlug(this.getItemRouteTitle(entry));
                        if (preferred && !/^\\d+$/.test(preferred)) return preferred;
                        const aliases = this.getItemRouteAliases(entry);
                        return aliases.find(alias => !/^\\d+$/.test(alias)) ||
                            this.getRouteSlug(entry?.title || entry?.tmdbTitle || entry?.name || '') || '';
                    };
                    const base = titleSlug(item) || 'isimsiz-yapim';
                    const type = item?.type === 'tv' || item?.type === 'series' ? 'tv' : 'movie';
                    const matches = (this.catalog || []).filter(entry =>
                        (entry.type === 'tv' || entry.type === 'series' ? 'tv' : 'movie') === type &&
                        titleSlug(entry) === base
                    );
                    if (matches.length < 2) return base;
                    const year = String(item?.year || '').trim();
                    const sameYear = matches.filter(entry => String(entry.year || '').trim() === year);
                    return base + '-' + this.getRouteSlug(sameYear.length > 1 ? item?.id : (year || item?.id || ''));
                },

                updateSelectedWatchRoute(item) {
                    if (this.currentPage !== 'watch' || !item?.id || String(this.selectedItem?.id) !== String(item.id)) return;
                    const nextHash = this.getRouteHash('watch', item);
                    if (window.location.hash === nextHash) return;
                    const currentState = window.history.state && typeof window.history.state === 'object' ? window.history.state : {};
                    window.history.replaceState(currentState, '', window.location.pathname + window.location.search + nextHash);
                },

                getDirectorNames(value) {
                    const values = Array.isArray(value) ? value : [value];
                    return [...new Set(values.flatMap(entry => String(entry || '').split(/[,;|/]+/))
                        .map(name => name.trim()).filter(Boolean))];
                },

                getCatalogPeople(kind) {
                    const people = [];
                    const seen = new Set();
                    (this.catalog || []).forEach(item => {
                        if (kind === 'director') {
                            this.getDirectorNames(item.tmdbDirector || item.director).forEach(name => {
                                const key = this.normalizeSearchText(name);
                                if (key && !seen.has(key)) { seen.add(key); people.push({ name, id: null }); }
                            });
                            return;
                        }
                        const cast = Array.isArray(item.tmdbCast) && item.tmdbCast.length ? item.tmdbCast : (Array.isArray(item.cast) ? item.cast : []);
                        cast.forEach(person => {
                            const name = String(typeof person === 'string' ? person : (person?.name || '')).trim();
                            if (!name) return;
                            const id = typeof person === 'object' && person?.id ? String(person.id) : '';
                            const key = this.normalizeSearchText(name) + ':' + id;
                            if (!seen.has(key)) {
                                seen.add(key);
                                people.push({ ...(typeof person === 'object' ? person : {}), name, id: id || null });
                            }
                        });
                    });
                    return people;
                },

                getPersonRouteSlug(person, kind) {
                    const base = this.getRouteSlug(person?.name || '');
                    if (!base) return person?.id ? (kind === 'director' ? 'yonetmen-' : 'oyuncu-') + String(person.id) : '';
                    const matches = this.getCatalogPeople(kind).filter(entry => this.getRouteSlug(entry.name) === base);
                    return matches.length > 1 && person?.id ? base + '-' + String(person.id) : base;
                },

                getPageRouteSlug(page) {
                    const routes = {
                        home: 'ana-sayfa',
                        explore: 'kesfet',
                        movies: 'filmler',
                        series: 'diziler',
                        turkish: 'yerli-yapimlar',
                        'video-links': 'fragmanlar',
                        library: 'kutuphanem',
                        watchlist: 'izleme-listem',
                        stats: 'istatistikler',
                        franchises: 'seriler'
                    };
                    return routes[page] || page || 'ana-sayfa';
                },

                getRouteHash(page = this.currentPage, item = this.selectedItem) {
                    if (page === 'watch' && item?.id) {
                        const type = item.type === 'tv' || item.type === 'series' ? 'Dizi' : 'Film';
                        return '#/' + type + '/' + encodeURIComponent(this.getItemRouteSlug(item));
                    }
                    if (page === 'franchise' && item?.id) return '#/franchise/' + encodeURIComponent(item.id);
                    if (page === 'actor' && this.selectedActor?.name) return '#/Oyuncu/' + encodeURIComponent(this.getPersonRouteSlug(this.selectedActor, 'actor'));
                    if (page === 'director' && this.selectedActor?.name) return '#/Yonetmen/' + encodeURIComponent(this.getPersonRouteSlug(this.selectedActor, 'director'));
                    return '#/' + encodeURIComponent(this.getPageRouteSlug(page));
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

                async restoreRouteFromUrl() {
                    const hash = window.location.hash || '';
                    const decodePart = value => { try { return decodeURIComponent(value); } catch (_) { return value; } };
                    const legacyActor = hash.match(/^#\/actor\/(\d+)$/i);
                    if (legacyActor) { this.openActorProfile({ id: Number(legacyActor[1]), name: 'Oyuncu' }, false); return; }
                    const legacyDirector = hash.match(/^#\/director\/(\d+)$/i);
                    if (legacyDirector) { this.openDirectorProfile({ id: Number(legacyDirector[1]), name: 'Yönetmen' }, false); return; }

                    const titleRoute = hash.match(/^#\/(film|dizi)\/([^/?#]+)$/i);
                    if (titleRoute) {
                        const type = titleRoute[1].toLocaleLowerCase('tr-TR') === 'dizi' ? 'tv' : 'movie';
                        const slug = this.getRouteSlug(decodePart(titleRoute[2]));
                        let item = (this.catalog || []).find(entry =>
                            (entry.type === 'tv' || entry.type === 'series' ? 'tv' : 'movie') === type &&
                            (this.getItemRouteSlug(entry) === slug || this.getItemRouteAliases(entry).includes(slug))
                        );
                        // Paylaşılan İngilizce URL henüz katalogda önbelleklenmemişse TMDB İngilizce aramasıyla kaydı bul.
                        if (!item && slug) {
                            try {
                                const query = decodePart(titleRoute[2]).replace(/-/g, ' ');
                                const results = await this.fetchTmdb('search/' + (type === 'tv' ? 'tv' : 'movie') + '?query=' + encodeURIComponent(query), 'en-US');
                                const match = (results.results || []).find(result => this.getRouteSlug(result.title || result.name || '') === slug);
                                if (match) item = (this.catalog || []).find(entry => String(entry.tmdbId || '') === String(match.id));
                            } catch (error) {
                                console.warn('İngilizce yapım bağlantısı çözümlenemedi:', error);
                            }
                        }
                        if (item) { this.openWatchPage(item, false); return; }
                    }

                    const personRoute = hash.match(/^#\/(oyuncu|yonetmen)\/([^/?#]+)$/i);
                    if (personRoute) {
                        const kind = personRoute[1].toLocaleLowerCase('tr-TR') === 'oyuncu' ? 'actor' : 'director';
                        const rawSlug = decodePart(personRoute[2]);
                        const slug = this.getRouteSlug(rawSlug);
                        const idFallback = rawSlug.match(/^(?:oyuncu|yonetmen)-(\d+)$/i);
                        if (idFallback) {
                            const id = Number(idFallback[1]);
                            if (kind === 'actor') this.openActorProfile({ id, name: 'Oyuncu' }, false);
                            else this.openDirectorProfile({ id, name: 'Yönetmen' }, false);
                            return;
                        }
                        if (kind === 'actor') {
                            try { await this.loadCatalogCastData(); }
                            catch (error) { console.warn('Oyuncu kataloğu bağlantı için yüklenemedi:', error); }
                        }
                        let person = this.getCatalogPeople(kind).find(entry => {
                            const base = this.getRouteSlug(entry.name);
                            return slug === base || (entry.id && slug === base + '-' + String(entry.id));
                        });
                        if (person) {
                            if (kind === 'director') { this.openDirectorProfile({ ...person, id: person.id ? Number(person.id) : null }, false); return; }
                            if (!person.id) {
                                try {
                                    const result = await this.fetchTmdb('search/person?query=' + encodeURIComponent(person.name));
                                    person = (result.results || []).find(entry => this.normalizeSearchText(entry.name) === this.normalizeSearchText(person.name)) || person;
                                } catch (error) { console.warn('Oyuncu profili aranamadı:', error); }
                            }
                            if (person.id) { this.openActorProfile({ ...person, id: Number(person.id) }, false); return; }
                        }
                    }

                    const franchise = hash.match(/^#\/franchise\/([^/?#]+)$/);
                    if (franchise) { this.openFranchise(decodePart(franchise[1]), false); return; }
                    const legacyWatch = hash.match(/^#\/watch\/(.+)$/);
                    if (legacyWatch) {
                        const id = decodePart(legacyWatch[1]);
                        const item = (this.catalog || []).find(entry => String(entry.id) === id);
                        if (item) { this.openWatchPage(item, false); return; }
                    }

                    const pageMatch = hash.match(/^#\/([^/?#]+)$/);
                    const route = pageMatch ? decodePart(pageMatch[1]) : 'ana-sayfa';
                    const pageAliases = {
                        'ana-sayfa': 'home', home: 'home',
                        kesfet: 'explore', explore: 'explore',
                        filmler: 'movies', movies: 'movies',
                        diziler: 'series', series: 'series',
                        'yerli-yapimlar': 'turkish', turkish: 'turkish',
                        fragmanlar: 'video-links', 'video-links': 'video-links',
                        kutuphanem: 'library', library: 'library',
                        'izleme-listem': 'watchlist', watchlist: 'watchlist',
                        istatistikler: 'stats', stats: 'stats',
                        seriler: 'franchises', franchises: 'franchises'
                    };
                    const page = pageAliases[route] || 'home';
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
                async openActorProfile(actor, updateUrl = true) { await window.perdeEnsurePageScript?.('people'); return window.PerdePeople?.openActorProfile.call(this, actor, updateUrl); },
                async resolveDirectorPerson(actor) { await window.perdeEnsurePageScript?.('people'); return window.PerdePeople?.resolveDirectorPerson.call(this, actor); },
                async openDirectorProfile(actor, updateUrl = true) { await window.perdeEnsurePageScript?.('people'); return window.PerdePeople?.openDirectorProfile.call(this, actor, updateUrl); },






                openActorCredit(...args) { return window.PerdePeople?.openActorCredit.apply(this, args); },
                formatActorDate(...args) { return window.PerdePeople?.formatActorDate.apply(this, args) || ''; },
                formatActorDeathInfo(...args) { return window.PerdePeople?.formatActorDeathInfo.apply(this, args) || ''; },
                isEnglishBiography(text) {
                    const words = String(text || '').toLowerCase().match(/[a-z']+/g) || [];
                    if (words.length < 12) return false;
                    const markers = new Set(['the','and','was','were','is','are','has','have','had','his','her','he','she','they','their','with','from','for','born','known','career','actor','actress','director','film','films','television','worked','appeared','studied','began','best','including','who','which','that','in','of','to','on','at','by','as']);
                    const count = words.filter(word => markers.has(word)).length;
                    return count >= 3 && count / words.length >= 0.035;
                },
                async translateSelectedBiography() { await window.perdeEnsurePageScript?.('people'); return window.PerdePeople?.translateSelectedBiography.call(this); },




                openWatchPage(item, updateUrl = true) {
                    this.selectedItem = item;
                    this.loadCatalogDetailsData(item.id);
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

                openRelatedDiscoveries(...args) {
                    return window.PerdeWatchPage?.openRelatedDiscoveries.apply(this, args);
                },

                get availableGenres() {
                    return window.PerdeDiscovery?.getAvailableGenres.call(this) || [];
                },
                get availableCountries() {
                    return window.PerdeDiscovery?.getAvailableCountries.call(this) || [];
                },
                get availablePlatforms() {
                    return window.PerdeDiscovery?.getAvailablePlatforms.call(this) || [];
                },

                setDiscoveryMood(mood) {
                    const allowed = ['all','feelgood','thriller','comedy','emotional','mind','family','top'];
                    if (!allowed.includes(mood)) return;
                    this.discoveryMood = mood;
                },

                resetDiscoveryFilters() {
                    return window.PerdeDiscovery?.resetDiscoveryFilters.call(this);
                },

                get viewingStats() {
                    return window.PerdeStats?.getViewingStats?.call(this) || {
                        completedMovies: 0, inProgressMovies: 0, watchedEpisodes: 0,
                        savedTimeLabel: '0 dk', progressItems: [], topGenres: [],
                        trackedSeries: 0, totalTracked: 0, watchlistCount: 0,
                        monthlyActivity: [], contentBreakdown: []
                    };
                },
                getSimilarItems(item) {
                    return window.PerdeWatchRecommendations?.getSimilarItems.call(this, item) || [];
                },
                // Öneri modülündeki getter'ları ana Alpine kapsamına bağla; modülerleştirme sonrası
                // ana sayfa şablonlarının doğrudan kullandığı veri erişimini koru.
                get personalizedRecommendations() {
                    const module = window.PerdeWatchRecommendations;
                    return module ? Object.getOwnPropertyDescriptor(module, 'personalizedRecommendations')?.get?.call(this) || [] : [];
                },
                get homeDiscoveryGenres() {
                    const module = window.PerdeWatchRecommendations;
                    return module ? Object.getOwnPropertyDescriptor(module, 'homeDiscoveryGenres')?.get?.call(this) || [] : [];
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

                get discoveryCurrentItem() {
                    const currentId = String(this.discoveryCurrentItemId || '');
                    return currentId ? this.sortedFilteredCatalog.find(item => String(item.id ?? item.title ?? '') === currentId) || null : null;
                },
                initializeDiscovery() {
                    this.loadCatalogDescriptionsData();
                    return window.PerdeDiscovery?.initializeDiscovery.call(this);
                },
                pickAnotherDiscovery() {
                    return window.PerdeDiscovery?.pickAnotherDiscovery.call(this);
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

                refreshDiscoveryShowcase() {
                    return window.PerdeDiscovery?.refreshDiscoveryShowcase.call(this);
                },
                get discoveryShowcaseItems() {
                    return window.PerdeDiscovery?.getDiscoveryShowcaseItems.call(this) || [];
                },
                get discoveryListCatalog() {
                    return window.PerdeDiscovery?.getDiscoveryListCatalog.call(this) || [];
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
    