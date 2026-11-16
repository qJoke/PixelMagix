import assert from 'node:assert/strict';
import { test } from 'node:test';
import { META_SRC, GA_SRC, applyChoice, eventsFor, send, startGa, startMeta } from '../js/trackers.js';
import { pricingView } from '../js/pricing.js';

const PIXEL = '1234567890123456';
const GA = 'G-TEST12345';
const BOTH = { metaPixelId: PIXEL, ga4Id: GA };

function fakeEnv() {
    const scripts = [];
    const doc = {
        createElement: tag => ({ tag, async: false, src: '' }),
        head: { appendChild: node => { scripts.push(node); return node; } }
    };
    return { env: { win: {}, doc }, scripts };
}
const args = list => list.map(entry => Array.from(entry));
const metaCalls = win => args(win.fbq.queue);
const gaCalls = win => args(win.dataLayer);

test('the events carry exactly what §9 asks, in euro', () => {
    const view = pricingView('vip', 3, 'EUR');
    const item = { item_id: 'vip-3', item_name: 'VIP · 3 luni + 1 lună cadou', item_category: 'VIP', price: 39, quantity: 1 };
    assert.deepEqual(eventsFor('pricing_seen'), { meta: ['track', 'ViewContent', { content_name: 'Prețuri' }], ga: null });
    assert.deepEqual(eventsFor('plan_chosen', view), {
        meta: ['trackCustom', 'AlegePachet', { pachet: 'VIP', luni: 3, value: 39, currency: 'EUR', content_name: 'VIP · 3 luni + 1 lună cadou' }],
        ga: ['select_item', { item_list_id: 'preturi', item_list_name: 'Prețuri', currency: 'EUR', items: [item] }]
    });
    assert.deepEqual(eventsFor('trial'), {
        meta: ['track', 'Lead', { content_name: 'Test gratuit 36h' }],
        ga: ['generate_lead', { lead_source: 'Test gratuit 36h' }]
    });
    assert.deepEqual(eventsFor('order', view), {
        meta: ['track', 'InitiateCheckout', { value: 39, currency: 'EUR', content_name: 'VIP · 3 luni + 1 lună cadou', pachet: 'VIP', luni: 3, num_items: 1 }],
        ga: ['begin_checkout', { currency: 'EUR', value: 39, items: [item] }]
    });
    assert.deepEqual(eventsFor('contact', { channel: 'Messenger' }), { meta: ['track', 'Contact', { content_name: 'Messenger' }], ga: null });
    assert.deepEqual(eventsFor('something-else'), { meta: null, ga: null });
});

test('in the UK the same events carry pounds', () => {
    const view = pricingView('standard', 12, 'GBP');
    const [, , meta] = eventsFor('order', view).meta;
    assert.deepEqual([meta.value, meta.currency, meta.pachet, meta.luni], [110, 'GBP', 'Standard', 12]);
    const [, ga] = eventsFor('plan_chosen', view).ga;
    assert.equal(ga.currency, 'GBP');
    assert.deepEqual(ga.items[0], { item_id: 'standard-12', item_name: 'Standard · 12 luni + 1 lună cadou', item_category: 'Standard', price: 110, quantity: 1 });
});

test('Meta starts with its automatic events off, then PageView, and loads the official script once', () => {
    const { env, scripts } = fakeEnv();
    startMeta(PIXEL, env);
    assert.deepEqual(metaCalls(env.win), [['set', 'autoConfig', false, PIXEL], ['init', PIXEL], ['track', 'PageView']]);
    // In-page links (#preturi…) change the address; Meta would count each as a new PageView.
    assert.equal(env.win.fbq.disablePushState, true);
    assert.equal(META_SRC, 'https://connect.facebook.net/en_US/fbevents.js');
    assert.deepEqual(scripts.map(({ src, async }) => ({ src, async })), [{ src: META_SRC, async: true }]);
    assert.equal(env.win._fbq, env.win.fbq);
    startMeta(PIXEL, env);
    assert.equal(scripts.length, 1, 'no second script');
    assert.deepEqual(metaCalls(env.win).at(-1), ['consent', 'grant']);
});

