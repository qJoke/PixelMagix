// Desktop only: near the main buttons the pointer leaves a short trail of brand-coloured pixels (wand dust).
// A pool of 24 elements moved in one rAF loop that stops when the last one fades. Off with reduced motion;
// the motion pause button stops new sparkles.

export const SPARKLE_COLOURS = ['#15cef6', '#9b82e4', '#db84e8', '#db37d5', '#ffffff'];
const MAX = 24;

// Within `r` px of a visible box? (A button in a hidden tab has an empty box at 0,0.)
export const nearAny = (x, y, boxes, r) =>
    boxes.some(b => b.width > 0 && x >= b.left - r && x <= b.right + r && y >= b.top - r && y <= b.bottom + r);

// The sparkles without the DOM: fixed slots (the oldest is reused), viewport pixels, times in ms.
export function createSparkles({ max = MAX, spacing = 10, life = 800, random = Math.random } = {}) {
    const slots = Array(max).fill(null);
    let next = 0;
    let last = null;
    const emit = (x, y) => {
        slots[next] = {
            x, y, age: 0,
            vx: (random() - 0.5) * 0.08,
            vy: (random() - 0.6) * 0.06,
            life: life * (0.7 + random() * 0.3),
            size: 3 + random() * 2,
            colour: SPARKLE_COLOURS[Math.floor(random() * SPARKLE_COLOURS.length)]
        };
        next = (next + 1) % max;
    };
    return {
        slots,
        emit,
        // One sparkle every `spacing` px along the pointer's path (two at most per frame).
        trail(x, y) {
            const d = last ? Math.hypot(x - last.x, y - last.y) : 0;
            if (last && d < spacing) return;
            const n = last ? Math.min(2, Math.floor(d / spacing)) : 0;
            for (let i = 1; i <= n; i += 1) emit(last.x + ((x - last.x) * i) / n, last.y + ((y - last.y) * i) / n);
            last = { x, y };
        },
        reset() {
            last = null;
        },
        step(ms) {
            let alive = 0;
            slots.forEach((s, i) => {
                if (!s) return;
                s.age += ms;
                if (s.age >= s.life) {
                    slots[i] = null;
                    return;
                }
                s.x += s.vx * ms;
                s.y += s.vy * ms;
                s.vy += 0.0001 * ms;
                alive += 1;
            });
            return alive;
        }
    };
}

export function initSparkleTrail(doc = document, { matchMedia = globalThis.matchMedia, raf = globalThis.requestAnimationFrame } = {}) {
    const reduced = matchMedia?.('(prefers-reduced-motion: reduce)');
    const buttons = [...doc.querySelectorAll('.btn--primary')];
    if (!matchMedia?.('(hover: hover) and (pointer: fine)').matches || !reduced || reduced.matches || !buttons.length) return null;
    const system = createSparkles();
    const dots = [];
    let pointer = null;
    let frame = 0;
    let time = 0;

    const render = () => {
        if (!dots.length) {
            if (!system.slots.some(Boolean)) return;
            const layer = doc.createElement('div');
            layer.className = 'sparkles';
            layer.setAttribute('aria-hidden', 'true');
            for (let i = 0; i < MAX; i += 1) dots.push(layer.appendChild(doc.createElement('i')));
            doc.body.appendChild(layer);
        }
        system.slots.forEach((s, i) => {
            const style = dots[i].style;
            const fade = s ? 1 - s.age / s.life : 0;
            style.opacity = fade.toFixed(2);
            if (!s) return;
            style.color = s.colour;
            style.transform = `translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,0) scale(${((s.size / 5) * (0.4 + 0.6 * fade)).toFixed(2)})`;
        });
    };

    const tick = stamp => {
        const elapsed = time ? Math.min(stamp - time, 48) : 16;
        time = stamp;
        if (pointer) {
            const paused = doc.documentElement.classList.contains('motion-paused') || reduced.matches;
            if (!paused && nearAny(pointer.x, pointer.y, buttons.map(button => button.getBoundingClientRect()), 64)) system.trail(pointer.x, pointer.y);
            else system.reset();
            pointer = null;
        }
        const alive = system.step(elapsed);
        render();
        frame = alive ? raf(tick) : (time = 0);
    };

    doc.addEventListener('pointermove', event => {
        if (event.pointerType === 'touch') return;
        pointer = { x: event.clientX, y: event.clientY };
        if (!frame) frame = raf(tick);
    }, { passive: true });
    return system;
}
