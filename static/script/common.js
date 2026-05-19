function initScrollAnimations() {
    const elements = document.querySelectorAll('.feature-card, .file-info-card, .data-table-container, .chart-card');
    if (elements.length === 0) {
        return;
    }

    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    elements.forEach((el, index) => {
        el.classList.add('fade-in');
        el.style.transitionDelay = `${index * 0.1}s`;
        observer.observe(el);
    });
}

function initSidebarToggle() {
    const toggle = document.querySelector('.sidebar-toggle');
    if (!toggle) {
        return;
    }

    const body = document.body;

    if (window.matchMedia('(max-width: 900px)').matches) {
        body.classList.add('sidebar-collapsed');
    }

    const syncAria = () => {
        const isCollapsed = body.classList.contains('sidebar-collapsed');
        toggle.setAttribute('aria-expanded', (!isCollapsed).toString());
    };

    syncAria();

    toggle.addEventListener('click', () => {
        body.classList.toggle('sidebar-collapsed');
        syncAria();
    });
}

function initSmoothScroll() {
    const anchors = document.querySelectorAll('a[href^="#"]');
    if (anchors.length === 0) {
        return;
    }

    anchors.forEach((anchor) => {
        anchor.addEventListener('click', (event) => {
            const target = document.querySelector(anchor.getAttribute('href'));
            if (!target) {
                return;
            }
            event.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
        });
    });
}

function initAccountMenu() {
    const menu = document.getElementById('account-menu');
    const authItem = document.querySelector('[data-auth-item]');
    const trigger = menu?.querySelector('.account-trigger');
    if (!menu || !authItem) {
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userid');
    if (userId) {
        localStorage.setItem('animeflowUserId', userId);
        params.delete('userid');
        const newQuery = params.toString();
        const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : '');
        window.history.replaceState({}, '', newUrl);
    }

    const syncAuthItem = () => {
        const hasUser = Boolean(localStorage.getItem('animeflowUserId'));
        authItem.textContent = hasUser ? '退出登录' : '登录';
        authItem.setAttribute('href', hasUser ? '#' : '/auth');
        authItem.dataset.action = hasUser ? 'logout' : 'login';
    };

    syncAuthItem();

    const setMenuOpen = (isOpen) => {
        menu.classList.toggle('is-open', isOpen);
        if (trigger) {
            trigger.setAttribute('aria-expanded', isOpen.toString());
        }
    };

    if (trigger) {
        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            const isOpen = menu.classList.contains('is-open');
            setMenuOpen(!isOpen);
        });
    }

    document.addEventListener('click', (event) => {
        if (!menu.contains(event.target)) {
            setMenuOpen(false);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setMenuOpen(false);
        }
    });

    authItem.addEventListener('click', (event) => {
        if (authItem.dataset.action !== 'logout') {
            return;
        }
        event.preventDefault();
        localStorage.removeItem('animeflowUserId');
        syncAuthItem();
        setMenuOpen(false);
        showNotification('已退出登录', 'success');
        window.location.href = '/auth';
    });
}

function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    notification.style.position = 'fixed';
    notification.style.top = '100px';
    notification.style.right = '20px';
    notification.style.padding = '1rem 1.5rem';
    notification.style.borderRadius = '12px';
    notification.style.background = 'rgba(255, 255, 255, 0.1)';
    notification.style.backdropFilter = 'blur(20px)';
    notification.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    notification.style.color = 'white';
    notification.style.zIndex = '9999';
    notification.style.transform = 'translateX(400px)';
    notification.style.transition = 'transform 0.3s ease';

    if (type === 'success') {
        notification.style.borderLeft = '4px solid #10b981';
    } else if (type === 'error') {
        notification.style.borderLeft = '4px solid #ef4444';
    } else if (type === 'warning') {
        notification.style.borderLeft = '4px solid #f59e0b';
    }
    else {
        notification.style.borderLeft = '4px solid #3b82f6';
    }

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

window.showNotification = showNotification;

document.addEventListener('DOMContentLoaded', () => {
    initScrollAnimations();
    initSidebarToggle();
    initSmoothScroll();
    initAccountMenu();
});
