// The "glass TV" in the first screen: category tabs (Sport, Știri, Filme, Copii) with the
// pixel-dissolve transition, short live clips over the stills, and a gentle auto-rotation that stops
// as soon as the visitor interacts.
import { createDissolve } from './pixel-dissolve.js';
import { canPlayClips, createTvClips } from './tv-clips.js';
import { nextIndex } from './tabs.js';

const ROTATE_MS = 6000;

export function initHeroTv(root) {
    if (!root) return;
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    if (tabs.length < 2) return;

    const panel = root.querySelector('[role="tabpanel"]');
    const screen = root.querySelector('.tv__screen');
    const title = root.querySelector('[data-tv-title]');
    const pauseButton = root.querySelector('[data-tv-pause]');
    const epgNow = document.querySelector('[data-tv-now]');
    const epgNext = document.querySelector('[data-tv-next]');
    const images = new Map([...root.querySelectorAll('[data-tv-image]')].map(img => [img.dataset.tvImage, img]));
    const sources = Object.fromEntries([...images].filter(([, img]) => img.dataset.tvVideo).map(([key, img]) => [key, img.dataset.tvVideo]));
    const canvas = root.querySelector('.tv__fx');
    const dissolve = canvas ? createDissolve(canvas) : null;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

    let current = Math.max(0, tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true'));
    let interacted = false;
    let visible = false;
    let timer = 0;
    let clips = null;
    let motionPaused = false;

    const loadDeferredImages = () => {
        images.forEach(img => {
            if (img.dataset.srcset) {
                img.srcset = img.dataset.srcset;
                delete img.dataset.srcset;
            }
            if (img.dataset.src) {
                img.src = img.dataset.src;
                delete img.dataset.src;
            }
        });
    };

    const select = (index, { focus = false } = {}) => {
        if (index === current) return;
        const previousTab = tabs[current];
        const tab = tabs[index];
        const fromImg = images.get(previousTab.dataset.tab);
        const toImg = images.get(tab.dataset.tab);

        loadDeferredImages();
        // Paint the outgoing picture (the playing clip, when there is one) on the canvas first,
        // then swap the real elements underneath.
        const fromPicture = clips?.frame(previousTab.dataset.tab) || fromImg;
        const transition = dissolve && fromPicture && toImg ? dissolve.play(fromPicture, toImg) : Promise.resolve();
        clips?.hide(previousTab.dataset.tab);
        fromImg?.classList.remove('is-active');
        fromImg?.setAttribute('aria-hidden', 'true');
        toImg?.classList.add('is-active');
        toImg?.removeAttribute('aria-hidden');

        previousTab.setAttribute('aria-selected', 'false');
        previousTab.tabIndex = -1;
        tab.setAttribute('aria-selected', 'true');
        tab.tabIndex = 0;
        if (focus) tab.focus();
        panel?.setAttribute('aria-labelledby', tab.id);
        if (title) title.textContent = tab.dataset.title || tab.textContent.trim();
        if (epgNow && tab.dataset.now) epgNow.textContent = tab.dataset.now;
        if (epgNext && tab.dataset.next) epgNext.textContent = tab.dataset.next;
        current = index;
        // Each clip starts on the same picture as its still, so it takes over once the dissolve ends.
        transition.then(() => {
            if (current === index) clips?.show(tab.dataset.tab);
        });
    };

    const schedule = () => {
        clearTimeout(timer);
        if (interacted || !visible || document.hidden || reducedMotion.matches) return;
        timer = setTimeout(() => {
            select((current + 1) % tabs.length);
            schedule();
        }, ROTATE_MS);
    };

    const takeOver = () => {
        interacted = true;
        clearTimeout(timer);
    };

    const setMotionPaused = paused => {
        motionPaused = paused;
        pauseButton?.setAttribute('aria-pressed', String(paused));
        // One control for all first-screen motion: the clip, the rotation (stopped by takeOver),
        // and, through this class, the category marquee, the pixel drift and the live dot.
        document.documentElement.classList.toggle('motion-paused', paused);
        clips?.setPaused(paused);
    };

    const syncOffscreen = () => clips?.setOffscreen(!visible || document.hidden);

    // Clips are an extra on top of the stills: only after the page has loaded, and not for visitors
    // who asked for less motion or less data, or who are on a slow connection.
    const startClips = () => {
        const connection = navigator.connection;
        const allowed = canPlayClips({
            reducedMotion: reducedMotion.matches,
            saveData: Boolean(connection?.saveData),
            effectiveType: connection?.effectiveType || ''
        });
        if (!screen || !allowed || !Object.keys(sources).length) return;
        // If the browser refuses to autoplay, show the play state so one tap starts the clip.
        clips = createTvClips(screen, sources, { onBlocked: () => setMotionPaused(true) });
        syncOffscreen();
        clips.show(tabs[current].dataset.tab);
    };

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => {
            takeOver();
            select(index);
        });
        tab.addEventListener('keydown', event => {
            const next = nextIndex(current, event.key, tabs.length);
            if (next === null) return;
            event.preventDefault();
            takeOver();
            select(next, { focus: true });
        });
    });

    pauseButton?.addEventListener('click', () => {
        takeOver();
        setMotionPaused(!motionPaused);
    });

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
            visible = entry.intersectionRatio >= 0.5;
            schedule();
            syncOffscreen();
        }, { threshold: [0, 0.5, 1] }).observe(root);
    }
    document.addEventListener('visibilitychange', () => {
        schedule();
        syncOffscreen();
    });
    // The pause control is offered whenever something on the first screen moves by itself.
    if (pauseButton) pauseButton.hidden = reducedMotion.matches;
    reducedMotion.addEventListener?.('change', () => {
        schedule();
        if (pauseButton) pauseButton.hidden = reducedMotion.matches;
        if (reducedMotion.matches) clips?.disable();
    });

    // Only the first picture loads with the page; the other three and the clips wait until it is idle.
    const whenIdle = window.requestIdleCallback || (callback => setTimeout(callback, 400));
    const afterLoad = () => whenIdle(() => {
        loadDeferredImages();
        startClips();
    });
    if (document.readyState === 'complete') afterLoad();
    else window.addEventListener('load', afterLoad, { once: true });
}
