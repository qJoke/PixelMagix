// Desktop only (fine pointer): the light on the glass cards follows the pointer, and the TV leans a
// little toward it. Pure decoration: nothing happens on touch screens or with reduced motion.

const LIT_SELECTOR = '.tile, .step, .faq__item, .cta-band, .pricing__card, .install__panel, .diaspora__card, .final-cta__card, .tv';
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = value => Math.round(value * 100) / 100 || 0;

// Degrees to rotate the TV so it leans toward the pointer (x/y in viewport pixels).
export function tiltFor(x, y, rect, max = 5) {
    const px = clamp((x - rect.left) / rect.width, 0, 1);
    const py = clamp((y - rect.top) / rect.height, 0, 1);
    return { rx: round((0.5 - py) * 2 * max), ry: round((px - 0.5) * 2 * max) };
}

export function initPointerFx(doc = document) {
    const fine = globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;

    const tv = doc.querySelector('[data-tv]');
    const stage = tv?.closest('.hero__media');
    let lit = null;
    let pending = null;
    let frame = 0;

    const setLit = element => {
        if (element === lit) return;
        lit?.classList.remove('is-lit');
        lit = element;
        lit?.classList.add('is-lit');
    };

    const setTilt = (rx, ry) => {
        if (!tv) return;
        tv.style.setProperty('--tilt-x', `${rx}deg`);
        tv.style.setProperty('--tilt-y', `${ry}deg`);
    };

    const update = () => {
        frame = 0;
        const event = pending;
        const target = event.target instanceof Element ? event.target.closest(LIT_SELECTOR) : null;
        setLit(target);
        if (lit) {
            const box = lit.getBoundingClientRect();
            lit.style.setProperty('--mx', `${Math.round(event.clientX - box.left)}px`);
            lit.style.setProperty('--my', `${Math.round(event.clientY - box.top)}px`);
        }
        if (stage) {
            const box = stage.getBoundingClientRect();
            const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
            const { rx, ry } = inside ? tiltFor(event.clientX, event.clientY, box, 4) : { rx: 0, ry: 0 };
            setTilt(rx, ry);
        }
    };

    doc.addEventListener('pointermove', event => {
        pending = event;
        if (!frame) frame = requestAnimationFrame(update);
    }, { passive: true });
    doc.documentElement.addEventListener('pointerleave', () => {
        setLit(null);
        setTilt(0, 0);
    });
}
