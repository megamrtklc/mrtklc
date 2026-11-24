/**
 * Perde Oyuncu ve Yönetmen Profilleri
 * TMDB kişi profilleri, filmografiler, ödüller ve biyografi çevirisini yönetir.
 * Yalnızca oyuncu/yönetmen profili veya izleme sayfası gerektiğinde yüklenir.
 */
(function () {
'use strict';
window.PerdePeople = {
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
                    this.selectedActor = { ...actor, id: Number(actor.id), awards: Array.isArray(actor.awards) ? actor.awards : [], filmography: Array.isArray(actor.filmography) ? actor.filmography : [] };
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
                        const awards = await window.PerdePeople.fetchActorAwards.call(this,person.external_ids?.wikidata_id);
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
                        this.getDirectorNames(item.tmdbDirector || item.director)
                            .some(name => this.normalizeSearchText(name) === normalizedName) &&
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
                    this.selectedActor = { ...actor, id: actor.id ? Number(actor.id) : null, awards: Array.isArray(actor.awards) ? actor.awards : [], filmography: Array.isArray(actor.filmography) ? actor.filmography : [] };
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
                        const awards = await window.PerdePeople.fetchActorAwards.call(this,person.external_ids?.wikidata_id);
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
                }
};
})();