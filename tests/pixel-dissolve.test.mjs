import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createDissolve } from '../js/pixel-dissolve.js';

// Minimal browser doubles: a frame queue we pump by hand, a recording 2D context.
let frames;
let nextFrameId;

beforeEach(() => {
    frames = new Map();
    nextFrameId = 1;
    globalThis.requestAnimationFrame = callback => {
        const id = nextFrameId++;
        frames.set(id, callback);
        return id;
    };
    globalThis.cancelAnimationFrame = id => frames.delete(id);
    globalThis.matchMedia = () => ({ matches: false });
    globalThis.devicePixelRatio = 1;
});

function fakeCanvas(width = 240, height = 135) {
    const calls = [];
    const context = {
        fillStyle: '#000000',
        drawImage: (...args) => calls.push(['drawImage', ...args]),
        clearRect: (...args) => calls.push(['clearRect', ...args]),
        fillRect: (...args) => calls.push(['fillRect', context.fillStyle, ...args])
    };
    return { calls, width: 0, height: 0, getContext: () => context, getBoundingClientRect: () => ({ width, height }) };
}

// Offscreen buffers handed to the controller; kept so tests can tell tile copies from image draws.
let buffers;
const createCanvas = () => {
    const buffer = fakeCanvas();
    buffers.push(buffer);
    return buffer;
};
beforeEach(() => {
    buffers = [];
});

function fakeImage(name, decode = () => Promise.resolve()) {
    return { name, naturalWidth: 1280, naturalHeight: 720, complete: true, decode };
}

const settle = () => new Promise(resolve => setImmediate(resolve));

async function pumpFrames(limit = 100, stepMs = 50) {
    let now = 1000;
    for (let i = 0; i < limit && frames.size; i += 1) {
        const [id, callback] = frames.entries().next().value;
        frames.delete(id);
        callback(now);
        now += stepMs;
        await settle();
    }
}

const drawsOf = (canvas, image) => canvas.calls.filter(call => call[0] === 'drawImage' && call[1] === image).length;

test('copies every tile of the next image exactly once, then clears the canvas', async () => {
    const canvas = fakeCanvas(240, 135); // tile 24 at dpr 1 -> 10 x 6 = 60 tiles
    const from = fakeImage('from');
    const to = fakeImage('to');
    const done = createDissolve(canvas, { tile: 24, duration: 650, createCanvas }).play(from, to);
    await settle();
    await pumpFrames();
    await done;
    assert.equal(drawsOf(canvas, from), 1);
    assert.equal(buffers.length, 1);
    assert.equal(drawsOf(buffers[0], to), 1);
    assert.equal(drawsOf(canvas, buffers[0]), 60);
    assert.deepEqual(canvas.calls.at(-1), ['clearRect', 0, 0, 240, 135]);
});

test('images are drawn with destination rectangles only', async () => {
    // With srcset, naturalWidth is density-corrected while drawImage source rectangles use bitmap
    // pixels, so a source crop computed from naturalWidth zooms into the corner on hi-dpi screens.
    const canvas = fakeCanvas(240, 135);
    const from = { ...fakeImage('from'), naturalWidth: 1600, naturalHeight: 900 };
    const to = fakeImage('to');
    const done = createDissolve(canvas, { tile: 24, duration: 650, createCanvas }).play(from, to);
    await settle();
    await pumpFrames();
    await done;
    const imageDraws = [canvas, ...buffers]
        .flatMap(target => target.calls)
        .filter(call => call[0] === 'drawImage' && (call[1] === from || call[1] === to));
    assert.equal(imageDraws.length, 2);
    for (const call of imageDraws) assert.equal(call.length, 6, 'drawImage(image, dx, dy, dw, dh)');
});

test('a playing clip can be the outgoing picture', async () => {
    // A <video> has videoWidth/videoHeight instead of naturalWidth/naturalHeight.
    const canvas = fakeCanvas(240, 135);
    const clip = { name: 'clip', videoWidth: 960, videoHeight: 540, readyState: 4 };
    const done = createDissolve(canvas, { tile: 24, duration: 650, createCanvas }).play(clip, fakeImage('to'));
    const clipDraws = canvas.calls.filter(call => call[0] === 'drawImage' && call[1] === clip);
    assert.equal(clipDraws.length, 1);
    assert.equal(clipDraws[0].length, 6, 'drawImage(video, dx, dy, dw, dh)');
    assert.deepEqual(clipDraws[0].slice(4), [240, 135]);
    await settle();
    await pumpFrames();
    await done;
    assert.equal(drawsOf(canvas, buffers[0]), 60);
});

