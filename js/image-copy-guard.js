/*
 * PERDE — Görsel etkileşim koruması
 * Görev: Görsel alanlarında sağ tıkla bağlam menüsünü ve görsel sürüklemeyi engeller.
 * Bağımlılık: Sayfa DOM'u.
 */

(() => {
            const isImageSurface = (target) => {
                let element = target instanceof Element ? target : target?.parentElement;
                for (let depth = 0; element && depth < 6; depth++, element = element.parentElement) {
                    if (element.tagName === 'IMG' || element.tagName === 'PICTURE') return true;
                    if (getComputedStyle(element).backgroundImage !== 'none') return true;
                }
                return false;
            };

            document.addEventListener('contextmenu', (event) => {
                if (isImageSurface(event.target)) event.preventDefault();
            }, true);

            document.addEventListener('dragstart', (event) => {
                const target = event.target;
                if (target instanceof Element && (target.tagName === 'IMG' || target.closest('picture'))) {
                    event.preventDefault();
                }
            }, true);
        })();
