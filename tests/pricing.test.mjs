import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    PLANS,
    DEFAULT_CHOICE,
    findOption,
    currencyFor,
    formatPrice,
    durationLabel,
    giftLabel,
    isFavourite,
    orderMessage,
    pricingView
} from '../js/pricing.js';
import { detectCountry } from '../js/geo.js';

const NBSP = ' ';
const COMBINATIONS = ['standard', 'vip'].flatMap(plan => [1, 3, 6, 12].map(paid => [plan, paid]));

test("prices match the owner's table exactly", () => {
    const expected = {
        'standard 1': [12, 0], 'standard 3': [35, 1], 'standard 6': [60, 1], 'standard 12': [110, 1],
        'vip 1': [14, 0], 'vip 3': [39, 1], 'vip 6': [69, 2], 'vip 12': [139, 2]
    };
    for (const [plan, paid] of COMBINATIONS) {
        const option = findOption(plan, paid);
        assert.deepEqual([option.price, option.bonus], expected[`${plan} ${paid}`], `${plan} ${paid}`);
        assert.equal(option.paid, paid);
    }
    assert.equal(PLANS.standard.screens, 3);
    assert.equal(PLANS.vip.screens, 5);
    assert.deepEqual(DEFAULT_CHOICE, { plan: 'vip', paid: 3 });
});

test('duration and gift labels use correct Romanian plurals', () => {
    assert.equal(durationLabel(findOption('vip', 1)), '1 lună');
    assert.equal(durationLabel(findOption('vip', 3)), '3 luni + 1 lună cadou');
    assert.equal(durationLabel(findOption('standard', 6)), '6 luni + 1 lună cadou');
    assert.equal(durationLabel(findOption('vip', 6)), '6 luni + 2 luni cadou');
    assert.equal(durationLabel(findOption('vip', 12)), '12 luni + 2 luni cadou');
    assert.equal(giftLabel(findOption('vip', 1)), '');
    assert.equal(giftLabel(findOption('standard', 12)), '+1 lună cadou');
    assert.equal(giftLabel(findOption('vip', 6)), '+2 luni cadou');
});

test('only VIP 3+1 is the favourite', () => {
    const favourites = COMBINATIONS.filter(([plan, paid]) => isFavourite(plan, paid));
    assert.deepEqual(favourites, [['vip', 3]]);
});

test('only GB pays in pounds', () => {
    for (const country of ['GB', 'gb', ' GB ']) assert.equal(currencyFor(country), 'GBP', JSON.stringify(country));
    for (const country of ['IT', '', null, 'XX', 'GBR']) assert.equal(currencyFor(country), 'EUR', JSON.stringify(country));
});

test('prices are formatted with a non-breaking space', () => {
    assert.equal(formatPrice(39, 'EUR'), `39${NBSP}€`);
    assert.equal(formatPrice(139, 'GBP'), `139${NBSP}£`);
});

test('the order message names plan, duration and price', () => {
    assert.equal(orderMessage('vip', 3, 'EUR'), 'Salut! Vreau pachetul VIP · 3 luni + 1 lună cadou (39 €). Îmi trimiteți, vă rog, pașii de plată?');
    assert.equal(orderMessage('standard', 1, 'GBP'), 'Salut! Vreau pachetul Standard · 1 lună (12 £). Îmi trimiteți, vă rog, pașii de plată?');
    assert.ok(!orderMessage('vip', 12, 'EUR').includes(NBSP));
});

