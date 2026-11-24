/*
 * PERDE — Oynatıcı zaman çizgisi önizleme modülü
 * Görev: İmleç veya dokunma zaman çizgisi üzerinde hareket ederken küçük video
 * önizlemesi ve zaman bilgisini gösterir.
 * Bağımlılık: Oynatıcı DOM yapısı (.cv-player-seek-wrap, #customVideoPlayer).
 * Yükleme: index.html içinde, oynatıcı arayüzü tanımlandıktan sonra çalıştırılır.
 */

(() => {
        if (window.__CV_SEEK_PREVIEW_BOUND__) return;
        window.__CV_SEEK_PREVIEW_BOUND__ = true;
        let hideTimer = 0;
        const format = seconds => {
          const n = Math.max(0, Math.floor(Number(seconds) || 0));
          const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = n % 60;
          return h ? [h,m,s].map(v => String(v).padStart(2,'0')).join(':') : [m,s].map(v => String(v).padStart(2,'0')).join(':');
        };
        const ensurePreview = wrap => {
          let panel = wrap.querySelector('.cv-seek-hover-preview');
          if (!panel) {
            panel = document.createElement('div');
            panel.className = 'cv-seek-hover-preview';
            panel.innerHTML = '<div class="cv-seek-hover-preview-frame"><video muted playsinline preload="metadata" disablepictureinpicture aria-hidden="true"></video></div><span class="cv-seek-hover-preview-time">00:00</span>';
            wrap.appendChild(panel);
          }
          return panel;
        };
        const updatePreview = event => {
          const input = event.target.closest?.('.cv-player-seek');
          if (!input) return;
          const wrap = input.closest('.cv-player-seek-wrap');
          const mainVideo = document.getElementById('customVideoPlayer');
          if (!wrap || !mainVideo || !Number.isFinite(mainVideo.duration) || mainVideo.duration <= 0) return;
          const rect = input.getBoundingClientRect();
          if (!rect.width) return;
          const ratio = Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));
          const seconds = ratio * mainVideo.duration;
          const panel = ensurePreview(wrap);
          const previewVideo = panel.querySelector('video');
          const time = panel.querySelector('.cv-seek-hover-preview-time');
          const url = mainVideo.currentSrc || mainVideo.src;
          if (!url) return;
          panel.style.left = Math.max(54,Math.min(rect.width-54,event.clientX-rect.left)) + 'px';
          time.textContent = format(seconds);
          panel.classList.add('is-visible');
          if (hideTimer) { clearTimeout(hideTimer); hideTimer = 0; }
          if (previewVideo.dataset.source !== url) {
            previewVideo.pause();
            previewVideo.dataset.source = url;
            previewVideo.src = url;
            previewVideo.load();
            previewVideo.dataset.pendingTime = String(seconds);
          } else {
            previewVideo.dataset.pendingTime = String(seconds);
          }
          const seekToPending = () => {
            if (!Number.isFinite(previewVideo.duration) || previewVideo.duration <= 0) return;
            const target = Math.max(0,Math.min(previewVideo.duration-0.08,Number(previewVideo.dataset.pendingTime)||0));
            if (Math.abs(previewVideo.currentTime-target) < 0.2 && previewVideo.readyState >= 2) return;
            try { previewVideo.currentTime = target; } catch (_) {}
          };
          if (previewVideo.readyState >= 1) {
            if (previewVideo._cvSeekTimer) clearTimeout(previewVideo._cvSeekTimer);
            previewVideo._cvSeekTimer = setTimeout(seekToPending, event.pointerType === 'touch' ? 90 : 140);
          } else if (!previewVideo._cvMetadataBound) {
            previewVideo._cvMetadataBound = true;
            previewVideo.addEventListener('loadedmetadata', () => {
              if (previewVideo._cvSeekTimer) clearTimeout(previewVideo._cvSeekTimer);
              previewVideo._cvSeekTimer = setTimeout(seekToPending, 40);
            });
          }
        };
        document.addEventListener('pointermove', updatePreview, {passive:true});
        document.addEventListener('pointerdown', updatePreview, {passive:true});
        document.addEventListener('pointerup', event => {
          if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
          const wrap = event.target.closest?.('.cv-player-seek-wrap');
          if (!wrap) return;
          if (hideTimer) clearTimeout(hideTimer);
          hideTimer = setTimeout(() => wrap.querySelector('.cv-seek-hover-preview')?.classList.remove('is-visible'), 700);
        }, {passive:true});
        document.addEventListener('pointerout', event => {
          const wrap = event.target.closest?.('.cv-player-seek-wrap');
          if (!wrap || wrap.contains(event.relatedTarget) || event.pointerType === 'touch') return;
          wrap.querySelector('.cv-seek-hover-preview')?.classList.remove('is-visible');
        }, {passive:true});
        document.addEventListener('focusout', event => {
          const wrap = event.target.closest?.('.cv-player-seek-wrap');
          if (wrap) wrap.querySelector('.cv-seek-hover-preview')?.classList.remove('is-visible');
        }, true);
      })();
