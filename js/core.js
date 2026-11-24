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

        function applyPerdeTheme(theme) {
            const activeTheme = ['ivory', 'slate', 'dark'].includes(theme) ? theme : 'dark';
            const root = document.documentElement;
            root.classList.remove('dark', 'theme-ivory', 'theme-slate');
            root.classList.add(activeTheme === 'dark' ? 'dark' : (activeTheme === 'ivory' ? 'theme-ivory' : 'theme-slate'));
            root.dataset.theme = activeTheme;
            root.dataset.themeReady = 'true';
            root.style.colorScheme = activeTheme === 'dark' ? 'dark' : 'light';
            if (document.body) {
                document.body.classList.remove('bg-ivory-50', 'bg-slateLight-50', 'bg-[#0b0d11]');
                document.body.classList.add(activeTheme === 'ivory' ? 'bg-ivory-50' : (activeTheme === 'slate' ? 'bg-slateLight-50' : 'bg-[#0b0d11]'));
            }
            const themeColor = document.querySelector('meta[name="theme-color"]');
            if (themeColor) themeColor.setAttribute('content', activeTheme === 'dark' ? '#0b0d11' : (activeTheme === 'ivory' ? '#fffdf9' : '#f4f5f7'));
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
