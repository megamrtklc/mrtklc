/* Perde İzleme Sayfası Modülü
 * İzleme ekranındaki kart sıralaması ve sütun yerleşimini yönetir.
 * Yalnızca izleme rotası açıldığında yüklenir.
 */
(function () {
    'use strict';
    window.PerdeWatchPage = {
        // İzleme ekranındaki kartların tema renklerini belirler.
        getCardClass() {
            if (this.theme === 'ivory') return 'bg-ivory-card border-ivory-200';
            if (this.theme === 'slate') return 'bg-slateLight-card border-slateLight-200';
            return 'bg-[#161922] border-gray-800';
        },
        // İzleme ekranındaki kullanıcı yorumlarını okur ve kaydeder.
        getReviews(itemId) {
            return this.reviews[itemId] || [];
        },
        submitReview() {
            if (!this.userCommentText.trim() || !this.selectedItem) return;
            if (!Array.isArray(this.reviews[this.selectedItem.id])) this.reviews[this.selectedItem.id] = [];
            this.reviews[this.selectedItem.id].unshift({
                author: this.currentProfile.name,
                rating: this.userRating,
                comment: this.userCommentText,
                date: new Date().toLocaleDateString()
            });
            safeStorageWrite('cine_reviews', this.reviews);
            this.userCommentText = '';
        },
        getWatchCardOrder(cardId) {
            const defaults = {
                left: ['player','season','episodes','synopsis','reviews'],
                right: ['credits','cast','similar']
            };
            const saved = this.watchPageConfig || {};
            const allIds = Object.values(defaults).flat();
            const removed = Array.isArray(saved.removed) ? saved.removed : [];
            const left = Array.isArray(saved.left) ? saved.left.filter(id => allIds.includes(id) && !removed.includes(id)) : [];
            const right = Array.isArray(saved.right) ? saved.right.filter(id => allIds.includes(id) && !removed.includes(id) && !left.includes(id)) : [];
            const all = [...left,...right];
            allIds.forEach(id => { if (!all.includes(id) && !removed.includes(id)) (defaults.left.includes(id) ? left : right).push(id); });
            const side = left.includes(cardId) ? left : right;
            return side.indexOf(cardId);
        },

        applyWatchPageLayout() {
            const config = this.watchPageConfig || {};
            const defaults = {
                left: ['player','season','episodes','synopsis','reviews'],
                right: ['credits','cast','similar']
            };
            const allIds = Object.values(defaults).flat();
            const removed = Array.isArray(config.removed) ? config.removed : [];
            const hidden = Array.isArray(config.hidden) ? config.hidden : [];
            const left = Array.isArray(config.left) ? config.left.filter((id,index,arr) => allIds.includes(id) && !removed.includes(id) && arr.indexOf(id) === index) : [];
            const right = Array.isArray(config.right) ? config.right.filter((id,index,arr) => allIds.includes(id) && !removed.includes(id) && !left.includes(id) && arr.indexOf(id) === index) : [];
            const used = new Set([...left,...right]);
            allIds.forEach(id => { if (!used.has(id) && !removed.includes(id)) (defaults.left.includes(id) ? left : right).push(id); });
            this.$nextTick(() => {
                const leftColumn = document.getElementById('watch-left-column');
                const rightColumn = document.getElementById('watch-right-column');
                if (!leftColumn || !rightColumn) return;
                const cards = new Map(Array.from(document.querySelectorAll('[data-watch-card]')).map(node => [node.dataset.watchCard,node]));
                allIds.forEach(id => { const node=cards.get(id); if(node) node.hidden=removed.includes(id)||hidden.includes(id); });
                left.forEach((id,index) => { const node=cards.get(id); if(node){node.hidden=hidden.includes(id);node.style.order=String(index);leftColumn.appendChild(node);} });
                right.forEach((id,index) => { const node=cards.get(id); if(node){node.hidden=hidden.includes(id);node.style.order=String(index);rightColumn.appendChild(node);} });
            });
        },
        // Oyuncu ve benzer yapım şeritlerini yatay kaydırır.
        scrollCast(direction) {
            const container = document.getElementById('castContainer');
            if (container) container.scrollBy({ left: 180 * direction, behavior: 'smooth' });
        },
        scrollSimilar(direction) {
            const container = document.getElementById('similarContainer');
            if (container) container.scrollBy({ left: 180 * direction, behavior: 'smooth' });
        }
    };
})();
