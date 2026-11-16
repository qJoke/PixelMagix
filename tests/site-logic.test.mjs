import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildWhatsAppUrl, TRIAL_MESSAGE, WHATSAPP_NUMBER } from '../js/whatsapp.js';
import { coverRect, tileOrder } from '../js/dissolve-math.js';
import { contrastRatio } from './helpers/contrast.mjs';

test('trial link encodes Romanian diacritics', () => {
    const url = buildWhatsAppUrl(TRIAL_MESSAGE);
    assert.ok(url.startsWith('https://wa.me/447449765468?text='));
    assert.equal(decodeURIComponent(url.split('text=')[1]), TRIAL_MESSAGE);
    assert.ok(url.includes('%C4%83')); // ă
});

test('blank message falls back to trial text', () => {
    assert.equal(buildWhatsAppUrl('   '), buildWhatsAppUrl(TRIAL_MESSAGE));
});

test('non-digits are stripped from the phone number', () => {
    assert.equal(WHATSAPP_NUMBER, '447449765468');
    assert.ok(buildWhatsAppUrl('Salut', '+44 7449 765468').startsWith('https://wa.me/447449765468?text=Salut'));
});

test('coverRect crops a 16:9 source into a 4:3 frame centrally', () => {
    assert.deepEqual(coverRect(1600, 900, 400, 300), { sx: 200, sy: 0, sw: 1200, sh: 900 });
});

test('coverRect crops a 4:3 source into a 16:9 frame centrally', () => {
    assert.deepEqual(coverRect(1200, 900, 1600, 900), { sx: 0, sy: 112.5, sw: 1200, sh: 675 });
});

test('tileOrder is a deterministic permutation', () => {
    const a = tileOrder(144, 7);
    const b = tileOrder(144, 7);
    assert.deepEqual(a, b);
    assert.deepEqual([...a].sort((x, y) => x - y), [...Array(144).keys()]);
    assert.notDeepEqual(a, [...Array(144).keys()]);
});

test('contrast helper matches WCAG reference values', () => {
    assert.equal(Number(contrastRatio('#000000', '#ffffff').toFixed(2)), 21);
    assert.equal(Number(contrastRatio('#777777', '#ffffff').toFixed(2)), 4.48);
});

test('primary button label contrast holds on every gradient stop', () => {
    for (const stop of ['#15cef6', '#7fa8f5', '#a993ee', '#db84e8']) {
        assert.ok(contrastRatio('#070818', stop) >= 4.5, stop);
    }
});

test('WhatsApp button uses dark text on green', () => {
    assert.ok(contrastRatio('#04140b', '#25d366') >= 4.5);
});
