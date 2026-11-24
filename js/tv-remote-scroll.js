/*
 * PERDE — TV kumandası dikey kaydırma desteği
 * Görev: TV modunda, odak bir kontrolde değilken yukarı/aşağı tuşlarıyla ana sayfayı kaydırır.
 * Bağımlılık: Erken cihaz algılama kodunun documentElement üzerinde cvDeviceMode=tv ayarlaması.
 */

(() => {
        if (document.documentElement.dataset.cvDeviceMode !== 'tv') return;
        const isEditable = element => !!element?.closest('input,textarea,select,[contenteditable="true"],[role="textbox"],[role="combobox"]');
        const isOverlayControl = element => !!element?.closest('[role="dialog"],[aria-modal="true"],.modal,.dropdown-menu,[data-tv-keep-focus]');
        const getDirection = event => {
          const key = event.key || event.code || '';
          if (key === 'ArrowDown' || key === 'Down' || key === 'DPAD_DOWN' || event.keyCode === 40 || event.which === 40) return 1;
          if (key === 'ArrowUp' || key === 'Up' || key === 'DPAD_UP' || event.keyCode === 38 || event.which === 38) return -1;
          return 0;
        };
        document.addEventListener('keydown', event => {
          const direction = getDirection(event);
          if (!direction || event.altKey || event.ctrlKey || event.metaKey || isEditable(event.target) || isOverlayControl(event.target)) return;
          if (!document.querySelector('#home-page')) return;
          const focused = document.activeElement;
          if (focused && focused !== document.body && focused !== document.documentElement) return;
          const root = document.scrollingElement || document.documentElement;
          const maxScroll = Math.max(0, root.scrollHeight - window.innerHeight);
          if (maxScroll <= 0) return;
          const current = Math.max(0, window.scrollY || root.scrollTop || 0);
          const step = Math.max(180, Math.round(window.innerHeight * 0.48));
          const next = Math.min(maxScroll, Math.max(0, current + direction * step));
          if (next === current) return;
          event.preventDefault();
          window.scrollTo({ top: next, left: 0, behavior: 'auto' });
        }, true);
      })();
