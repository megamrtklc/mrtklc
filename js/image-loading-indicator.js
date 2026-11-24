/*
 * PERDE — Görsel yükleme göstergesi
 * Görev: Henüz yüklenmekte olan görselleri izler, bekleme göstergesini yönetir
 * ve tamamlanan/hata veren görsellerde geçici durumu temizler.
 * Bağımlılık: Sayfa DOM'u ve standart tarayıcı görsel/MutationObserver API'leri.
 */

(() => {
            const timers = new WeakMap();
            const eligible = (img) => {
                if (!(img instanceof HTMLImageElement) || (!img.getAttribute('src') && !img.getAttribute('srcset'))) return false;
                if (img.getAttribute('aria-hidden') === 'true' || !img.getAttribute('alt')?.trim()) return false;
                if (/^(logo|icon)$/i.test(img.getAttribute('alt').trim())) return false;
                return true;
            };
            const surfaceFor = (img) => {
                const parent = img.parentElement;
                return parent?.tagName === 'PICTURE' ? parent.parentElement : parent;
            };
            const updateSurface = (surface) => {
                if (!surface) return;
                const hasPending = surface.querySelector(':scope > img[data-cv-image-loading="true"], :scope > picture > img[data-cv-image-loading="true"]');
                if (hasPending) {
                    if (!surface.classList.contains('cv-image-loading-surface')) {
                        if (getComputedStyle(surface).position === 'static') {
                            surface.dataset.cvImageOriginalPosition = 'static';
                            surface.style.position = 'relative';
                        }
                        surface.classList.add('cv-image-loading-surface');
                    }
                    if (!surface.querySelector(':scope > .cv-image-loading-spinner')) {
                        const spinner = document.createElement('span');
                        spinner.className = 'cv-image-loading-spinner';
                        spinner.setAttribute('aria-hidden', 'true');
                        surface.appendChild(spinner);
                    }
                } else {
                    surface.classList.remove('cv-image-loading-surface');
                    surface.querySelector(':scope > .cv-image-loading-spinner')?.remove();
                    if (surface.dataset.cvImageOriginalPosition === 'static') {
                        surface.style.position = '';
                        delete surface.dataset.cvImageOriginalPosition;
                    }
                }
            };
            const finish = (img) => {
                if (!(img instanceof HTMLImageElement)) return;
                const timer = timers.get(img);
                if (timer) clearTimeout(timer);
                timers.delete(img);
                img.removeAttribute('data-cv-image-loading');
                img.removeAttribute('data-cv-image-waiting');
                updateSurface(surfaceFor(img));
                lazyObserver?.unobserve(img);
            };
            const begin = (img) => {
                if (!eligible(img) || img.complete) {
                    finish(img);
                    return;
                }
                img.removeAttribute('data-cv-image-waiting');
                img.setAttribute('data-cv-image-loading', 'true');
                updateSurface(surfaceFor(img));
                const timer = setTimeout(() => finish(img), 15000);
                timers.set(img, timer);
            };
            const lazyObserver = 'IntersectionObserver' in window
                ? new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (!entry.isIntersecting) return;
                        begin(entry.target);
                        lazyObserver.unobserve(entry.target);
                    });
                }, { rootMargin: '120px 0px', threshold: 0.01 })
                : null;
            const inspect = (img) => {
                if (!eligible(img)) {
                    finish(img);
                    return;
                }
                const oldTimer = timers.get(img);
                if (oldTimer) clearTimeout(oldTimer);
                timers.delete(img);
                img.removeAttribute('data-cv-image-loading');
                updateSurface(surfaceFor(img));
                if (img.complete) {
                    finish(img);
                    return;
                }
                if (img.loading === 'lazy') {
                    if (lazyObserver) {
                        img.setAttribute('data-cv-image-waiting', 'true');
                        lazyObserver.observe(img);
                    }
                    return;
                }
                begin(img);
            };
            document.addEventListener('load', event => finish(event.target), true);
            document.addEventListener('error', event => finish(event.target), true);
            const scan = (node) => {
                if (!(node instanceof Element)) return;
                if (node.matches('img')) inspect(node);
                else if (node.matches('picture,source')) {
                    const picture = node.tagName === 'PICTURE' ? node : node.parentElement;
                    picture?.querySelectorAll('img').forEach(inspect);
                }
                node.querySelectorAll?.('img').forEach(inspect);
            };
            scan(document.documentElement);
            const observer = new MutationObserver(records => {
                records.forEach(record => {
                    if (record.type === 'attributes') scan(record.target);
                    else record.addedNodes.forEach(scan);
                });
            });
            observer.observe(document.documentElement, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ['src', 'srcset']
            });
        })();
