/*
 * PERDE — Görsel yardımcıları
 * Görev: TMDB görselleri için duyarlı srcset adresleri üretmek ve yüklenemeyen
 * görselleri güvenli bir yer tutucuyla değiştirmek.
 * Kullanım: app.js, bu dosyanın window.PerdeImageHelpers nesnesini uygulama
 * kapsamına aktarır. Bu nedenle index.html içinde app.min.js öncesinde yüklenir.
 */
/* Perde UI helpers: image URL generation and safe image fallback. */
window.PerdeImageHelpers = {
// [DUYARLI GÖRSEL] TMDB görseli için farklı ekran genişliklerine uygun srcset üretir.
getTmdbImageSrcSet(url, widths = [154, 185, 342, 500]) {
    if (typeof url !== 'string') return '';
    const match = url.match(/^(https:\/\/image\.tmdb\.org\/t\/p\/)(?:w\d+|original)(\/.*)$/);
    if (!match) return '';
    return widths.map(width => `${match[1]}w${width}${match[2]} ${width}w`).join(', ');
},
// [YEDEK GÖRSEL] Görsel yüklenemezse tekrar denemeyi durdurur ve yer tutucu gösterir.
handleImageError(event) {
    const image = event && event.target;
    if (!image || image.dataset.perdeFallbackApplied) return;
    image.dataset.perdeFallbackApplied = 'true';
    // Eski srcset/picture kaynakları, src değişse bile tarayıcı tarafından seçilmeye devam edebilir.
    image.removeAttribute('srcset');
    image.removeAttribute('sizes');
    image.parentElement?.querySelectorAll?.('source').forEach(source => source.removeAttribute('srcset'));
    const placeholder = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 480"><rect width="320" height="480" fill="#171923"/><g fill="none" stroke="#555b6b" stroke-width="8"><rect x="104" y="176" width="112" height="84" rx="10"/><path d="m116 244 34-35 24 22 18-18 20 24"/></g><text x="160" y="310" fill="#9ca3af" font-size="18" text-anchor="middle" font-family="Arial,sans-serif">Görsel yok</text></svg>';
    image.src = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(placeholder);
}
};
