// WCAG 2.x contrast ratio between two #rrggbb colours (test-only helper).
function channel(value) {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
    const digits = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(offset => parseInt(digits.slice(offset, offset + 2), 16));
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(hexA, hexB) {
    const [light, dark] = [luminance(hexA), luminance(hexB)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
}
