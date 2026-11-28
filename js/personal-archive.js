/* Perde kişisel arşiv görünümü.
 * Katalogdan kaldırılan kayıtların kişisel listelerde görünmesini ve
 * film/dizi ilerleme kayıtlarının katalog eksikliğinde kaybolmamasını sağlar.
 */
(function () {
  'use strict';

  const baseApp = window.ultimateProApp;
  if (typeof baseApp !== 'function' || window.__PERDE_PERSONAL_ARCHIVE_PATCHED__) return;

  window.ultimateProApp = function (...args) {
    const app = baseApp.apply(this, args);
    const originalResolve = app.resolvePersonalItem;

    app.resolvePersonalItem = function (entry) {
      if (!entry || entry.id == null) return null;
      const exists = (this.catalog || []).some(item => String(item.id) === String(entry.id));
      const resolved = typeof originalResolve === 'function'
        ? originalResolve.call(this, entry)
        : { ...entry };
      if (!resolved) return null;
      resolved._catalogMissing = !exists;
      return resolved;
    };

    app.findPersonalArchiveItem = function (id, type) {
      const catalogItem = (this.catalog || []).find(item => String(item.id) === String(id));
      if (catalogItem) return catalogItem;
      const keys = ['cine_watched_items_v1', 'cine_favorite_items_v1', 'cine_watchlist_v1'];
      for (const key of keys) {
        const list = safeStorageRead(key, []);
        if (!Array.isArray(list)) continue;
        const saved = list.find(item => item && item.id != null && String(item.id) === String(id));
        if (saved) {
          const resolved = this.resolvePersonalItem(saved);
          if (resolved) return { ...resolved, type: resolved.type || type, _catalogMissing: true };
        }
      }
      return {
        id: String(id),
        title: 'Katalogda bulunmayan yapım',
        type,
        _catalogMissing: true
      };
    };

    Object.defineProperty(app, 'libraryMovieEntries', {
      configurable: true,
      enumerable: true,
      get() {
        return Object.entries(this.profileMovieProgress || {}).map(([id, saved]) => {
          const time = Math.max(0, Number(saved?.time) || 0);
          const duration = Math.max(0, Number(saved?.duration) || 0);
          if (!duration || !time) return null;
          const catalogItem = (this.catalog || []).find(item => String(item.id) === String(id));
          if (catalogItem && catalogItem.type !== 'movie') return null;
          const item = catalogItem || this.findPersonalArchiveItem(id, 'movie');
          const percent = Math.min(100, Math.round(time / duration * 100));
          return {
            kind: 'movie', item, time, duration, percent,
            savedAt: Number(saved.savedAt) || 0,
            label: percent >= 90 ? 'Tamamlandı' : 'Film • İzlemeye devam et'
          };
        }).filter(Boolean).sort((a, b) => b.savedAt - a.savedAt);
      }
    });

    Object.defineProperty(app, 'librarySeriesEntries', {
      configurable: true,
      enumerable: true,
      get() {
        const all = safeStorageRead('cine_episode_tracking_v1', {});
        if (!all || typeof all !== 'object' || Array.isArray(all)) return [];
        return Object.entries(all).map(([id, tracking]) => {
          const catalogItem = (this.catalog || []).find(item => String(item.id) === String(id));
          if (catalogItem && catalogItem.type !== 'tv') return null;
          const watched = tracking?.watched && typeof tracking.watched === 'object' ? tracking.watched : {};
          const watchedCount = Object.values(watched).reduce((sum, list) =>
            sum + (Array.isArray(list) ? new Set(list.map(Number)).size : 0), 0);
          const last = tracking?.last || null;
          if (!watchedCount && !last) return null;
          const item = catalogItem || this.findPersonalArchiveItem(id, 'tv');
          const total = Math.max(0, Number(item.episodes) || 0);
          const season = Math.max(1, Number(last?.season) || 1);
          const episode = Math.max(1, Number(last?.episode) || 1);
          return {
            kind: 'series', item, watchedCount, total,
            percent: total ? Math.min(100, Math.round(watchedCount / total * 100)) : 0,
            season, episode,
            savedAt: Number(last?.updatedAt) || 0,
            label: 'Sezon ' + season + ' • Bölüm ' + episode
          };
        }).filter(Boolean).sort((a, b) => b.savedAt - a.savedAt);
      }
    });

    return app;
  };

  window.__PERDE_PERSONAL_ARCHIVE_PATCHED__ = true;
})();
