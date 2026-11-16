// Pure helpers for the pixel-dissolve transition (no DOM access, unit-tested in Node).

// Centered source crop that reproduces `object-fit: cover` when drawn into dstW x dstH.
// Multiply before dividing so exact ratios stay exact.
export function coverRect(srcW, srcH, dstW, dstH) {
    if (srcW * dstH > dstW * srcH) {
        const sw = (srcH * dstW) / dstH;
        return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
    }
    const sh = (srcW * dstH) / dstW;
    return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
}

// mulberry32: tiny seeded PRNG returning floats in [0, 1).
function mulberry32(seed) {
    let a = seed | 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Deterministic permutation of 0..count-1 (Fisher–Yates driven by the seeded PRNG).
export function tileOrder(count, seed) {
    const order = Array.from({ length: count }, (_, index) => index);
    const random = mulberry32(seed);
    for (let i = count - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
}
