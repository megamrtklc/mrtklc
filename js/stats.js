/*
 * PERDE — İzleme istatistikleri modülü
 * Görev: Film ilerlemelerini, izlenen dizi bölümlerini, tür dağılımını ve aylık
 * etkinliği hesaplar. Bu modül yalnızca #/stats rotası açıldığında yüklenir.
 * Bağımlılıklar: ana Alpine uygulamasındaki catalog, profileMovieProgress ve
 * watchlist verileri ile js/core.js içindeki safeStorageRead yardımcı işlevi.
 */
(function (window) {
    'use strict';
    window.PerdeStats = {
        getViewingStats() {
                            const safeRead = key => {
                                try { const value = window.safeStorageRead(key, {}); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
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
                                Object.values(value?.watched || {}).forEach(list => { if (Array.isArray(list)) count += new Set(list.map(Number).filter(number => Number.isInteger(number) && number > 0)).size; });
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
                        }
    };
})(window);
