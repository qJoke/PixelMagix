import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONSENT_DAYS, CONSENT_KEY, TRACKER_COOKIES, clearCookies, readConsent, saveConsent } from '../js/consent.js';
import { TRACKING, enabledTrackers } from '../js/tracking-config.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 14, 20, 0, 0);

function memoryStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        data,
        getItem: key => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => { data.set(key, String(value)); },
        removeItem: key => { data.delete(key); }
    };
}

test('a saved choice reads back exactly, under one key', () => {
    const storage = memoryStorage();
    const record = saveConsent(storage, { statistici: true, marketing: false }, NOW);
    assert.deepEqual(record, { statistici: true, marketing: false, at: NOW });
    assert.equal(CONSENT_KEY, 'pixelmagix-consent');
    assert.deepEqual([...storage.data.keys()], [CONSENT_KEY]);
    assert.deepEqual(readConsent(storage, NOW + DAY), { statistici: true, marketing: false, at: NOW });
});

test('the choice is remembered for 6 months (182 days), then asked again', () => {
    assert.equal(CONSENT_DAYS, 182);
    const storage = memoryStorage();
    saveConsent(storage, { statistici: false, marketing: true }, NOW);
    assert.ok(readConsent(storage, NOW + 181 * DAY));
    assert.equal(readConsent(storage, NOW + 182 * DAY), null);
});

test('only true counts as yes', () => {
    const storage = memoryStorage();
    assert.deepEqual(saveConsent(storage, { statistici: 'yes', marketing: 1 }, NOW), { statistici: false, marketing: false, at: NOW });
    assert.deepEqual(saveConsent(storage, {}, NOW), { statistici: false, marketing: false, at: NOW });
});

test('stale, foreign or broken records count as no choice', () => {
    const good = { v: 1, statistici: true, marketing: true, at: NOW };
    const cases = [
        null,
        'not json',
        '[]',
        JSON.stringify({ ...good, v: 2 }),
        JSON.stringify({ ...good, statistici: 'true' }),
        JSON.stringify({ ...good, marketing: undefined }),
        JSON.stringify({ ...good, at: 'yesterday' }),
        JSON.stringify({ ...good, at: NOW - 200 * DAY }),
        JSON.stringify({ ...good, at: NOW + 2 * DAY })
    ];
    for (const value of cases) {
        const storage = memoryStorage(value === null ? {} : { [CONSENT_KEY]: value });
        assert.equal(readConsent(storage, NOW), null, String(value));
    }
    assert.deepEqual(readConsent(memoryStorage({ [CONSENT_KEY]: JSON.stringify(good) }), NOW), { statistici: true, marketing: true, at: NOW });
});

test('storage errors never break the page', () => {
    const broken = {
        getItem: () => { throw new Error('SecurityError'); },
        setItem: () => { throw new Error('QuotaExceededError'); }
    };
    assert.equal(readConsent(broken, NOW), null);
    assert.deepEqual(saveConsent(broken, { statistici: true, marketing: true }, NOW), { statistici: true, marketing: true, at: NOW });
    assert.equal(readConsent(undefined, NOW), null);
    assert.deepEqual(saveConsent(null, { statistici: false, marketing: true }, NOW), { statistici: false, marketing: true, at: NOW });
});

test('a tracker is on only with a well-formed ID', () => {
    assert.deepEqual(enabledTrackers({ metaPixelId: '', ga4Id: '' }), { statistici: false, marketing: false });
    assert.deepEqual(enabledTrackers({ metaPixelId: '1234567890123456', ga4Id: 'G-AB12CD34EF' }), { statistici: true, marketing: true });
    for (const metaPixelId of ['123', 'abc4567890123', '12345678901234567890123', ' 1234567890123456', '1234567890123456<']) {
        assert.equal(enabledTrackers({ metaPixelId, ga4Id: '' }).marketing, false, metaPixelId);
    }
    for (const ga4Id of ['UA-12345-1', 'G-abc12345', 'G-', 'GTM-ABC123', 'G-AB12 CD', 'AW-123456789']) {
        assert.equal(enabledTrackers({ metaPixelId: '', ga4Id }).statistici, false, ga4Id);
    }
    assert.deepEqual(Object.keys(TRACKING).sort(), ['ga4Id', 'metaPixelId']);
});

test('withdrawing removes only that category\'s tracker cookies, on the host and its parent domain', () => {
    const writes = [];
    const doc = {
        get cookie() { return 'theme=dark; _ga=GA1.1.1.1; _ga_TEST12345=GS1.1; _fbp=fb.1.1.1; _fbc=fb.1.1.abc; _gali=x'; },
        set cookie(value) { writes.push(value); }
    };
    clearCookies(doc, 'pixelmagix.shop', TRACKER_COOKIES.marketing);
    assert.deepEqual(writes, [
        '_fbp=; Max-Age=0; path=/', '_fbp=; Max-Age=0; path=/; domain=.pixelmagix.shop',
        '_fbc=; Max-Age=0; path=/', '_fbc=; Max-Age=0; path=/; domain=.pixelmagix.shop'
    ]);
    writes.length = 0;
    clearCookies(doc, 'www.pixelmagix.shop', TRACKER_COOKIES.statistici);
    const names = [...new Set(writes.map(write => write.split('=')[0]))];
    assert.deepEqual(names, ['_ga', '_ga_TEST12345', '_gali']);
    assert.ok(writes.includes('_ga=; Max-Age=0; path=/; domain=.www.pixelmagix.shop'));
    assert.ok(writes.includes('_ga=; Max-Age=0; path=/; domain=.pixelmagix.shop'));
    assert.ok(!writes.some(write => write.startsWith('theme=')), 'other cookies stay');
    writes.length = 0;
    clearCookies(doc, '127.0.0.1', TRACKER_COOKIES.marketing);
    assert.deepEqual(writes, ['_fbp=; Max-Age=0; path=/', '_fbc=; Max-Age=0; path=/']);
    writes.length = 0;
    clearCookies({ get cookie() { return ''; }, set cookie(value) { writes.push(value); } }, 'pixelmagix.shop', TRACKER_COOKIES.statistici);
    assert.deepEqual(writes, [], 'nothing to remove, nothing written');
});
