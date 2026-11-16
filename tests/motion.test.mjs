import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REVEAL_SELECTOR, initReveal } from '../js/reveal.js';
import { countUp, formatThousands } from '../js/count-up.js';
import { tiltFor } from '../js/pointer-fx.js';
import { glowFor } from '../js/site-chrome.js';

// --- browser doubles -------------------------------------------------------------------------
function fakeElement(parentElement = null, log = []) {
    const classes = new Set();
    const props = {};
    return {
        parentElement,
        props,
        classes,
        classList: {
            add: name => { classes.add(name); log.push(`class ${name}`); },
            remove: name => classes.delete(name),
            contains: name => classes.has(name)
        },
        style: { setProperty: (name, value) => { props[name] = value; } }
    };
}

function fakeObserverClass(log) {
    return class FakeIO {
        static instances = [];
        constructor(callback, options) {
            this.callback = callback;
            this.options = options;
            this.observed = [];
            this.unobserved = [];
            FakeIO.instances.push(this);
        }
        observe(element) { this.observed.push(element); log.push('observe'); }
        unobserve(element) { this.unobserved.push(element); }
        fire(element, isIntersecting = true) { this.callback([{ target: element, isIntersecting }]); }
    };
}

function fakeDocument(groups, log = []) {
    const root = fakeElement(null, log);
    const targets = groups.flatMap(size => {
        const parent = {};
        return Array.from({ length: size }, () => fakeElement(parent, log));
    });
    return { root, targets, doc: { documentElement: root, querySelectorAll: () => targets } };
}

// --- reveal ----------------------------------------------------------------------------------
test('with reduced motion nothing is hidden and no observer starts', () => {
    const log = [];
    const IO = fakeObserverClass(log);
    const { root, doc } = fakeDocument([3], log);
    initReveal(doc, { reducedMotion: true, IO });
    assert.equal(root.classes.has('motion-ok'), false);
    assert.equal(IO.instances.length, 0);
});

test('without IntersectionObserver nothing is hidden', () => {
    const { root, doc } = fakeDocument([3]);
    initReveal(doc, { reducedMotion: false, IO: undefined });
    assert.equal(root.classes.has('motion-ok'), false);
});

test('targets cascade by their place among siblings, capped at 5', () => {
    const IO = fakeObserverClass([]);
    const { targets, doc } = fakeDocument([3, 8]);
    initReveal(doc, { reducedMotion: false, IO });
    assert.deepEqual(targets.map(target => target.props['--reveal-i']), ['0', '1', '2', '0', '1', '2', '3', '4', '5', '5', '5']);
    assert.ok(targets.every(target => target.classes.has('reveal')));
});

test('an element is revealed once, when it enters the screen', () => {
    const IO = fakeObserverClass([]);
    const revealed = [];
    const { targets, doc } = fakeDocument([2]);
    initReveal(doc, { reducedMotion: false, IO, onReveal: element => revealed.push(element) });
    const [observer] = IO.instances;
    observer.fire(targets[0], false);
    assert.equal(targets[0].classes.has('is-revealed'), false);
    observer.fire(targets[0]);
    assert.equal(targets[0].classes.has('is-revealed'), true);
    assert.deepEqual(observer.unobserved, [targets[0]]);
    assert.deepEqual(revealed, [targets[0]]);
});

test('content is hidden (motion-ok) only after every target is observed', () => {
    const log = [];
    const IO = fakeObserverClass(log);
    const { doc } = fakeDocument([4], log);
    initReveal(doc, { reducedMotion: false, IO });
    const firstHide = log.indexOf('class motion-ok');
    assert.ok(firstHide > 0);
    assert.equal(log.slice(0, firstHide).filter(entry => entry === 'observe').length, 4);
});

test('the selector covers the new sections but not the first screen', () => {
    for (const part of ['.tile', '.pricing__card', '.faq__item', '.final-cta__card', '.site-footer__grid > *', '.chat-demo', '.chat__msgs', '.device']) assert.ok(REVEAL_SELECTOR.includes(part), part);
    assert.ok(!REVEAL_SELECTOR.includes('hero'));
});

// --- counting numbers ------------------------------------------------------------------------
test('thousands use Romanian dots', () => {
    assert.equal(formatThousands(12000), '12.000');
    assert.equal(formatThousands(1300), '1.300');
    assert.equal(formatThousands(950), '950');
    assert.equal(formatThousands(0), '0');
});

test('countUp climbs and ends exactly on the target', async () => {
    const frames = [];
    const raf = callback => frames.push(callback);
    const element = { textContent: '12.000+' };
    const done = countUp(element, { to: 12000, suffix: '+', duration: 1000, raf });
    const seen = [];
    for (let time = 0; frames.length; time += 100) {
        frames.shift()(time);
        seen.push(element.textContent);
    }
    await done;
    assert.equal(seen[0], '0+');
    assert.equal(element.textContent, '12.000+');
    const values = seen.map(text => Number(text.replace(/\D/g, '')));
    assert.ok(values.every((value, index) => index === 0 || value >= values[index - 1]), 'never goes down');
    assert.ok(values.some(value => value > 0 && value < 12000), 'shows values in between');
});

// --- TV tilt and tab bar indicator -----------------------------------------------------------
test('the TV leans toward the pointer and never past the limit', () => {
    const rect = { left: 100, top: 50, width: 400, height: 200 };
    assert.deepEqual(tiltFor(300, 150, rect, 5), { rx: 0, ry: 0 });
    assert.deepEqual(tiltFor(500, 150, rect, 5), { rx: 0, ry: 5 });
    assert.deepEqual(tiltFor(300, 50, rect, 5), { rx: 5, ry: 0 });
    assert.deepEqual(tiltFor(9999, -9999, rect, 5), { rx: 5, ry: 5 });
});

test('the tab bar indicator sits over the active item', () => {
    assert.deepEqual(glowFor({ left: 110, width: 90 }, { left: 100 }), { x: 10, w: 90 });
});
