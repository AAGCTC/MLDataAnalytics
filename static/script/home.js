function init3DCardEffect() {
    const cards = document.querySelectorAll('.feature-card, .chart-card, .scenario-card');
    if (cards.length === 0) {
        return;
    }

    cards.forEach((card) => {
        card.addEventListener('mousemove', (event) => {
            const rect = card.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = (y - centerY) / 10;
            const rotateY = (centerX - x) / 10;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    init3DCardEffect();

    const start = document.getElementById('index-start');
    if (start) {
        start.addEventListener('click', () => {
            if (localStorage.getItem('animeflowUserId')) {
                window.location.href = '/upload';
            } else {
                window.location.href = '/auth';
                showNotification('请先登录以使用上传功能', 'warning');
            }
        });
    }
});
