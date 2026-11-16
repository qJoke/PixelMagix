import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SPARKLE_COLOURS, createSparkles, initSparkleTrail, nearAny } from '../js/sparkle-trail.js';

// Deterministic "random": cycles through a fixed list.
const sequence = (...values) => {
    let index = 0;
    return () => values[index++ % values.length];
};
const alive = system => system.slots.filter(Boolean);

// --- particles (no DOM) ---------------------------------------------------------------------------------
test('a sparkle drops along the pointer path every few pixels', () => {
    const system = createSparkles({ spacing: 12, random: sequence(0.5) });
    system.trail(0, 0);
    system.trail(5, 0);
    assert.equal(alive(system).length, 0, 'the first point and short moves drop nothing');
    system.trail(30, 0);
    assert.deepEqual(alive(system).map(sparkle => [sparkle.x, sparkle.y]), [[15, 0], [30, 0]]);
});

test('never more sparkles than the cap: the oldest make room', () => {
    const system = createSparkles({ max: 6, spacing: 10 });
    for (let x = 0; x <= 400; x += 10) system.trail(x, 0);
    assert.equal(system.slots.length, 6);
    assert.equal(alive(system).length, 6);
    assert.ok(alive(system).every(sparkle => sparkle.x > 300), 'only the newest are kept');
});

test('a sparkle drifts, fades and is gone once its life is over', () => {
    const system = createSparkles({ life: 600, random: sequence(0.5) });
    system.emit(100, 100);
    const [sparkle] = alive(system);
    assert.ok(SPARKLE_COLOURS.includes(sparkle.colour));
    assert.equal(system.step(300), 1);
    assert.ok(sparkle.age === 300 && (sparkle.x !== 100 || sparkle.y !== 100), 'it moved');
    assert.equal(system.step(400), 0);
    assert.equal(alive(system).length, 0);
});

test('leaving the buttons breaks the trail (no streak across the page on return)', () => {
    const system = createSparkles({ spacing: 10 });
    system.trail(0, 0);
    system.reset();
    system.trail(300, 0);
    assert.equal(alive(system).length, 0);
});

test('near means within the radius of a visible button', () => {
    const boxes = [{ left: 100, top: 100, right: 300, bottom: 150, width: 200, height: 50 }];
    assert.equal(nearAny(200, 120, boxes, 60), true, 'over it');
    assert.equal(nearAny(50, 120, boxes, 60), true, 'just beside it');
    assert.equal(nearAny(30, 120, boxes, 60), false, 'too far');
    // A button in a hidden tab reports an empty box at 0,0: never "near".
    assert.equal(nearAny(10, 10, [{ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }], 60), false);
});

// --- wiring (fake DOM) ------------------------------------------------------------------------------------
function fakePage({ fine = true, reduced = false } = {}) {
    const listeners = {};
    const frames = [];
    const classes = new Set();
    const element = tag => ({
        tag,
        children: [],
        style: {},
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        appendChild(child) { this.children.push(child); return child; }
    });
    const body = element('body');
    const button = { getBoundingClientRect: () => ({ left: 100, top: 100, right: 300, bottom: 150, width: 200, height: 50 }) };
    const doc = {
        body,
        documentElement: { classList: { contains: name => classes.has(name) } },
        createElement: element,
        querySelectorAll: () => [button],
        addEventListener: (type, handler) => { listeners[type] = handler; }
    };
    const matchMedia = query => ({ matches: query.includes('reduce') ? reduced : fine });
    const raf = callback => frames.push(callback);
    let now = 0;
    // One animation frame per pointer move, as in a browser at 60 fps.
    const move = (x, y, pointerType = 'mouse') => {
        listeners.pointermove?.({ clientX: x, clientY: y, pointerType });
        if (frames.length) frames.shift()((now += 16));
    };
    const layer = () => body.children.find(child => child.attributes['aria-hidden'] === 'true');
    return { doc, matchMedia, raf, listeners, classes, move, layer };
}

test('nothing starts on touch screens or with reduced motion', () => {
    for (const options of [{ fine: false }, { reduced: true }]) {
        const page = fakePage(options);
        assert.equal(initSparkleTrail(page.doc, { matchMedia: page.matchMedia, raf: page.raf }), null);
        assert.equal(page.listeners.pointermove, undefined);
    }
});

test('moving near a main button drops sparkles; far from it, nothing (and no extra DOM)', () => {
    const page = fakePage();
    initSparkleTrail(page.doc, { matchMedia: page.matchMedia, raf: page.raf });
    for (let x = 400; x <= 700; x += 20) page.move(x, 600);
    assert.equal(page.layer(), undefined, 'no sparkle layer while far away');
    for (let x = 110; x <= 290; x += 20) page.move(x, 125);
    const layer = page.layer();
    assert.ok(layer, 'a decorative layer appears');
    assert.equal(layer.attributes.class ?? layer.className, 'sparkles');
    assert.ok(layer.children.some(dot => Number(dot.style.opacity) > 0), 'some sparkles are visible');
});

test('the pause button stops new sparkles', () => {
    const page = fakePage();
    page.classes.add('motion-paused');
    initSparkleTrail(page.doc, { matchMedia: page.matchMedia, raf: page.raf });
    for (let x = 110; x <= 290; x += 20) page.move(x, 125);
    const layer = page.layer();
    assert.ok(!layer || layer.children.every(dot => !(Number(dot.style.opacity) > 0)));
});

test('touch moves on a hybrid screen are ignored', () => {
    const page = fakePage();
    initSparkleTrail(page.doc, { matchMedia: page.matchMedia, raf: page.raf });
    for (let x = 110; x <= 290; x += 20) page.move(x, 125, 'touch');
    assert.equal(page.layer(), undefined);
});
