import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMeasurement } from '../js/measure.js';
import { CONSENT_KEY } from '../js/consent.js';
import { pricingView } from '../js/pricing.js';

const NOW = Date.UTC(2026, 10, 14, 20, 0, 0);
const BOTH = { metaPixelId: '1234567890123456', ga4Id: 'G-TEST12345' };
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup({ config = BOTH, stored = null, hash = '', cookies = '' } = {}) {
    const data = new Map(stored ? [[CONSENT_KEY, JSON.stringify({ v: 1, at: NOW - 1000, ...stored })]] : []);
    const storage = { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
    const cookieWrites = [];
    const listeners = {};
    const footer = { hidden: true };
    const openButton = { addEventListener: (type, handler) => { openButton[`on${type}`] = handler; } };
    const pricing = { id: 'preturi' };
    class FakeObserver {
        constructor(callback, options) {
            Object.assign(this, { callback, options, observed: [] });
            FakeObserver.last = this;
        }
        observe(node) { this.observed.push(node); }
        disconnect() { this.disconnected = true; }
    }
    const nodes = { '[data-consent-footer]': footer, '[data-consent-open]': openButton, '[data-consent]': { banner: true }, '[data-consent-status]': { status: true } };
    const doc = {
        get cookie() { return cookies; },
        set cookie(value) { cookieWrites.push(value); },
        querySelector: selector => nodes[selector] ?? null,
        getElementById: id => (id === 'preturi' ? pricing : null),
        addEventListener: (type, handler) => { (listeners[type] ??= []).push(handler); }
    };
    const win = { location: { hash, hostname: 'pixelmagix.shop' }, IntersectionObserver: FakeObserver };
    const banner = { loads: 0, shows: [], opens: [], options: null };
    const loadBanner = async () => {
        banner.loads += 1;
        return {
            initConsentBanner: (root, options) => {
                banner.root = root;
                banner.options = options;
                return { show: choice => banner.shows.push(choice), openSettings: (choice, from) => banner.opens.push([choice, from]) };
            }
        };
    };
    const trackers = { loads: 0, applied: [], sent: [] };
    const loadTrackers = async () => {
        trackers.loads += 1;
        return {
            applyChoice: choice => trackers.applied.push({ statistici: choice.statistici, marketing: choice.marketing }),
            send: (name, payload, choice) => trackers.sent.push([name, payload, { statistici: choice.statistici, marketing: choice.marketing }])
        };
    };
    const idle = [];
    const measurement = createMeasurement({ doc, win, storage, config, loadBanner, loadTrackers, now: () => NOW, idle: callback => idle.push(callback) });
    const click = target => listeners.click?.forEach(handler => handler({ target }));
    return { measurement, storage, cookieWrites, listeners, footer, openButton, pricing, FakeObserver, banner, trackers, idle, click };
}

const link = (href, selectors = []) => {
    const anchor = { href, matches: selector => selectors.includes(selector) };
    return { closest: selector => (selector === 'a[href]' ? anchor : null) };
};

test('before any choice nothing is loaded, written or set; only the banner shows', async () => {
    const { measurement, storage, cookieWrites, banner, trackers, idle, footer } = setup({ cookies: '_ga=GA1.1.1.1' });
    measurement.init();
    measurement.track('trial');
    await flush();
    assert.equal(trackers.loads, 0);
    assert.equal(storage.data.size, 0);
    assert.deepEqual(cookieWrites, []);
    assert.deepEqual(idle, []);
    assert.equal(banner.loads, 1);
    assert.deepEqual(banner.shows, [null]);
    assert.equal(footer.hidden, false, 'the footer offers "Setări cookie"');
    assert.deepEqual(banner.options.enabled, { statistici: true, marketing: true });
});

test('with both IDs empty there is no banner, no footer link and nothing listening', async () => {
    const { measurement, banner, footer, listeners, FakeObserver } = setup({ config: { metaPixelId: '', ga4Id: '' } });
    measurement.init();
    await flush();
    assert.equal(banner.loads, 0);
    assert.equal(footer.hidden, true);
    assert.equal(listeners.click, undefined);
    assert.equal(FakeObserver.last, undefined);
});

test('a stored yes loads the trackers only once the page is idle; a stored no never does', async () => {
    const yes = setup({ stored: { statistici: true, marketing: false } });
    yes.measurement.init();
    await flush();
    assert.equal(yes.trackers.loads, 0, 'not during the first paint');
    assert.equal(yes.banner.loads, 0, 'no banner over an existing choice');
    assert.equal(yes.idle.length, 1);
    yes.idle[0]();
    await flush();
    assert.equal(yes.trackers.loads, 1);
    assert.deepEqual(yes.trackers.applied, [{ statistici: true, marketing: false }]);

    const no = setup({ stored: { statistici: false, marketing: false } });
    no.measurement.init();
    await flush();
    assert.deepEqual([no.idle.length, no.trackers.loads, no.banner.loads], [0, 0, 0]);
});

test('a decision is saved and applied at once', async () => {
    const { measurement, storage, banner, trackers } = setup();
    measurement.init();
    await flush();
    banner.options.onChoice({ statistici: false, marketing: true });
    assert.deepEqual(JSON.parse(storage.data.get(CONSENT_KEY)), { v: 1, statistici: false, marketing: true, at: NOW });
    await flush();
    assert.equal(trackers.loads, 1);
    assert.deepEqual(trackers.applied, [{ statistici: false, marketing: true }]);
});

test('events before consent are dropped; after it, each one is sent once per page view', async () => {
    const { measurement, banner, trackers } = setup();
    measurement.init();
    await flush();
    measurement.track('trial');
    banner.options.onChoice({ statistici: true, marketing: true });
    measurement.track('trial');
    measurement.track('trial');
    const vip = pricingView('vip', 6, 'EUR');
    measurement.track('plan_chosen', vip);
    measurement.track('plan_chosen', pricingView('standard', 6, 'EUR'));
    measurement.track('plan_chosen', vip);
    await flush();
    assert.deepEqual(trackers.sent.map(([name, payload]) => [name, payload?.plan ?? null]), [
        ['trial', null],
        ['plan_chosen', 'vip'],
        ['plan_chosen', 'standard']
    ]);
});

test('Prețuri seen before the choice counts as soon as consent is given', async () => {
    const { measurement, banner, trackers, FakeObserver, pricing } = setup();
    measurement.init();
    await flush();
    assert.deepEqual(FakeObserver.last.observed, [pricing]);
    assert.equal(FakeObserver.last.options.rootMargin, '-40% 0px -40% 0px');
    FakeObserver.last.callback([{ isIntersecting: true }]);
    assert.equal(FakeObserver.last.disconnected, true);
    banner.options.onChoice({ statistici: false, marketing: true });
    await flush();
    assert.deepEqual(trackers.sent.map(([name]) => name), ['pricing_seen']);
});

test('saying no after yes stops the trackers and removes their cookies', async () => {
    const { measurement, banner, trackers, cookieWrites } = setup({ cookies: '_ga=GA1.1.1.1; _ga_TEST12345=GS1; _fbp=fb.1.2.3; lang=ro' });
    measurement.init();
    await flush();
    banner.options.onChoice({ statistici: true, marketing: true });
    await flush();
    assert.deepEqual(cookieWrites, [], 'a yes removes nothing');
    banner.options.onChoice({ statistici: false, marketing: false });
    assert.deepEqual(trackers.applied.at(-1), { statistici: false, marketing: false });
    for (const name of ['_ga', '_ga_TEST12345', '_fbp']) {
        assert.ok(cookieWrites.includes(`${name}=; Max-Age=0; path=/`), name);
        assert.ok(cookieWrites.includes(`${name}=; Max-Age=0; path=/; domain=.pixelmagix.shop`), name);
    }
    assert.ok(!cookieWrites.some(write => write.startsWith('lang=')));
    measurement.track('trial');
    await flush();
    assert.deepEqual(trackers.sent, [], 'nothing is sent after the withdrawal');
});

test('"Setări cookie" and a link to #setari-cookie open the settings with the current choice', async () => {
    const { measurement, banner, openButton } = setup({ stored: { statistici: true, marketing: false }, hash: '#setari-cookie' });
    measurement.init();
    await flush();
    assert.equal(banner.opens.length, 1);
    assert.deepEqual(banner.opens[0][0], { statistici: true, marketing: false, at: NOW - 1000 });
    openButton.onclick({ currentTarget: openButton });
    await flush();
    assert.equal(banner.opens.length, 2);
    assert.equal(banner.opens[1][1], openButton, 'focus will go back to the footer button');
    assert.equal(banner.loads, 1, 'the banner code is loaded once');
});

test('clicks on the trial, Messenger and other WhatsApp links are measured; the order link is left to the price card', async () => {
    const { measurement, banner, trackers, click } = setup();
    measurement.init();
    await flush();
    banner.options.onChoice({ statistici: true, marketing: true });
    click(link('https://wa.me/447449765468?text=Salut', ['.js-trial']));
    click(link('https://wa.me/447449765468?text=Comand%C4%83', ['[data-order]']));
    click(link('https://m.me/pixelmagix.shop'));
    click(link('https://wa.me/447449765468'));
    click(link('https://www.facebook.com/pixelmagix.shop/'));
    click({ closest: () => null });
    await flush();
    assert.deepEqual(trackers.sent.map(([name, payload]) => [name, payload?.channel ?? null]), [
        ['trial', null],
        ['contact', 'Messenger'],
        ['contact', 'WhatsApp']
    ]);
});