test('nothing produced mentions a per-month price', () => {
    const outputs = COMBINATIONS.flatMap(([plan, paid]) => {
        const option = findOption(plan, paid);
        return [durationLabel(option), giftLabel(option), orderMessage(plan, paid, 'EUR'), orderMessage(plan, paid, 'GBP')];
    });
    for (const text of outputs) {
        for (const banned of [/lun[ăa]\s*\//i, /pe lună/i, /\/\s*lună/i]) assert.doesNotMatch(text, banned, text);
    }
});

test('unknown plans or durations give null', () => {
    assert.equal(findOption('gold', 3), null);
    assert.equal(findOption('vip', 2), null);
});

const response = (body, { ok = true } = {}) => async () => ({ ok, json: async () => (typeof body === 'function' ? body() : body) });

test('detectCountry reads the country', async () => {
    assert.equal(await detectCountry({ fetchImpl: response({ country: 'gb' }) }), 'GB');
});

test('detectCountry gives null when the server answers with an error', async () => {
    assert.equal(await detectCountry({ fetchImpl: response({ country: 'GB' }, { ok: false }) }), null);
});

test('detectCountry gives null when the answer is not JSON', async () => {
    assert.equal(await detectCountry({ fetchImpl: response(() => { throw new SyntaxError('bad json'); }) }), null);
});

test('detectCountry gives null for a country that is not a 2-letter code', async () => {
    assert.equal(await detectCountry({ fetchImpl: response({ country: 'United Kingdom' }) }), null);
});

test('detectCountry gives null when the request fails', async () => {
    assert.equal(await detectCountry({ fetchImpl: async () => { throw new TypeError('offline'); } }), null);
});

test('detectCountry gives up after the timeout', async () => {
    const never = (url, options) => new Promise((resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
    const started = Date.now();
    assert.equal(await detectCountry({ fetchImpl: never, timeout: 20 }), null);
    assert.ok(Date.now() - started < 1000);
});

test('detectCountry gives up after the timeout even if fetch ignores the abort signal', async () => {
    assert.equal(await detectCountry({ fetchImpl: () => new Promise(() => {}), timeout: 20 }), null);
});

const orderText = href => decodeURIComponent(new URL(href).searchParams.get('text') ?? '');

test('pricingView keeps one currency everywhere', () => {
    const view = pricingView('vip', 3, 'GBP');
    assert.ok(view.price.endsWith('£'), view.price);
    assert.equal(view.options.length, 4);
    for (const option of view.options) assert.ok(option.price.endsWith('£'), option.price);
    assert.ok(orderText(view.orderHref).includes('(39 £)'), orderText(view.orderHref));
    assert.ok(!JSON.stringify(view).includes('€'));
});

test('switching to Standard relabels the gifts and drops the favourite', () => {
    const view = pricingView('standard', 6, 'EUR');
    assert.equal(view.title, 'Standard · 6 luni + 1 lună cadou');
    assert.equal(view.options[2].label, '6 luni + 1 lună cadou');
    assert.equal(view.options[3].gift, '+1 lună cadou');
    assert.equal(view.favourite, false);
    assert.ok(view.options.every(option => option.favourite === false));
    assert.deepEqual(view.benefits.slice(0, 2), ['Până la 3 ecrane, în aceeași casă', 'Calitate până la Full HD']);
});

test('the default view is VIP 3+1 at 39 € with its order link', () => {
    const view = pricingView('vip', 3, 'EUR');
    assert.equal(view.title, 'VIP · 3 luni + 1 lună cadou');
    assert.equal(view.price, `39${NBSP}€`);
    assert.equal(view.gift, '+1 lună cadou');
    assert.equal(view.favourite, true);
    assert.deepEqual(view.options.map(option => option.months), ['1 lună', '3 luni', '6 luni', '12 luni']);
    assert.deepEqual(view.benefits, [
        'Până la 5 ecrane, în aceeași casă',
        'Calitate până la 4K',
        'Canale românești în direct, cu ghid TV',
        'Filme și seriale la cerere',
        'Te ajutăm la instalare'
    ]);
    assert.equal(orderText(view.orderHref), orderMessage('vip', 3, 'EUR'));
});

test('an unknown choice falls back to the default package', () => {
    assert.equal(pricingView('gold', 2, 'EUR').title, 'VIP · 3 luni + 1 lună cadou');
});

test('each plan names the key words of its first benefits (what sets it apart)', () => {
    const vip = pricingView('vip', 3, 'EUR');
    const standard = pricingView('standard', 3, 'EUR');
    assert.deepEqual(vip.highlights, ['5 ecrane', '4K']);
    assert.deepEqual(standard.highlights, ['3 ecrane', 'Full HD']);
    for (const view of [vip, standard]) {
        view.highlights.forEach((words, index) => assert.ok(view.benefits[index].includes(words), words));
    }
});

test('pricingView says how many gift months the package has, for the squares in the price card', () => {
    assert.equal(pricingView('vip', 6, 'EUR').bonus, 2);
    assert.equal(pricingView('standard', 6, 'EUR').bonus, 1);
    assert.equal(pricingView('vip', 1, 'EUR').bonus, 0);
});
