/* Perde Kütüphane sayfası modülü.
 * İzleme geçmişi listesini hazırlar ve seçilen kaydı doğru sezon/bölüm bilgisiyle açar.
 * Yalnızca Kütüphanem rotası yüklenirken çağrılır.
 */
(function () {
    'use strict';

    window.PerdeLibraryPage = {
        // Film ve dizi izleme kayıtlarını birleştirip en son güncellenen 24 kaydı gösterir.
        getLibraryHistoryItems() {
            return [...this.libraryMovieEntries, ...this.librarySeriesEntries]
                .sort((a, b) => b.savedAt - a.savedAt)
                .slice(0, 24);
        },

        // Kayıtlı filmi açar; dizi ise son izlenen sezon ve bölüm konumunu geri yükler.
        resumeLibraryItem(entry) {
            if (!entry?.item) return;

            this.openWatchPage(entry.item);
            if (entry.kind !== 'series') return;

            // Sayfa açılırken varsayılan 1. bölüm seçilir. Kütüphane kaydındaki
            // son bölüm bilgisini aynı açılış akışında uygula.
            const season = Math.max(1, Number(entry.season) || 1);
            const episode = Math.max(1, Number(entry.episode) || 1);
            this.selectedSeason = season;
            this.selectedEpisode = episode;
            this.currentEpisodePage = Math.floor((episode - 1) / 8) + 1;

            // Alpine'ın bölüm URL'sini DOM'a işlemesini bekle; ardından video
            // kaynağının doğru bölümle eşleştiğini garanti et. Otomatik oynatma
            // yapma: kullanıcı oynat düğmesine kendisi basar.
            const syncEpisodeSource = () => {
                const video = document.getElementById('customVideoPlayer');
                const url = this.getPlaybackUrl?.();
                if (!video || !url || !this.isDirectVideoUrl?.(url)) return;
                if (video.getAttribute('src') !== url) {
                    video.pause();
                    video.src = url;
                    video.load();
                }
            };

            if (typeof this.$nextTick === 'function') {
                this.$nextTick(syncEpisodeSource);
            } else {
                Promise.resolve().then(syncEpisodeSource);
            }
        }
    };
})();
