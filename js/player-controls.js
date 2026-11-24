/* Perde oynatıcı kontrolleri: yalnızca izleme rotasında yüklenen küçültülmüş video kontrol modülü. */(function(){'use strict';window.PerdePlayerControls={startPlayback(){const e=document.getElementById("customVideoPlayer"),t=this.getPlaybackUrl();if(this.playerControlsVisible=!0,!e||!t||!this.isDirectVideoUrl(t))return void(this.playbackError=!0);this.playbackError=!1,e.getAttribute("src")!==t&&(e.setAttribute("src",t),e.load());const i=e.play();i&&"function"==typeof i.catch&&i.catch(e=>{this.playbackError=!0,this.isPlaying=!1,console.warn("Video oynatma başlatılamadı:",e)})},selectEpisode(e){this.selectedEpisode=Number(e),this.playbackError=!1,this.videoEnded=!1,this.videoProgress=0;const t=document.getElementById("customVideoPlayer"),i=this.getPlaybackUrl();t&&i&&(t.pause(),t.src=i,t.load(),t.play().catch(()=>{this.playbackError=!0}))},handleDoubleTapSeek(e,t){const i=document.getElementById("cvTapSeekZones");if(i&&t){const e=i.getBoundingClientRect();this.tapSeekX=Math.max(62,Math.min(e.width-62,t.clientX-e.left)),this.tapSeekY=Math.max(68,Math.min(e.height-68,t.clientY-e.top))}const r="backward"===e?-10:10,a=document.getElementById("customVideoPlayer");a&&Number.isFinite(a.duration)&&(a.currentTime=Math.max(0,Math.min(a.duration,a.currentTime+r)),this.updateVideoProgress(),this.tapSeekAmount=this.tapSeekSide===e?this.tapSeekAmount+10:10,this.tapSeekSide=e,this.tapSeekPulse=!1,setTimeout(()=>{this.tapSeekPulse=!0},30),this.tapSeekTimer&&clearTimeout(this.tapSeekTimer),this.tapSeekTimer=setTimeout(()=>{this.tapSeekSide="",this.tapSeekAmount=0,this.tapSeekTimer=null},950),this.showPlayerControls())},setPlaybackRate(e){const t=Number(e);if(![.75,1,1.25,1.5,2].includes(t))return;this.playbackRate=t;const i=document.getElementById("customVideoPlayer");i&&(i.playbackRate=t)},seekVideo(e){const t=document.getElementById("customVideoPlayer");if(!t||!t.duration)return;const i=e.currentTarget.getBoundingClientRect(),r=(e.clientX-i.left)/i.width;t.currentTime=r*t.duration},
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
};})();