test('GA4 starts in Consent Mode v2: everything denied, then only statistics granted', () => {
    const { env, scripts } = fakeEnv();
    startGa(GA, env);
    const calls = gaCalls(env.win);
    assert.deepEqual(calls[0], ['consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' }]);
    assert.deepEqual(calls[1], ['consent', 'update', { analytics_storage: 'granted' }]);
    assert.deepEqual(calls[2], ['set', 'ads_data_redaction', true]);
    assert.equal(calls[3][0], 'js');
    assert.ok(calls[3][1] instanceof Date);
    assert.deepEqual(calls[4], ['config', GA, { allow_google_signals: false, allow_ad_personalization_signals: false }]);
    // gtag.js only understands real `arguments` objects in the data layer.
    assert.ok(env.win.dataLayer.every(entry => Object.prototype.toString.call(entry) === '[object Arguments]'));
    assert.deepEqual(scripts.map(({ src, async }) => ({ src, async })), [{ src: `${GA_SRC}${GA}`, async: true }]);
    startGa(GA, env);
    assert.equal(scripts.length, 1, 'no second script');
});

test('events wait in the stubs until the scripts arrive', () => {
    const { env } = fakeEnv();
    const choice = { statistici: true, marketing: true };
    applyChoice(choice, BOTH, env);
    send('trial', undefined, choice, BOTH, env);
    assert.deepEqual(metaCalls(env.win).at(-1), ['track', 'Lead', { content_name: 'Test gratuit 36h' }]);
    assert.deepEqual(gaCalls(env.win).at(-1), ['event', 'generate_lead', { lead_source: 'Test gratuit 36h' }]);
});

test('each tracker gets only the events its own consent allows', () => {
    const { env, scripts } = fakeEnv();
    const statsOnly = { statistici: true, marketing: false };
    applyChoice(statsOnly, BOTH, env);
    send('contact', { channel: 'Messenger' }, statsOnly, BOTH, env);
    send('trial', undefined, statsOnly, BOTH, env);
    assert.equal(env.win.fbq, undefined, 'Meta never started');
    assert.deepEqual(scripts.map(script => script.src), [`${GA_SRC}${GA}`]);
    assert.deepEqual(gaCalls(env.win).at(-1), ['event', 'generate_lead', { lead_source: 'Test gratuit 36h' }]);

    const { env: metaEnv, scripts: metaScripts } = fakeEnv();
    applyChoice({ statistici: true, marketing: true }, { metaPixelId: PIXEL, ga4Id: '' }, metaEnv);
    assert.equal(metaEnv.win.dataLayer, undefined, 'no GA4 without its ID');
    assert.deepEqual(metaScripts.map(script => script.src), [META_SRC]);
});

test('withdrawing stops both trackers at once, and a new yes turns them back on', () => {
    const { env, scripts } = fakeEnv();
    applyChoice({ statistici: true, marketing: true }, BOTH, env);
    applyChoice({ statistici: false, marketing: false }, BOTH, env);
    assert.deepEqual(metaCalls(env.win).at(-1), ['consent', 'revoke']);
    assert.equal(env.win[`ga-disable-${GA}`], true);
    assert.deepEqual(gaCalls(env.win).at(-1), ['consent', 'update', { analytics_storage: 'denied' }]);
    const before = [env.win.fbq.queue.length, env.win.dataLayer.length];
    send('trial', undefined, { statistici: false, marketing: false }, BOTH, env);
    assert.deepEqual([env.win.fbq.queue.length, env.win.dataLayer.length], before, 'nothing more is sent');

    applyChoice({ statistici: true, marketing: true }, BOTH, env);
    assert.deepEqual(metaCalls(env.win).at(-1), ['consent', 'grant']);
    assert.equal(env.win[`ga-disable-${GA}`], false);
    assert.deepEqual(gaCalls(env.win).at(-1), ['consent', 'update', { analytics_storage: 'granted' }]);
    assert.equal(scripts.length, 2, 'the scripts are not loaded twice');
});

test('a withdrawal before anything started loads nothing', () => {
    const { env, scripts } = fakeEnv();
    applyChoice({ statistici: false, marketing: false }, BOTH, env);
    assert.deepEqual(scripts, []);
    assert.equal(env.win.fbq, undefined);
    assert.equal(env.win.dataLayer, undefined);
});
