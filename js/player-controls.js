/* Perde oynatıcı kontrolleri: yalnızca izleme rotasında yüklenen küçültülmüş video kontrol modülü. */(function(){'use strict';window.PerdePlayerControls={startPlayback(){const e=document.getElementById("customVideoPlayer"),t=this.getPlaybackUrl();if(this.playerControlsVisible=!0,!e||!t||!this.isDirectVideoUrl(t))return void(this.playbackError=!0);this.playbackError=!1,e.getAttribute("src")!==t&&(e.setAttribute("src",t),e.load());const i=e.play();i&&"function"==typeof i.catch&&i.catch(e=>{this.playbackError=!0,this.isPlaying=!1,console.warn("Video oynatma başlatılamadı:",e)})},selectEpisode(e){this.selectedEpisode=Number(e),this.playbackError=!1,this.videoEnded=!1,this.videoProgress=0;const t=document.getElementById("customVideoPlayer"),i=this.getPlaybackUrl();t&&i&&(t.pause(),t.src=i,t.load(),t.play().catch(()=>{this.playbackError=!0}))},handleDoubleTapSeek(e,t){const i=document.getElementById("cvTapSeekZones");if(i&&t){const e=i.getBoundingClientRect();this.tapSeekX=Math.max(62,Math.min(e.width-62,t.clientX-e.left)),this.tapSeekY=Math.max(68,Math.min(e.height-68,t.clientY-e.top))}const r="backward"===e?-10:10,a=document.getElementById("customVideoPlayer");a&&Number.isFinite(a.duration)&&(a.currentTime=Math.max(0,Math.min(a.duration,a.currentTime+r)),this.updateVideoProgress(),this.tapSeekAmount=this.tapSeekSide===e?this.tapSeekAmount+10:10,this.tapSeekSide=e,this.tapSeekPulse=!1,setTimeout(()=>{this.tapSeekPulse=!0},30),this.tapSeekTimer&&clearTimeout(this.tapSeekTimer),this.tapSeekTimer=setTimeout(()=>{this.tapSeekSide="",this.tapSeekAmount=0,this.tapSeekTimer=null},950),this.showPlayerControls())},setPlaybackRate(e){const t=Number(e);if(![.75,1,1.25,1.5,2].includes(t))return;this.playbackRate=t;const i=document.getElementById("customVideoPlayer");i&&(i.playbackRate=t)},seekVideo(e){const t=document.getElementById("customVideoPlayer");if(!t||!t.duration)return;const i=e.currentTarget.getBoundingClientRect(),r=(e.clientX-i.left)/i.width;t.currentTime=r*t.duration},
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
};})();