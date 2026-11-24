/* Perde oynatıcı kontrolleri: yalnızca izleme rotasında yüklenen video ve bölüm gezinme modülü. */(function(){'use strict';window.PerdePlayerControls={startPlayback(){const e=document.getElementById("customVideoPlayer"),t=this.getPlaybackUrl();if(this.playerControlsVisible=!0,!e||!t||!this.isDirectVideoUrl(t))return void(this.playbackError=!0);this.playbackError=!1,e.getAttribute("src")!==t&&(e.setAttribute("src",t),e.load());const i=e.play();i&&"function"==typeof i.catch&&i.catch(e=>{this.playbackError=!0,this.isPlaying=!1,console.warn("Video oynatma başlatılamadı:",e)})},selectEpisode(e){this.selectedEpisode=Number(e),this.playbackError=!1,this.videoEnded=!1,this.videoProgress=0;const t=document.getElementById("customVideoPlayer"),i=this.getPlaybackUrl();t&&i&&(t.pause(),t.src=i,t.load(),t.play().catch(()=>{this.playbackError=!0}))},handleDoubleTapSeek(e,t){const i=document.getElementById("cvTapSeekZones");if(i&&t){const e=i.getBoundingClientRect();this.tapSeekX=Math.max(62,Math.min(e.width-62,t.clientX-e.left)),this.tapSeekY=Math.max(68,Math.min(e.height-68,t.clientY-e.top))}const r="backward"===e?-10:10,a=document.getElementById("customVideoPlayer");a&&Number.isFinite(a.duration)&&(a.currentTime=Math.max(0,Math.min(a.duration,a.currentTime+r)),this.updateVideoProgress(),this.tapSeekAmount=this.tapSeekSide===e?this.tapSeekAmount+10:10,this.tapSeekSide=e,this.tapSeekPulse=!1,setTimeout(()=>{this.tapSeekPulse=!0},30),this.tapSeekTimer&&clearTimeout(this.tapSeekTimer),this.tapSeekTimer=setTimeout(()=>{this.tapSeekSide="",this.tapSeekAmount=0,this.tapSeekTimer=null},950),this.showPlayerControls())},setPlaybackRate(e){const t=Number(e);if(![.75,1,1.25,1.5,2].includes(t))return;this.playbackRate=t;const i=document.getElementById("customVideoPlayer");i&&(i.playbackRate=t)},seekVideo(e){const t=document.getElementById("customVideoPlayer");if(!t||!t.duration)return;const i=e.currentTarget.getBoundingClientRect(),r=(e.clientX-i.left)/i.width;t.currentTime=r*t.duration},
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
    saveMovieProgress(itemId, progress) {
        try {
            const all = this.profileMovieProgress;
            all[String(itemId)] = progress;
            safeStorageWrite('cine_movie_progress_v1', all);
        } catch (error) {
            console.warn('Profil izleme ilerlemesi kaydedilemedi:', error);
        }
    }
,
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
                }
,
    getSelectedEpisodeWatchUrl() {
                    if (!this.selectedItem || this.selectedItem.type !== 'tv') return '';
                    const key = Number(this.selectedSeason) + ':' + Number(this.selectedEpisode);
                    const url = this.selectedItem.episodeWatchUrls?.[key];
                    return this.isDirectVideoUrl(url) ? url : '';
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
                }
,
    skipTime(seconds) {
                    const video = document.getElementById('customVideoPlayer');
                    if (!video || !Number.isFinite(video.duration)) return;
                    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
                    this.showPlaybackFeedback(seconds < 0 ? 'backward' : 'forward', 850);
                    this.showPlayerControls();
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
    showPlayerControls() {
                    this.playerControlsVisible = true;
                    if (this.playerControlsTimer) clearTimeout(this.playerControlsTimer);
                    if (this.isPlaying) this.schedulePlayerControlsHide();
                },
    // Bölüm izleme durumunu yerel depoda tutan yardımcılar; yalnızca izleme rotasında yüklenir.
    getEpisodeTracking() {
        const all = safeStorageRead('cine_episode_tracking_v1', {});
        if (!all || typeof all !== 'object' || Array.isArray(all)) return { watched: {}, last: null };
        const key = String(this.selectedItem?.id || '');
        const tracking = all[key];
        return tracking && typeof tracking === 'object' && !Array.isArray(tracking)
            ? { watched: tracking.watched && typeof tracking.watched === 'object' ? tracking.watched : {}, last: tracking.last ?? null }
            : { watched: {}, last: null };
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
    }
    // Sezon ve bölüm verilerini seçili yapımdan okur; yalnızca izleme rotasında kullanılır.
    getSeasonOptions() {
                        const count = Number(this.selectedItem?.seasons || 0);
                        return Array.from({ length: Math.max(0, count) }, (_, index) => index + 1);
                    },
    getEpisodesForSeason(seasonNum) {
                        return this.selectedItem?.tmdbEpisodesBySeason?.[seasonNum] || [];
                    }
};})();