import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initTabs, nextIndex, showDevice } from '../js/tabs.js';

test('arrow keys wrap around', () => {
    assert.equal(nextIndex(0, 'ArrowRight', 7), 1);
    assert.equal(nextIndex(6, 'ArrowRight', 7), 0);
    assert.equal(nextIndex(3, 'ArrowLeft', 7), 2);
    assert.equal(nextIndex(0, 'ArrowLeft', 7), 6);
});

test('Home and End jump to the ends', () => {
    assert.equal(nextIndex(4, 'Home', 7), 0);
    assert.equal(nextIndex(2, 'End', 7), 6);
});

test('other keys do nothing', () => {
    assert.equal(nextIndex(2, 'a', 7), null);
    assert.equal(nextIndex(2, 'Enter', 7), null);
});

test('up and down stay with the page (both tab lists are horizontal)', () => {
    assert.equal(nextIndex(2, 'ArrowDown', 7), null);
    assert.equal(nextIndex(2, 'ArrowUp', 7), null);
});

// --- Install tabs drive the device mockup -------------------------------------------------------------------
function fakeTabs(devices = ['samsung', 'telefon', 'mac']) {
    const panels = {};
    const tabs = devices.map((device, index) => {
        const attributes = { 'aria-controls': `p${index}`, 'aria-selected': String(index === 0) };
        const listeners = {};
        panels[`p${index}`] = { hidden: false, tabIndex: -1, setAttribute() {} };
        return {
            id: `t${index}`,
            dataset: { device },
            listeners,
            tabIndex: -1,
            getAttribute: name => attributes[name] ?? null,
            setAttribute: (name, value) => { attributes[name] = String(value); },
            addEventListener: (type, handler) => { listeners[type] = handler; },
            focus() {}
        };
    });
    const list = { hidden: true, querySelectorAll: () => tabs };
    globalThis.document = { getElementById: id => panels[id] ?? null };
    return { root: { querySelector: () => list }, tabs };
}

test('the page hears which tab is shown: at start, on click and from the keyboard', () => {
    const { root, tabs } = fakeTabs();
    const shown = [];
    initTabs(root, { onSelect: tab => shown.push(tab.dataset.device) });
    tabs[1].listeners.click();
    tabs[1].listeners.keydown({ key: 'ArrowRight', preventDefault() {} });
    assert.deepEqual(shown, ['samsung', 'telefon', 'mac']);
});

function fakeStage(device) {
    const log = [];
    return {
        log,
        dataset: { device },
        get offsetWidth() { log.push('reflow'); return 400; },
        classList: { add: name => log.push(`+${name}`), remove: name => log.push(`-${name}`) }
    };
}

test('another device takes the stage and replays its switch-on', () => {
    const stage = fakeStage('samsung');
    showDevice(stage, 'telefon');
    assert.equal(stage.dataset.device, 'telefon');
    assert.deepEqual(stage.log, ['-is-switching', 'reflow', '+is-switching']);
});

test('the device already shown (the first paint) is left as it is', () => {
    const stage = fakeStage('samsung');
    showDevice(stage, 'samsung');
    showDevice(stage, undefined);
    showDevice(null, 'lg');
    assert.equal(stage.dataset.device, 'samsung');
    assert.deepEqual(stage.log, []);
});
