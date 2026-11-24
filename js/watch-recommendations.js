/**
 * Perde Benzer Yapım Önerileri
 * Seçilen film veya diziye tür, oyuncu, yönetmen ve katalog verileri üzerinden
 * benzer yapımları puanlayıp sıralar. Yalnızca izleme sayfasında yüklenir.
 */
(function () {
    'use strict';
    window.PerdeWatchRecommendations = {
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
                    const excluded = new Set([...(sectionConfig.excludeWatched === false ? [] : watchedHistoryIds), ...(sectionConfig.excludeWatchlist === false ? [] : watchlist.map(item => String(item.id))), ...watchedItems.map(item => String(item.id)), ...favoriteItems.map(item => String(item.id))]);
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
                        const remainingTypeCounts = new Map();
                        remaining.forEach(entry => {
                            const type = entry.item.type || 'unknown';
                            remainingTypeCounts.set(type, (remainingTypeCounts.get(type) || 0) + 1);
                        });
                        const typeTargets = new Map([...remainingTypeCounts.entries()].map(([type, count]) => [
                            type, Math.max(1, Math.round(40 * count / Math.max(1, ranked.length)))
                        ]));
                        let remainingMovies = remainingTypeCounts.get('movie') || 0;
                        let remainingTv = remainingTypeCounts.get('tv') || 0;
                        while (remaining.length && selected.length < 40) {
                            const typesNeedingRoom = new Set();
                            typeTargets.forEach((target, type) => {
                                if ((typeCounts.get(type) || 0) < target && (remainingTypeCounts.get(type) || 0) > 0) {
                                    typesNeedingRoom.add(type);
                                }
                            });

                            // İlk 5 görünür öneride (1 büyük + 4 küçük) en az 3 film ve 2 dizi bulunsun.
                            // Puan sıralaması korunur; yalnızca film/dizi kotası dolduğunda seçim dengelenir.
                            let requiredType = '';
                            if (selected.length < 5) {
                                const selectedMovies = typeCounts.get('movie') || 0;
                                const selectedTv = typeCounts.get('tv') || 0;
                                const missingMovies = Math.max(0, 3 - selectedMovies);
                                const missingTv = Math.max(0, 2 - selectedTv);
                                if (remainingMovies < missingMovies && remainingTv >= missingTv) {
                                    requiredType = 'tv';
                                } else if (remainingTv < missingTv && remainingMovies >= missingMovies) {
                                    requiredType = 'movie';
                                } else if (remainingMovies >= missingMovies && remainingTv >= missingTv) {
                                    if (remainingMovies === missingMovies || selectedTv >= 2) {
                                        requiredType = 'movie';
                                    } else if (remainingTv === missingTv || selectedMovies >= 3) {
                                        requiredType = 'tv';
                                    }
                                }
                            }

                            let bestIndex = -1;
                            let bestAdjusted = -Infinity;
                            for (let index = 0; index < remaining.length; index++) {
                                const entry = remaining[index];
                                const type = entry.item.type || 'unknown';
                                if (requiredType && type !== requiredType) continue;
                                const genre = entry.primaryGenre || 'diger';
                                const genreCount = genreCounts.get(genre) || 0;
                                const typeCount = typeCounts.get(type) || 0;
                                const otherTypeNeedsRoom = typesNeedingRoom.size > (typesNeedingRoom.has(type) ? 1 : 0);
                                const typeBalancePenalty = typeCount >= (typeTargets.get(type) || 40) && otherTypeNeedsRoom ? 1000 : 0;
                                const diversityPenalty = Math.max(0, genreCount - 1) * 1.7 + typeBalancePenalty;
                                const adjusted = entry.score - diversityPenalty;
                                if (adjusted > bestAdjusted) {
                                    bestAdjusted = adjusted;
                                    bestIndex = index;
                                }
                            }
                            // Beklenmeyen tür verilerinde önceki davranıştaki tüm adaylara geri dön.
                            if (bestIndex < 0) {
                                for (let index = 0; index < remaining.length; index++) {
                                    const entry = remaining[index];
                                    const type = entry.item.type || 'unknown';
                                    const genre = entry.primaryGenre || 'diger';
                                    const genreCount = genreCounts.get(genre) || 0;
                                    const typeCount = typeCounts.get(type) || 0;
                                    const otherTypeNeedsRoom = typesNeedingRoom.size > (typesNeedingRoom.has(type) ? 1 : 0);
                                    const typeBalancePenalty = typeCount >= (typeTargets.get(type) || 40) && otherTypeNeedsRoom ? 1000 : 0;
                                    const adjusted = entry.score - (Math.max(0, genreCount - 1) * 1.7 + typeBalancePenalty);
                                    if (adjusted > bestAdjusted) {
                                        bestAdjusted = adjusted;
                                        bestIndex = index;
                                    }
                                }
                            }
                            const [chosen] = remaining.splice(bestIndex, 1);
                            const genre = chosen.primaryGenre || 'diger';
                            const type = chosen.item.type || 'unknown';
                            selected.push(chosen);
                            genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
                            typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
                            remainingTypeCounts.set(type, Math.max(0, (remainingTypeCounts.get(type) || 0) - 1));
                            if (type === 'movie') remainingMovies--;
                            if (type === 'tv') remainingTv--;
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
                }
    };
})();
