// Page chrome: glass refraction opt-in, header shadow on scroll, active item in the mobile tab bar.

const CHROMIUM_BRANDS = /Chromium|Google Chrome|Microsoft Edge|Opera/;

function enableRefraction(root) {
    // SVG refraction in backdrop-filter renders only in Chromium; keep it to desktops (fine pointer)
    // so phones (incl. the Facebook in-app browser) never pay for it.
    const brands = globalThis.navigator?.userAgentData?.brands || [];
    const isChromium = brands.some(entry => CHROMIUM_BRANDS.test(entry.brand));
    if (isChromium && matchMedia('(pointer: fine)').matches) root.classList.add('lg-refract');
}

function trackHeader(header) {
    if (!header) return;
    let ticking = false;
    const update = () => {
        header.classList.toggle('is-scrolled', window.scrollY > 8);
        ticking = false;
    };
    update();
    window.addEventListener('scroll', () => {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
        }
    }, { passive: true });
}

// Where the sliding highlight of the tab bar goes: over the active item, relative to the bar.
export function glowFor(itemRect, barRect) {
    return { x: Math.round(itemRect.left - barRect.left), w: Math.round(itemRect.width) };
}

function trackTabbar(tabbar) {
    if (!tabbar || !('IntersectionObserver' in window)) return;
    const items = [...tabbar.querySelectorAll('a[href^="#"]')];
    const sections = items
        .map(item => document.getElementById(item.getAttribute('href').slice(1)))
        .filter(Boolean);

    // One highlight that slides between items (iOS style) instead of each item lighting up.
    const glow = document.createElement('span');
    glow.className = 'tabbar__glow';
    glow.setAttribute('aria-hidden', 'true');
    tabbar.prepend(glow);
    tabbar.classList.add('has-glow');
    const placeGlow = () => {
        const active = items.find(item => item.classList.contains('is-active'));
        if (!active) return;
        const { x, w } = glowFor(active.getBoundingClientRect(), tabbar.getBoundingClientRect());
        glow.style.setProperty('--glow-x', `${x}px`);
        glow.style.setProperty('--glow-w', `${w}px`);
    };

    const setActive = id => {
        items.forEach(item => {
            const active = item.getAttribute('href') === `#${id}`;
            item.classList.toggle('is-active', active);
            if (active) item.setAttribute('aria-current', 'true');
            else item.removeAttribute('aria-current');
        });
        placeGlow();
    };
    placeGlow();
    window.addEventListener('resize', placeGlow, { passive: true });
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) setActive(entry.target.id);
        });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(section => observer.observe(section));
}

export function initSiteChrome() {
    enableRefraction(document.documentElement);
    trackHeader(document.querySelector('[data-header]'));
    trackTabbar(document.querySelector('.tabbar'));
}