test('reduced motion resolves at once without drawing', async () => {
    globalThis.matchMedia = query => ({ matches: query.includes('reduce') });
    const canvas = fakeCanvas();
    await createDissolve(canvas).play(fakeImage('from'), fakeImage('to'));
    assert.equal(canvas.calls.filter(call => call[0] === 'drawImage').length, 0);
    assert.equal(frames.size, 0);
});

test('the outgoing image is drawn synchronously, before the caller swaps images', () => {
    const canvas = fakeCanvas();
    const from = fakeImage('from');
    const dissolve = createDissolve(canvas, { createCanvas });
    dissolve.play(from, fakeImage('to'));
    assert.equal(drawsOf(canvas, from), 1);
    dissolve.cancel();
});

test('an image that never decodes clears the canvas without drawing it', async () => {
    const canvas = fakeCanvas();
    const stuck = fakeImage('to', () => new Promise(() => {}));
    await createDissolve(canvas, { decodeTimeout: 20 }).play(fakeImage('from'), stuck);
    assert.equal(drawsOf(canvas, stuck), 0);
    assert.equal(canvas.calls.at(-1)[0], 'clearRect');
    assert.equal(frames.size, 0);
});

test('cancel resolves a running transition and stops drawing', async () => {
    const canvas = fakeCanvas();
    const dissolve = createDissolve(canvas, { tile: 24, duration: 650, createCanvas });
    const done = dissolve.play(fakeImage('from'), fakeImage('to'));
    await settle();
    await pumpFrames(3);
    dissolve.cancel();
    await done;
    const drawnAtCancel = drawsOf(canvas, buffers[0]);
    assert.ok(drawnAtCancel < 60, `stopped early (${drawnAtCancel} tiles)`);
    await pumpFrames();
    assert.equal(drawsOf(canvas, buffers[0]), drawnAtCancel);
    assert.equal(canvas.calls.at(-1)[0], 'clearRect');
});

// --- From nothing: a page-coloured cover that lifts tile by tile (photos that build up from pixels) -----------
test('from a colour, the canvas is covered at once with that colour', () => {
    const canvas = fakeCanvas(240, 135);
    const dissolve = createDissolve(canvas, { createCanvas });
    dissolve.play('rgb(11, 13, 43)', fakeImage('photo'));
    // Synchronously, before the caller's next paint: the photo must never flash before its cover.
    assert.deepEqual(canvas.calls.find(call => call[0] === 'fillRect'), ['fillRect', 'rgb(11, 13, 43)', 0, 0, 240, 135]);
    dissolve.cancel();
});

test('from a colour, every tile is uncovered once to show the real photo, then the cover is gone', async () => {
    const canvas = fakeCanvas(240, 135); // tile 24 at dpr 1 -> 10 x 6 = 60 tiles
    const photo = fakeImage('photo');
    const done = createDissolve(canvas, { tile: 24, duration: 650, createCanvas }).play('#0b0d2b', photo);
    await settle();
    await pumpFrames();
    await done;
    const tileClears = canvas.calls.filter(call => call[0] === 'clearRect' && call[3] > 0 && call[3] <= 24 && call[4] <= 24);
    assert.equal(tileClears.length, 60);
    assert.equal(new Set(tileClears.map(call => `${call[1]},${call[2]}`)).size, 60, 'each tile once');
    assert.equal(drawsOf(canvas, photo), 0, 'the real <img> shows through; it is never drawn');
    assert.equal(buffers.length, 0, 'no offscreen buffer is needed');
    assert.deepEqual(canvas.calls.at(-1), ['clearRect', 0, 0, 240, 135]);
});

test('from a colour, a photo that never decodes still gets its cover lifted', async () => {
    const canvas = fakeCanvas();
    const stuck = fakeImage('photo', () => new Promise(() => {}));
    await createDissolve(canvas, { decodeTimeout: 20 }).play('#0b0d2b', stuck);
    const cover = canvas.calls.findIndex(call => call[0] === 'fillRect');
    assert.ok(cover >= 0, 'the cover was drawn');
    assert.deepEqual(canvas.calls.at(-1), ['clearRect', 0, 0, 240, 135], 'and lifted afterwards');
    assert.ok(canvas.calls.length - 1 > cover);
    assert.equal(frames.size, 0);
});

test('from a colour with reduced motion, no cover is ever drawn', async () => {
    globalThis.matchMedia = query => ({ matches: query.includes('reduce') });
    const canvas = fakeCanvas();
    await createDissolve(canvas).play('#0b0d2b', fakeImage('photo'));
    assert.equal(canvas.calls.filter(call => call[0] === 'fillRect').length, 0);
});
