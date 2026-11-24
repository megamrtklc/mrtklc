/**
 * Perde oynatıcı kontrolleri
 * Video başlatma, bölüm seçimi, çift dokunma ile sarma, süre çubuğu ve hız işlemlerini yalnızca izleme rotasında yükler.
 * Ana Alpine nesnesinin this bağlamını koruyarak mevcut oynatıcı durumunu yönetir.
 */
(function () {
    'use strict';
    window.PerdePlayerControls = {
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

        handleDoubleTapSeek(direction, event) {
            const zones = document.getElementById('cvTapSeekZones');
            if (zones && event) {
                const rect = zones.getBoundingClientRect();
                this.tapSeekX = Math.max(62, Math.min(rect.width - 62, event.clientX - rect.left));
                this.tapSeekY = Math.max(68, Math.min(rect.height - 68, event.clientY - rect.top));
            }
            const seconds = direction === 'backward' ? -10 : 10;
            const video = document.getElementById('customVideoPlayer');
            if (!video || !Number.isFinite(video.duration)) return;
            video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
            this.updateVideoProgress();
            this.tapSeekAmount = this.tapSeekSide === direction ? this.tapSeekAmount + 10 : 10;
            this.tapSeekSide = direction;
            this.tapSeekPulse = false;
            setTimeout(() => { this.tapSeekPulse = true; }, 30);
            if (this.tapSeekTimer) clearTimeout(this.tapSeekTimer);
            this.tapSeekTimer = setTimeout(() => {
                this.tapSeekSide = '';
                this.tapSeekAmount = 0;
                this.tapSeekTimer = null;
            }, 950);
            this.showPlayerControls();
        },

        setPlaybackRate(rate) {
            const allowed = [0.75, 1, 1.25, 1.5, 2];
            const next = Number(rate);
            if (!allowed.includes(next)) return;
            this.playbackRate = next;
            const video = document.getElementById('customVideoPlayer');
            if (video) video.playbackRate = next;
        },

        seekVideo(event) {
            const video = document.getElementById('customVideoPlayer');
            if (!video || !video.duration) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const pos = (event.clientX - rect.left) / rect.width;
            video.currentTime = pos * video.duration;
        }
    };
})();
