
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

        function ultimateProApp() {
            return {
                getTmdbImageSrcSet(url, widths = [185, 342, 500]) {
                    if (typeof url !== 'string') return '';
                    const match = url.match(/^(https:\/\/image\.tmdb\.org\/t\/p\/)(?:w\d+|original)(\/.*)$/);
                    if (!match) return '';
                    return widths.map(width => `${match[1]}w${width}${match[2]} ${width}w`).join(', ');
                },

                handleImageError(event) {
                    const image = event && event.target;
                    if (!image || image.dataset.perdeFallbackApplied) return;
                    image.dataset.perdeFallbackApplied = 'true';
                    const placeholder = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 480"><rect width="320" height="480" fill="#171923"/><g fill="none" stroke="#555b6b" stroke-width="8"><rect x="104" y="176" width="112" height="84" rx="10"/><path d="m116 244 34-35 24 22 18-18 20 24"/></g><text x="160" y="310" fill="#9ca3af" font-size="18" text-anchor="middle" font-family="Arial,sans-serif">Görsel yok</text></svg>';
                    image.src = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(placeholder);
                },
                currentPage: 'home',
                searchQuery: '',
                quickFilter: 'all',
                sortBy: 'default',
                discoveryType: 'all',
                discoveryMood: 'all',
                discoveryGenre: 'all',
                discoveryCountry: 'all',
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
                
                theme: ['ivory','slate','dark'].includes(safeStorageRead('cine_theme_v3','ivory')) ? safeStorageRead('cine_theme_v3','ivory') : 'ivory',
                
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
                collections: [],
                homepageConfig: null,
                watchPageConfig: null,
                heroAutoplayTimer: null,
                heroPaused: false,
                catalogLoading: true,
                catalogError: null,
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

                async init() {
                    try {
                        const response = await fetch('./filmvediziler.json', { cache: 'default' });
                        if (!response.ok) {
                            throw new Error('Katalog dosyası yüklenemedi (HTTP ' + response.status + ')');
                        }

                        const data = await response.json();
                        this.homepageConfig = data && typeof data === 'object' ? (data.homepageConfig || null) : null;
                        this.collections = Array.isArray(data?.collections) ? data.collections : [];
                        this.watchPageConfig = data && typeof data === 'object' ? (data.watchPageConfig || null) : null;
                        const sourceCatalog = Array.isArray(data) ? data : (data && typeof data === 'object' ? data.catalog : null);

                        if (!Array.isArray(sourceCatalog)) {
                            throw new Error('JSON dosyasında geçerli bir catalog listesi bulunamadı.');
                        }

                        const validCatalog = sourceCatalog.filter(item => item && typeof item === 'object' && !Array.isArray(item) && (item.id != null || item.tmdbId != null || item.title || item.tmdbTitle || item.originalTitle));
                        if (!validCatalog.length) throw new Error('Katalogda kullanılabilir bir film veya dizi kaydı bulunamadı.');
                        if (validCatalog.length !== sourceCatalog.length) console.warn('Geçersiz katalog kayıtları atlandı:', sourceCatalog.length - validCatalog.length);
                        this.catalog = validCatalog.map((item) => {
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
                        });

                        this.currentSlideIndex = 0;
                        this.startHeroAutoplay();
                        this.restoreRouteFromUrl();
                    } catch (error) {
                        this.catalogError = error.message || 'Bilinmeyen katalog hatası';
                        console.error('Perde katalog yükleme hatası:', error);
                    } finally {
                        this.catalogLoading = false;
                        this.$nextTick(() => {
                            document.getElementById('hero-initial-shell')?.remove();
                        });
                    }
                },

                get heroSlides() {
                    const configured = this.homepageConfig?.heroSlides;
                    if (!Array.isArray(configured) || !configured.length) return this.catalog;
                    const byId = new Map(this.catalog.map(item => [String(item.id), item]));
                    const selected = configured.filter(entry => entry && entry.active !== false)
                        .map(entry => byId.get(String(entry.id))).filter(Boolean);
                    return selected.length ? selected : this.catalog;
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
                    if (this.heroAutoplayTimer) window.clearInterval(this.heroAutoplayTimer);
                    const settings = this.homepageConfig?.settings || {};
                    if (settings.autoplay === false || this.heroSlides.length < 2) return;
                    const seconds = Math.max(2, Math.min(60, Number(settings.interval) || 6));
                    this.heroAutoplayTimer = window.setInterval(() => {
                        if (this.heroPaused || document.hidden || this.heroSlides.length < 2) return;
                        this.currentSlideIndex = (this.currentSlideIndex + 1) % this.heroSlides.length;
                    }, seconds * 1000);
                },

                setHeroPaused(value) {
                    this.heroPaused = !!value;
                },

                get currentHero() {
                    return this.heroSlides[this.currentSlideIndex] || this.heroSlides[0] || {
                        id: 'archive-1',
                        title: 'Kıyamet Z: Yeni Dünya',
                        type: 'movie',
                        backdrop: 'https://image.tmdb.org/t/p/w1280/o3XwuDUj0n8qnK91p6q8LKfr6rj.jpg',
                        poster: 'https://image.tmdb.org/t/p/w500/mUcJtoyGnYbYNmeIuZASUJfyj3x.jpg',
                        rating: '6.1',
                        year: '2026',
                        genre: 'Aksiyon',
                        starring: '',
                        desc: "TSJ virüsü salgınının ardından Kanarya Adaları Avrupa'nın son sığınağı hâline gelmiştir. Erzak bulmak için Madrid'e giden bir ekibe Roberto da şüpheli amaçlarla katılır. Enfektelerin kuşattığı ve aralarındaki bağ sarsılmış olan ekip zorlu bir ahlaki ikilemle yüzleşmek zorunda kalır. Kendilerini mi kurtaracaklar yoksa insanlıktan geriye kalanı korumak için her şeyi riske mi atacaklar?"
                    };
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
                    const key = this.currentProfileId + ':' + (this.selectedItem?.id || '');
                    const tracking = all[key];
                    return tracking && typeof tracking === 'object' && !Array.isArray(tracking) ? { watched: tracking.watched && typeof tracking.watched === 'object' ? tracking.watched : {}, last: tracking.last ?? null } : { watched: {}, last: null };
                },

                saveEpisodeTracking(tracking) {
                    const stored = safeStorageRead('cine_episode_tracking_v1', {});
                    const all = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
                    const key = this.currentProfileId + ':' + (this.selectedItem?.id || '');
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
                        this.selectedEpisode = next.number;
                        this.currentEpisodePage = Math.floor((next.number - 1) / 8) + 1;
                    } else {
                        const nextSeason = this.selectedSeason + 1;
                        const nextSeasonEpisodes = this.getEpisodesForSeason(nextSeason);
                        if (nextSeasonEpisodes.length) {
                            this.selectedSeason = nextSeason;
                            this.selectedEpisode = nextSeasonEpisodes[0].number;
                            this.currentEpisodePage = 1;
                        }
                    }
                },

                selectEpisode(epNum) {
                    this.selectedEpisode = epNum;
                    const video = document.getElementById('customVideoPlayer');
                    if (video && this.isDirectVideoUrl(this.selectedItem?.watchUrl)) {
                        video.currentTime = 0;
                        video.play().catch(() => { this.playbackError = true; });
                    }
                },
                
                isPlaying: false,
                isMuted: false,
                volumeLevel: 1,
                previousVolumeLevel: 1,
                videoProgress: 0,
                currentTimeFormatted: '00:00',
                durationFormatted: '00:00',
                videoEnded: false,
                playbackError: false,
                hasPlaybackStarted: false,
                playerControlsVisible: true,
                playerControlsTimer: null,
                cinemaMode: false,

                toggleCinemaMode() {
                    this.cinemaMode = !this.cinemaMode;
                    if (this.cinemaMode) {
                        this.playerControlsVisible = true;
                        this.showPlayerControls();
                    }
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
                    return this.selectedItem && this.isDirectVideoUrl(this.selectedItem.watchUrl)
                        ? this.selectedItem.watchUrl
                        : '';
                },

                startPlayback() {
                    this.playerControlsVisible = true;
                    this.togglePlay();
                },

                togglePlay() {
                    const video = document.getElementById('customVideoPlayer');
                    if (!video || !this.isDirectVideoUrl(this.selectedItem?.watchUrl)) return;
                    if (video.paused) {
                        video.play().catch(() => { this.playbackError = true; });
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
                            this.saveMovieProgress(this.selectedItem.id, {
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
                    if (!video) return;
                    video.currentTime += seconds;
                },

                skipIntro() {
                    const video = document.getElementById('customVideoPlayer');
                    if (!video) return;
                    video.currentTime += 85;
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

                profiles: [
                    { id: 'pro_1', name: 'Ana Profil', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop' },
                    { id: 'pro_2', name: 'Çocuk Profili', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=200&auto=format&fit=crop' }
                ],
                currentProfileId: ['pro_1','pro_2'].includes(safeStorageRead('cine_active_profile','pro_1')) ? safeStorageRead('cine_active_profile','pro_1') : 'pro_1',

                get currentProfile() {
                    return this.profiles.find(p => p.id === this.currentProfileId) || this.profiles[0];
                },

                // Film ilerlemesi artık profil bazında tutulur. Eski ortak kayıtlar korunur,
                // ancak hangi profile ait oldukları bilinmediği için önerilere dahil edilmez.
                get profileMovieProgress() {
                    try {
                        const all = safeStorageRead('perde_profile_player_progress_v1', {});
                        if (!all || typeof all !== 'object' || Array.isArray(all)) return {};
                        const current = all[this.currentProfileId];
                        return current && typeof current === 'object' ? current : {};
                    } catch (error) {
                        console.warn('Profil izleme geçmişi okunamadı:', error);
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
                        const stored = safeStorageRead('perde_profile_player_progress_v1', {});
                        const all = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
                        if (!all[this.currentProfileId] || typeof all[this.currentProfileId] !== 'object' || Array.isArray(all[this.currentProfileId])) {
                            all[this.currentProfileId] = {};
                        }
                        all[this.currentProfileId][String(itemId)] = progress;
                        safeStorageWrite('perde_profile_player_progress_v1', all);
                    } catch (error) {
                        console.warn('Profil izleme ilerlemesi kaydedilemedi:', error);
                    }
                },

                switchProfile(id) {
                    if (!this.profiles.some(profile => profile.id === id)) return;
                    this.currentProfileId = id;
                    safeStorageWrite('cine_active_profile', id);
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
                    const prefix = this.currentProfileId + ':';
                    return Object.entries(all).filter(([key]) => key.startsWith(prefix)).map(([key, tracking]) => {
                        const itemId = key.slice(prefix.length);
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

                get watchlist() {
                    const storedLists = safeStorageRead('cine_profile_watchlists', {});
                    const allLists = storedLists && typeof storedLists === 'object' && !Array.isArray(storedLists) ? storedLists : {};
                    const list = allLists[this.currentProfileId];
                    return Array.isArray(list) ? list.filter(item => item && typeof item === 'object' && item.id != null) : [];
                },
                get currentWatchlist() {
                    return this.watchlist;
                },

                toggleWatchlist(item) {
                    const storedLists = safeStorageRead('cine_profile_watchlists', {});
                    const allLists = storedLists && typeof storedLists === 'object' && !Array.isArray(storedLists) ? storedLists : {};
                    if (!Array.isArray(allLists[this.currentProfileId])) allLists[this.currentProfileId] = [];
                    const list = allLists[this.currentProfileId];
                    const index = list.findIndex(m => m && String(m.id) === String(item.id));
                    if (index > -1) {
                        list.splice(index, 1);
                    } else {
                        list.push(item);
                    }
                    safeStorageWrite('cine_profile_watchlists', allLists);
                },

                isInWatchlist(item) {
                    return this.watchlist.some(m => m && String(m.id) === String(item.id));
                },

                get recommendationFeedback() {
                    const all = safeStorageRead('cine_recommendation_feedback_v1', {});
                    const own = all && typeof all === 'object' && !Array.isArray(all) ? all[this.currentProfileId] : [];
                    return Array.isArray(own) ? [...new Set(own.map(String))] : [];
                },

                dismissRecommendation(item) {
                    if (!item || item.id == null) return;
                    const stored = safeStorageRead('cine_recommendation_feedback_v1', {});
                    const all = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
                    const own = Array.isArray(all[this.currentProfileId]) ? all[this.currentProfileId].map(String) : [];
                    const id = String(item.id);
                    if (!own.includes(id)) own.push(id);
                    all[this.currentProfileId] = own.slice(-200);
                    safeStorageWrite('cine_recommendation_feedback_v1', all);
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

                getRouteHash(page = this.currentPage, item = this.selectedItem) {
                    if (page === 'watch' && item?.id) return '#/watch/' + encodeURIComponent(item.id);
                    if (page === 'actor' && this.selectedActor?.id) return '#/actor/' + encodeURIComponent(this.selectedActor.id);
                    if (page === 'director' && this.selectedActor?.id) return '#/director/' + encodeURIComponent(this.selectedActor.id);
                    return '#/' + encodeURIComponent(page || 'home');
                },

                syncRouteToUrl(page = this.currentPage, item = this.selectedItem) {
                    const nextHash = this.getRouteHash(page, item);
                    if (window.location.hash !== nextHash) {
                        window.history.replaceState(null, '', window.location.pathname + window.location.search + nextHash);
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
                    const allowedPages = ['home', 'explore', 'video-links', 'library', 'watchlist', 'stats'];
                    this.currentPage = allowedPages.includes(page) ? page : 'home';
                    this.syncRouteToUrl(this.currentPage, null);
                },

                navigateTo(page) {
                    this.currentPage = page;
                    this.syncRouteToUrl(page, null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
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
                        const filmography = credits
                            .filter(item => item.id && !seen.has(item.mediaType + ':' + item.id) && seen.add(item.mediaType + ':' + item.id))
                            .sort((a,b) => String(b.release_date || b.first_air_date || '').localeCompare(String(a.release_date || a.first_air_date || '')) || Number(b.popularity || 0) - Number(a.popularity || 0))
                            .slice(0, 48)
                            .map(item => ({
                                id: item.id,
                                type: item.mediaType,
                                title: item.title || item.name || 'İsimsiz yapım',
                                character: item.character || '',
                                year: String(item.release_date || item.first_air_date || '').slice(0,4),
                                poster: item.poster_path ? 'https://image.tmdb.org/t/p/w342' + item.poster_path : '',
                                rating: Number(item.vote_average || 0),
                                genres: (item.genre_ids || []).map(id => ({28:'Aksiyon',12:'Macera',16:'Animasyon',35:'Komedi',80:'Suç',99:'Belgesel',18:'Dram',10751:'Aile',14:'Fantastik',36:'Tarih',27:'Korku',10402:'Müzik',9648:'Gizem',10749:'Romantik',878:'Bilim Kurgu',10770:'TV Filmi',53:'Gerilim',10752:'Savaş',37:'Vahşi Batı',10759:'Aksiyon & Macera',10762:'Çocuk',10763:'Haber',10764:'Reality',10765:'Bilim Kurgu & Fantastik',10766:'Pembe Dizi',10767:'Talk Show',10768:'Savaş & Politika'})[id]).filter(Boolean),
                                overview: item.overview || ''
                            }));
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

                async openDirectorProfile(actor, updateUrl = true) {
                    if (!actor || !actor.id) return;
                    this.selectedActor = { ...actor, id: Number(actor.id) };
                    this.currentPage = 'director';
                    this.actorProfileError = '';
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
                        const filmography = credits
                            .filter(item => item.id && !seen.has(item.mediaType + ':' + item.id) && seen.add(item.mediaType + ':' + item.id))
                            .sort((a,b) => String(b.release_date || b.first_air_date || '').localeCompare(String(a.release_date || a.first_air_date || '')) || Number(b.popularity || 0) - Number(a.popularity || 0))
                            .slice(0, 48)
                            .map(item => ({
                                id: item.id,
                                type: item.mediaType,
                                title: item.title || item.name || 'İsimsiz yapım',
                                character: item.job || 'Yönetmen',
                                year: String(item.release_date || item.first_air_date || '').slice(0,4),
                                poster: item.poster_path ? 'https://image.tmdb.org/t/p/w342' + item.poster_path : '',
                                rating: Number(item.vote_average || 0),
                                genres: (item.genre_ids || []).map(id => ({28:'Aksiyon',12:'Macera',16:'Animasyon',35:'Komedi',80:'Suç',99:'Belgesel',18:'Dram',10751:'Aile',14:'Fantastik',36:'Tarih',27:'Korku',10402:'Müzik',9648:'Gizem',10749:'Romantik',878:'Bilim Kurgu',10770:'TV Filmi',53:'Gerilim',10752:'Savaş',37:'Vahşi Batı',10759:'Aksiyon & Macera',10762:'Çocuk',10763:'Haber',10764:'Reality',10765:'Bilim Kurgu & Fantastik',10766:'Pembe Dizi',10767:'Talk Show',10768:'Savaş & Politika'})[id]).filter(Boolean),
                                overview: item.overview || ''
                            }));
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
                        const savedProgress = this.getMovieProgress(item.id);
                        if (video && savedProgress) {
                            video.currentTime = savedProgress.time || 0;
                        }
                    }, 200);
                },

                normalizeSearchText(value) {
                    return String(value || '').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').trim();
                },

                openRelatedDiscoveries(kind, value) {
                    const selected = String(value || '').trim();
                    if (!selected) return;
                    this.searchQuery = '';
                    this.discoveryType = 'all';
                    this.discoveryMood = 'all';
                    this.discoveryGenre = 'all';
                    this.discoveryCountry = 'all';
                    this.discoveryDirector = '';
                    this.discoveryPlatform = 'all';
                    this.discoveryRating = '0';
                    this.discoveryYearFrom = '';
                    this.discoveryYearTo = '';
                    this.quickFilter = 'all';
                    this.sortBy = 'default';
                    if (kind === 'genre') this.discoveryGenre = selected;
                    if (kind === 'country') this.discoveryCountry = selected;
                    if (kind === 'director') this.discoveryDirector = selected;
                    this.currentPage = 'explore';
                    this.syncRouteToUrl('explore', null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                },

                get availableGenres() {
                    const values = this.catalog.flatMap(item => String(item.category || item.genre || '').split(/[\/;,]/).map(value => value.trim()).filter(Boolean));
                    return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'tr'));
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
                    Object.entries(episodeMap).forEach(([key, value]) => {
                        if (!key.startsWith(this.currentProfileId + ':')) return;
                        const id = key.slice(this.currentProfileId.length + 1);
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
                    const catalogById = new Map(catalog.filter(item => item && item.id != null).map(item => [String(item.id), item]));
                    const normalize = value => this.normalizeSearchText(value);
                    const tokens = value => [...new Set(String(value || '').split(/[\\/;,|]/).map(normalize).filter(Boolean))];
                    const people = item => {
                        const tmdb = Array.isArray(item?.tmdbCast) ? item.tmdbCast.map(person => person?.name) : [];
                        const fallback = Array.isArray(item?.cast) ? item.cast.map(person => typeof person === 'string' ? person : person?.name) : [];
                        return [...new Set([...tmdb, ...fallback].map(normalize).filter(Boolean))];
                    };
                    const safeRead = key => {
                        const value = safeStorageRead(key, {});
                        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
                    };
                    const profileId = String(this.currentProfileId || '');
                    const progress = this.profileMovieProgress;
                    const episodes = safeRead('cine_episode_tracking_v1');
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
                    Object.entries(episodes).forEach(([key, tracking]) => {
                        if (!key.startsWith(profileId + ':')) return;
                        const item = catalogById.get(key.slice(profileId.length + 1));
                        if (!item) return;
                        const watched = tracking?.watched && typeof tracking.watched === 'object' ? tracking.watched : {};
                        const count = Object.values(watched).reduce((sum, list) => sum + (Array.isArray(list) ? new Set(list.map(Number).filter(number => number > 0)).size : 0), 0);
                        const last = tracking?.last || null;
                        if (!count && !last) return;
                        const weight = 1.15 + Math.min(count / 7, 2.4) + recentBoost(last?.updatedAt);
                        const previous = history.get(String(item.id));
                        history.set(String(item.id), { item, weight: Math.max(previous?.weight || 0, weight) });
                    });
                    const watchlistItems = this.watchlist.map(saved => catalogById.get(String(saved.id))).filter(Boolean);
                    watchlistItems.forEach(item => {
                        const id = String(item.id);
                        if (!history.has(id)) history.set(id, { item, weight: 0.85 });
                    });
                    const feedbackIds = this.recommendationFeedback;
                    const feedbackItems = feedbackIds.map(id => catalogById.get(id)).filter(Boolean);
                    const excluded = new Set([...history.keys(), ...this.watchlist.map(item => String(item.id)), ...feedbackIds]);
                    const prefs = {
                        genres: new Map(), types: new Map(), countries: new Map(),
                        directors: new Map(), actors: new Map(),
                        negativeGenres: new Map(), negativeDirectors: new Map(), negativeActors: new Map()
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
                    });
                    feedbackItems.forEach(item => {
                        tokens(item.category || item.genre).forEach(value => add(prefs.negativeGenres, value, 1));
                        tokens(item.director).forEach(value => add(prefs.negativeDirectors, value, 1));
                        people(item).forEach(actor => add(prefs.negativeActors, actor, 1));
                    });
                    const currentYear = new Date().getFullYear();
                    const selectDiverse = ranked => {
                        const remaining = [...ranked];
                        const selected = [];
                        const genreCounts = new Map();
                        const typeCounts = new Map();
                        while (remaining.length && selected.length < 15) {
                            let bestIndex = 0;
                            let bestAdjusted = -Infinity;
                            remaining.forEach((entry, index) => {
                                const genre = entry.primaryGenre || 'diger';
                                const type = entry.item.type || 'unknown';
                                const genreCount = genreCounts.get(genre) || 0;
                                const typeCount = typeCounts.get(type) || 0;
                                const diversityPenalty = Math.max(0, genreCount - 1) * 1.7 + (typeCount >= 9 ? 1.25 : 0);
                                const adjusted = entry.score - diversityPenalty;
                                if (adjusted > bestAdjusted) {
                                    bestAdjusted = adjusted;
                                    bestIndex = index;
                                }
                            });
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
                                score: rating * 0.35 + (year >= currentYear - 4 ? 0.25 : 0),
                                primaryGenre: tokens(item.category || item.genre)[0] || 'diger',
                                reason: 'Arşivden yüksek puanlı'
                            };
                        }).sort((a, b) => b.score - a.score || (Number.parseFloat(b.item.rating) || 0) - (Number.parseFloat(a.item.rating) || 0) || a.item.title.localeCompare(b.item.title, 'tr'));
                        return selectDiverse(coldStart).map(entry => ({ ...entry.item, recommendationReason: entry.reason }));
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
                        const countryMatches = tokens(item.country).map(value => prefs.countries.get(value) || 0).sort((a, b) => b - a);
                        if (countryMatches[0]) push(countryMatches[0] * 0.9, 'Tercih ettiğin ülke sineması');
                        push((prefs.types.get(item.type) || 0) * 0.45, item.type === 'tv' ? 'Dizi tercihine uygun' : 'Film tercihine uygun');
                        const negativeGenre = candidateGenres.reduce((sum, value) => sum + (prefs.negativeGenres.get(value) || 0), 0);
                        const negativeDirector = tokens(item.director).reduce((sum, value) => sum + (prefs.negativeDirectors.get(value) || 0), 0);
                        const negativeActor = people(item).reduce((sum, value) => sum + (prefs.negativeActors.get(value) || 0), 0);
                        const feedbackPenalty = negativeGenre * 0.85 + negativeDirector * 1.1 + Math.min(negativeActor, 3) * 0.3;
                        const rating = Math.max(0, Number.parseFloat(item.rating) || 0);
                        if (rating > 6) push((rating - 6) * 0.42, 'Yüksek puanlı yapım');
                        const year = Number.parseInt(item.year, 10) || 0;
                        const freshness = year >= currentYear - 3 ? 0.25 : year >= currentYear - 8 ? 0.1 : 0;
                        const reason = reasons.sort((a, b) => b.score - a.score)[0]?.label || 'İzleme profiline uygun';
                        return {
                            item,
                            score: Math.max(0, reasons.reduce((sum, entry) => sum + entry.score, 0) + freshness - feedbackPenalty),
                            primaryGenre: candidateGenres[0] || 'diger',
                            reason
                        };
                    }).sort((a, b) => b.score - a.score || (Number.parseFloat(b.item.rating) || 0) - (Number.parseFloat(a.item.rating) || 0) || a.item.title.localeCompare(b.item.title, 'tr'));
                    return selectDiverse(ranked).map(entry => ({ ...entry.item, recommendationReason: entry.reason }));
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
                        const item = this.catalog.find(entry => String(entry.id) === String(id));
                        const seconds = Math.max(0, Number(saved?.time) || 0);
                        if (item && seconds >= 300) addItem(item, 1 + Math.min(seconds / 3600, 2));
                    });
                    const episodeMap = read('cine_episode_tracking_v1');
                    Object.entries(episodeMap).forEach(([key, tracking]) => {
                        if (!key.startsWith(this.currentProfileId + ':')) return;
                        const id = key.slice(this.currentProfileId.length + 1);
                        const item = this.catalog.find(entry => String(entry.id) === String(id));
                        const count = Object.values(tracking?.watched || {}).reduce((sum, list) => sum + (Array.isArray(list) ? new Set(list.map(Number)).size : 0), 0);
                        if (item && count > 0) addItem(item, 1 + Math.min(count / 5, 3));
                    });
                    this.watchlist.forEach(saved => {
                        const item = this.catalog.find(entry => String(entry.id) === String(saved.id));
                        if (item) addItem(item, 1.5);
                    });
                    return [...counts.values()]
                        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'tr'))
                        .slice(0, 4)
                        .map(entry => ({
                            ...entry,
                            label: entry.name.charAt(0).toLocaleUpperCase('tr-TR') + entry.name.slice(1),
                            count: this.catalog.filter(item => String(item.category || item.genre || '').split(/[\\/;,]/).some(value => normalize(value) === entry.name)).length
                        }));
                },

                selectPersonalizedGenre(genre) {
                    this.searchQuery = '';
                    this.discoveryType = 'all';
                    this.discoveryCountry = 'all';
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
                        const moodRules = {
                            feelgood: ['komedi','eğlence','aile','animasyon','romantik','macera','müzik','müzikal','feel good','feelgood'],
                            thriller: ['gerilim','gizem','suç','korku','polisiye','aksiyon','dedektif','psikolojik gerilim','suspense'],
                            comedy: ['komedi','eğlence','mizah','stand up','sitcom','absürt'],
                            emotional: ['dram','romantik','aile','biyografi','tarih','melodram','duygusal'],
                            mind: ['bilim kurgu','gizem','gerilim','fantastik','psikolojik','distopya','zihin','zeka','ters köşe'],
                            family: ['aile','animasyon','çocuk','macera','fantastik','çocuk filmi']
                        };
                        const matchesMood = this.discoveryMood === 'all'
                            || (this.discoveryMood === 'top'
                                ? (Number.parseFloat(item.rating) || 0) >= 7.5
                                : (moodRules[this.discoveryMood] || []).some(term => moodText.includes(this.normalizeSearchText(term))));
                        const genres = String(item.category || item.genre || '').split(/[\/;,]/).map(value => this.normalizeSearchText(value));
                        const selectedGenres = String(this.discoveryGenre || '').split(/[\/;,]/).map(value => this.normalizeSearchText(value)).filter(Boolean);
                        const matchesGenre = this.discoveryGenre === 'all' || selectedGenres.some(genre => genres.includes(genre) || this.normalizeSearchText(item.genre) === genre);
                        const countries = String(item.country || '').split(/[,\/;]/).map(value => this.normalizeSearchText(value));
                        const selectedCountries = String(this.discoveryCountry || '').split(/[,\/;]/).map(value => this.normalizeSearchText(value)).filter(Boolean);
                        const matchesCountry = this.discoveryCountry === 'all' || selectedCountries.some(country => countries.includes(country));
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

                    if (this.sortBy === 'rating') result.sort((a, b) => (Number.parseFloat(b.rating) || 0) - (Number.parseFloat(a.rating) || 0));
                    else if (this.sortBy === 'year') result.sort((a, b) => (Number.parseInt(b.year, 10) || 0) - (Number.parseInt(a.year, 10) || 0));
                    else if (this.sortBy === 'oldest') result.sort((a, b) => (Number.parseInt(a.year, 10) || 9999) - (Number.parseInt(b.year, 10) || 9999));
                    else if (this.sortBy === 'title') result.sort((a, b) => a.title.localeCompare(b.title, 'tr'));
                    return result;
                },

                get homeCatalogPreview() {
                    return this.sortedFilteredCatalog.slice(0, 15);
                }
            }
        }
    