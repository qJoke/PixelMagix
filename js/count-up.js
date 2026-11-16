// Big numbers ("12.000+") count up once when their card appears. The final text is in the HTML,
// so without JavaScript or with reduced motion the number is simply there.

export function formatThousands(value) {
    return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const easeOutCubic = t => 1 - (1 - t) ** 3;

export function countUp(element, { to, suffix = '', duration = 1400, raf = globalThis.requestAnimationFrame } = {}) {
    return new Promise(resolve => {
        let start = null;
        const step = now => {
            if (start === null) start = now;
            const progress = Math.min(1, (now - start) / duration);
            element.textContent = `${formatThousands(to * easeOutCubic(progress))}${suffix}`;
            if (progress < 1) raf(step);
            else resolve();
        };
        raf(step);
    });
}
