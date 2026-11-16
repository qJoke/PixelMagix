// Canvas "pixel-dissolve": the next image appears tile by tile, like the pixel hat in the logo.
// Contract: the caller swaps the real <img> first; this is decoration only. Under reduced motion,
// or when the next image cannot be decoded in time, play() resolves at once without drawing.
import { coverRect, tileOrder } from './dissolve-math.js';

const prefersReducedMotion = () =>
    typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;

function decodeWithin(image, ms) {
    return new Promise(resolve => {
        const timer = setTimeout(() => resolve(false), ms);
        const finish = ok => {
            clearTimeout(timer);
            resolve(ok);
        };
        if (typeof image.decode === 'function') {
            image.decode().then(() => finish(true), () => finish(false));
        } else {
            finish(Boolean(image.complete && image.naturalWidth));
        }
    });
}

// Intrinsic size of an <img>, or of the current frame of a <video> (the TV clips).
const sizeOf = source => ({
    width: source.naturalWidth || source.videoWidth || 0,
    height: source.naturalHeight || source.videoHeight || 0
});

// Draw a picture "object-fit: cover" using a destination rectangle only. With srcset, naturalWidth is
// density-corrected while drawImage source rectangles are in bitmap pixels, so source crops are
// unreliable; the aspect ratio of the intrinsic size is always right.
function drawCover(context, source, width, height) {
    const size = sizeOf(source);
    const crop = coverRect(size.width, size.height, width, height);
    const scale = width / crop.sw;
    context.drawImage(source, -crop.sx * scale, -crop.sy * scale, size.width * scale, size.height * scale);
}

const defaultCreateCanvas = () => document.createElement('canvas');

export function createDissolve(canvas, { tile = 24, duration = 650, decodeTimeout = 1500, createCanvas = defaultCreateCanvas } = {}) {
    const context = canvas.getContext('2d');
    let frame = 0;
    let generation = 0;
    let settle = null;

    const stop = () => {
        generation += 1;
        if (frame) globalThis.cancelAnimationFrame(frame);
        frame = 0;
        if (context) context.clearRect(0, 0, canvas.width, canvas.height);
        const resolve = settle;
        settle = null;
        if (resolve) resolve();
    };

    // Draws the outgoing picture (an <img> or a playing <video>) synchronously, so the caller can
    // swap the real elements right after without a flash, then waits for the incoming image and
    // reveals it tile by tile. `from` may also be a colour: the canvas (over the real photo) is then
    // covered with it at once, and the cover lifts tile by tile once the photo is decoded.
    const play = (from, toImg) => {
        stop();
        const token = generation;
        const cover = typeof from === 'string';
        if (!context || !from || !toImg || (!cover && !sizeOf(from).width) || prefersReducedMotion()) {
            return Promise.resolve();
        }

        const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
        const box = canvas.getBoundingClientRect();
        const width = Math.max(1, Math.round(box.width * ratio));
        const height = Math.max(1, Math.round(box.height * ratio));
        canvas.width = width;
        canvas.height = height;
        if (cover) {
            context.fillStyle = from;
            context.fillRect(0, 0, width, height);
        } else {
            drawCover(context, from, width, height);
        }

        return decodeWithin(toImg, decodeTimeout).then(ready => {
            if (token !== generation) return undefined;
            if (!ready || !toImg.naturalWidth) {
                stop();
                return undefined;
            }
            return reveal(token, cover ? null : toImg, width, height, ratio);
        });
    };

    // With no incoming image (a colour cover), each tile is cleared to uncover the real photo below.
    const reveal = (token, toImg, width, height, ratio) => {
        const size = tile * ratio;
        const cols = Math.ceil(width / size);
        const count = cols * Math.ceil(height / size);
        const order = tileOrder(count, Date.now() & 0xffff);
        // Render the incoming image once into a same-size buffer; tiles are then copied 1:1.
        let buffer = null;
        if (toImg) {
            buffer = createCanvas();
            buffer.width = width;
            buffer.height = height;
            drawCover(buffer.getContext('2d'), toImg, width, height);
        }

        return new Promise(resolve => {
            settle = resolve;
            let start = 0;
            let drawn = 0;
            const step = now => {
                if (token !== generation) return;
                if (!start) start = now;
                const progress = Math.min(1, (now - start) / duration);
                const target = progress >= 1 ? count : Math.floor(progress * count);
                for (; drawn < target; drawn += 1) {
                    const index = order[drawn];
                    const x = (index % cols) * size;
                    const y = Math.floor(index / cols) * size;
                    const w = Math.min(size, width - x);
                    const h = Math.min(size, height - y);
                    if (buffer) context.drawImage(buffer, x, y, w, h, x, y, w, h);
                    else context.clearRect(x, y, w, h);
                }
                if (progress < 1) {
                    frame = globalThis.requestAnimationFrame(step);
                } else {
                    frame = 0;
                    stop();
                }
            };
            frame = globalThis.requestAnimationFrame(step);
        });
    };

    return { play, cancel: stop };
}
