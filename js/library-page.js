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
            if (entry.kind === 'series') {
                this.selectedSeason = entry.season;
                this.selectedEpisode = entry.episode;
                this.currentEpisodePage = Math.floor((entry.episode - 1) / 8) + 1;
            }
        }
    };
})();
