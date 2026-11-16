import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addOriginToHref, originCode, withOrigin } from '../js/origin.js';
import { buildWhatsAppUrl, TRIAL_MESSAGE } from '../js/whatsapp.js';
import { orderMessage, pricingView } from '../js/pricing.js';

const textOf = href => new URL(href).searchParams.get('text');
const HELP_HREF = 'https://wa.me/447449765468?text=Salut!%20Am%20nevoie%20de%20ajutor%20la%20instalarea%20aplica%C8%9Biei%20pentru%20Pixel%20Magix%20TV.';

test('an ad link gives a short code: source, campaign, ad', () => {
    assert.equal(originCode('?utm_source=fb&utm_medium=paid&utm_campaign=IT&utm_content=1'), 'FB-IT-1');
    assert.equal(originCode('utm_source=fb&utm_campaign=IT&utm_content=1'), 'FB-IT-1');
});

test('Meta placements map to short sources', () => {
    for (const [source, short] of [['fb', 'FB'], ['facebook', 'FB'], ['ig', 'IG'], ['Instagram', 'IG'], ['msg', 'MSG'], ['an', 'AN']]) {
        assert.equal(originCode(`?utm_source=${source}&utm_campaign=ES`), `${short}-ES`, source);
    }
    assert.equal(originCode('?utm_source=newsletter-iarna&utm_campaign=ES'), 'NEWSLE-ES');
    assert.equal(originCode('?utm_campaign=ES&utm_content=video'), 'ES-VIDEO');
});

test('without a campaign or an ad there is no code', () => {
    for (const search of ['', '?', '?fbclid=abc', '?utm_source=fb', '?utm_medium=paid', '?utm_campaign=&utm_content=%20%20']) {
        assert.equal(originCode(search), '', search);
    }
    assert.equal(originCode(undefined), '');
});

test('the code keeps only safe characters and stays short', () => {
    assert.equal(originCode('?utm_source=fb&utm_campaign=Italia%20rece%20%3Cscript%3E'), 'FB-ITALIA-RECE-SCRI');
    assert.equal(originCode('?utm_campaign=Bucure%C8%99ti%20%C8%99i%20%C8%9B%C4%83ri'), 'BUCURESTI-SI-TAR');
    assert.equal(originCode('?utm_campaign=%F0%9F%94%A5%F0%9F%94%A5&utm_content=2'), '2');
    const long = originCode(`?utm_source=${'x'.repeat(50)}&utm_campaign=${'A'.repeat(80)}&utm_content=${'9'.repeat(80)}`);
    assert.match(long, /^[A-Z0-9]+(-[A-Z0-9]+)*$/);
    assert.ok(long.length <= 6 + 1 + 16 + 1 + 16, long);
    for (const code of [long, originCode('?utm_campaign=--a--b--&utm_content=-')]) {
        assert.doesNotMatch(code, /--|^-|-$/, code);
    }
});

test('the code goes on its own line at the end of the message', () => {
    assert.equal(withOrigin('Salut!', 'FB-IT-1'), 'Salut!\n\nCod: FB-IT-1');
    assert.equal(withOrigin('Salut!', ''), 'Salut!');
});

test('existing WhatsApp links keep their message and gain the code', () => {
    const help = addOriginToHref(HELP_HREF, 'FB-IT-1');
    assert.ok(help.startsWith('https://wa.me/447449765468?text='), help);
    assert.equal(textOf(help), `${textOf(HELP_HREF)}\n\nCod: FB-IT-1`);
    assert.doesNotMatch(help, /\+/, 'spaces stay %20, as in every other link');
    assert.equal(textOf(addOriginToHref('https://wa.me/447449765468', 'FB-IT-1')), 'Salut!\n\nCod: FB-IT-1');
    assert.equal(addOriginToHref(HELP_HREF, ''), HELP_HREF);
    assert.equal(addOriginToHref('https://m.me/pixelmagix.shop', 'FB-IT-1'), 'https://m.me/pixelmagix.shop');
    const trial = addOriginToHref(buildWhatsAppUrl(TRIAL_MESSAGE), 'IG-ES-2');
    assert.equal(textOf(trial), `${TRIAL_MESSAGE}\n\nCod: IG-ES-2`);
});

test('the order link carries the code, and the view exposes the event values', () => {
    const view = pricingView('vip', 3, 'EUR', 'FB-IT-1');
    assert.equal(textOf(view.orderHref), `${orderMessage('vip', 3, 'EUR')}\n\nCod: FB-IT-1`);
    assert.equal(textOf(pricingView('vip', 3, 'EUR').orderHref), orderMessage('vip', 3, 'EUR'));
    assert.equal(view.name, 'VIP');
    assert.equal(view.amount, 39);
    assert.equal(view.currency, 'EUR');
    const pounds = pricingView('standard', 12, 'GBP');
    assert.deepEqual([pounds.name, pounds.paid, pounds.amount, pounds.currency], ['Standard', 12, 110, 'GBP']);
});
