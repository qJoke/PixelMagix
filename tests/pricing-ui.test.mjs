import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { initPricing } from '../js/pricing-ui.js';
import { pricingView } from '../js/pricing.js';

// A minimal DOM: just what initPricing touches. The benefits list deliberately has no
// replaceChildren(), like Safari before 14 (iOS 13), which still runs this module.
function node(tag = 'span') {
    const classes = new Set();
    const children = [];
    const props = {};
    let text = '';
    return {
        tag,
        hidden: false,
        offsetWidth: 10,
        classes,
        children,
        props,
        classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
        style: { setProperty: (name, value) => { props[name] = value; } },
        appendChild(child) { children.push(child); return child; },
        get textContent() { return children.length ? children.map(child => child.textContent).join('') : text; },
        set textContent(value) { children.length = 0; text = String(value); }
    };
}

function list() {
    const items = [];
    return {
        items,
        get firstChild() { return items[0] ?? null; },
        appendChild(child) { items.push(child); return child; },
        removeChild(child) { items.splice(items.indexOf(child), 1); return child; }
    };
}

// The row of month squares: a list that also takes a class, a custom property and `hidden`.
function strip() {
    const classes = new Set();
    const props = {};
    const items = [];
    return {
        items,
        classes,
        props,
        hidden: false,
        classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
        style: { setProperty: (name, value) => { props[name] = value; } },
        get firstChild() { return items[0] ?? null; },
        appendChild(child) { items.push(child); return child; },
        removeChild(child) { items.splice(items.indexOf(child), 1); return child; }
    };
}

function fakePricing() {
    const state = { plan: 'vip', paid: '3' };
    const handlers = {};
    const options = [1, 3, 6, 12].map(() => {
        const parts = { months: node(), price: node(), gift: node(), favourite: node() };
        return {
            parts,
            querySelector: selector => ({
                '[data-option-months]': parts.months,
                '[data-option-price]': parts.price,
                '[data-option-gift]': parts.gift,
                '[data-option-favourite]': parts.favourite
            })[selector]
        };
    });
    const form = {
        querySelector: selector => {
            if (selector === 'input[name="plan"]:checked') return { value: state.plan };
            if (selector === 'input[name="paid"]:checked') return { value: state.paid };
            return null;
        },
        querySelectorAll: selector => (selector === '[data-option]' ? options : []),
        addEventListener: (type, handler) => { handlers[type] = handler; }
    };
    const card = { title: node(), price: node(), gift: node(), months: strip(), benefits: list(), order: { href: 'static' }, summary: node() };
    const root = {
        dataset: {},
        querySelector: selector => ({
            '[data-pricing-form]': form,
            '[data-card-title]': card.title,
            '[data-card-price]': card.price,
            '[data-card-gift]': card.gift,
            '[data-card-months]': card.months,
            '[data-card-benefits]': card.benefits,
            '[data-order]': card.order,
            '[data-card-summary]': card.summary
        })[selector] ?? null
    };
    return { root, state, handlers, card, options };
}

beforeEach(() => {
    globalThis.document = { createElement: tag => node(tag), createTextNode: value => ({ textContent: value }) };
    globalThis.fetch = async () => ({ ok: false });
});

test('a new choice updates the order link even where replaceChildren is missing', () => {
    const { root, state, handlers, card } = fakePricing();
    initPricing(root);
    state.plan = 'standard';
    state.paid = '12';
    handlers.change();
    const view = pricingView('standard', 12, 'EUR');
    assert.equal(card.order.href, view.orderHref);
    assert.equal(card.title.textContent, view.title);
    assert.deepEqual(card.benefits.items.map(item => item.textContent), view.benefits);
});

test('the duration tiles follow the chosen plan', () => {
    const { root, state, handlers, options } = fakePricing();
    initPricing(root);
    state.plan = 'standard';
    handlers.change();
    assert.deepEqual(options.map(option => option.parts.price.textContent), ['12 €', '35 €', '60 €', '110 €']);
    assert.ok(options.every(option => option.parts.favourite.hidden));
});

test('the price swaps with a short animation when it changes, not on first paint', () => {
    const { root, state, handlers, card } = fakePricing();
    initPricing(root);
    assert.equal(card.price.classList.contains('is-swapping'), false);
    state.paid = '6';
    handlers.change();
    assert.equal(card.price.classList.contains('is-swapping'), true);
    card.price.classList.remove('is-swapping');
    handlers.change();
    assert.equal(card.price.classList.contains('is-swapping'), false, 'same price, no animation');
});

// --- The chosen plan, for the styles that follow it (the lit column of the comparison, the house) ----------
test('the chosen plan is written on the selector, for the styles that follow it', () => {
    const { root, state, handlers } = fakePricing();
    initPricing(root);
    assert.equal(root.dataset.plan, 'vip');
    state.plan = 'standard';
    handlers.change();
    assert.equal(root.dataset.plan, 'standard');
});

// --- Plan switch: the benefit rows cascade in, and VIP's key words glow ----------------------------------
const rows = card => card.benefits.items;
const keyWords = card => rows(card).flatMap(item => item.children.filter(child => child.tag === 'strong'));

test('switching the plan cascades the benefit rows in, one after another', () => {
    const { root, state, handlers, card } = fakePricing();
    initPricing(root);
    assert.ok(rows(card).every(item => !item.classes.has('is-in')), 'no cascade on first paint');
    state.plan = 'standard';
    handlers.change();
    assert.ok(rows(card).every(item => item.classes.has('is-in')));
    assert.deepEqual(rows(card).map(item => item.props['--i']), ['0', '1', '2', '3', '4']);
});

test('changing only the duration does not replay the cascade', () => {
    const { root, state, handlers, card } = fakePricing();
    initPricing(root);
    state.paid = '6';
    handlers.change();
    assert.ok(rows(card).every(item => !item.classes.has('is-in')));
});

test('the key words stand out, and glow for a moment when VIP is chosen', () => {
    const { root, state, handlers, card } = fakePricing();
    initPricing(root);
    assert.deepEqual(keyWords(card).map(words => words.textContent), ['5 ecrane', '4K']);
    assert.ok(keyWords(card).every(words => !words.classes.has('is-glow')), 'no glow on first paint');
    state.plan = 'standard';
    handlers.change();
    assert.deepEqual(keyWords(card).map(words => words.textContent), ['3 ecrane', 'Full HD']);
    assert.ok(keyWords(card).every(words => !words.classes.has('is-glow')), 'Standard does not glow');
    state.plan = 'vip';
    handlers.change();
    assert.deepEqual(keyWords(card).map(words => words.textContent), ['5 ecrane', '4K']);
    assert.ok(keyWords(card).every(words => words.classes.has('is-glow')));
});

// --- The months of the package, drawn as squares in the price card ------------------------------------
const squares = card => card.months.items;
const giftSquares = card => squares(card).filter(square => square.classes.has('months__m--gift'));

test('the card draws one square per month, the gift months last and marked', () => {
    const { root, card } = fakePricing();
    initPricing(root);
    // VIP · 3 luni + 1 lună cadou
    assert.equal(squares(card).length, 4);
    assert.ok(squares(card).every(square => square.classes.has('months__m')));
    assert.deepEqual(giftSquares(card), [squares(card)[3]]);
    assert.equal(card.months.props['--paid'], '3', 'the gradient spans the paid months');
    assert.deepEqual(squares(card).map(square => square.props['--i']), ['0', '1', '2', '3']);
    assert.equal(card.months.hidden, false);
    assert.equal(card.months.classes.has('is-in'), false, 'no entrance on first paint');
});

test('a new duration redraws the squares, and they pop in', () => {
    const { root, state, handlers, card } = fakePricing();
    initPricing(root);
    state.paid = '12';
    handlers.change();
    assert.equal(squares(card).length, 14);
    assert.equal(giftSquares(card).length, 2);
    assert.equal(card.months.props['--paid'], '12');
    assert.equal(card.months.classes.has('is-in'), true);
});

test('a package without a gift shows no squares, and no empty row', () => {
    const { root, state, handlers, card } = fakePricing();
    initPricing(root);
    state.paid = '1';
    handlers.change();
    assert.equal(squares(card).length, 0);
    assert.equal(card.months.hidden, true);
    state.plan = 'standard';
    state.paid = '6';
    handlers.change();
    assert.equal(card.months.hidden, false);
    assert.equal(squares(card).length, 7);
    assert.equal(giftSquares(card).length, 1);
});

test('a plan switch that keeps the same months leaves the squares alone', () => {
    const { root, state, handlers, card } = fakePricing();
    initPricing(root);
    const before = [...squares(card)];
    assert.equal(before.length, 4);
    // Standard 3 + 1 has the same four months as VIP 3 + 1.
    state.plan = 'standard';
    handlers.change();
    assert.equal(squares(card).length, before.length);
    assert.ok(squares(card).every((square, index) => square === before[index]), 'the very same squares');
    assert.equal(card.months.classes.has('is-in'), false, 'nothing replays');
});

test('the selector works on a page that has no row for the squares', () => {
    const fake = fakePricing();
    fake.card.months = null;
    initPricing(fake.root);
    fake.state.paid = '6';
    fake.handlers.change();
    assert.equal(fake.card.title.textContent, pricingView('vip', 6, 'EUR').title);
});

// --- Prices written elsewhere on the page (the FAQ price list) ------------------------------------------
test('prices written outside the selector are shown in the same currency as the selector', async () => {
    for (const [country, shown] of [['GB', ['12 £', '110 £']], ['IT', ['12 €', '110 €']]]) {
        globalThis.fetch = async () => ({ ok: true, json: async () => ({ country }) });
        const priceNodes = [12, 110].map(amount => {
            const price = node();
            price.dataset = { price: String(amount) };
            price.textContent = `${amount} €`;
            return price;
        });
        initPricing(fakePricing().root, { priceNodes });
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(priceNodes.map(price => price.textContent), shown, country);
    }
});

// --- Ad origin code (Etapa 3) -------------------------------------------------------------------------
test('the order link keeps the ad code through every change', () => {
    const { root, state, handlers, card } = fakePricing();
    initPricing(root, { code: 'FB-IT-1' });
    assert.equal(card.order.href, pricingView('vip', 3, 'EUR', 'FB-IT-1').orderHref);
    state.plan = 'standard';
    state.paid = '6';
    handlers.change();
    assert.equal(card.order.href, pricingView('standard', 6, 'EUR', 'FB-IT-1').orderHref);
    assert.ok(new URL(card.order.href).searchParams.get('text').endsWith('\n\nCod: FB-IT-1'));
});

// --- Ad events (Etapa 3) ------------------------------------------------------------------------------
test('only the visitor\'s own choices are reported, and the order click reports the package on screen', async () => {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ country: 'GB' }) });
    const { root, state, handlers, card } = fakePricing();
    let orderClick = null;
    card.order.addEventListener = (type, handler) => { if (type === 'click') orderClick = handler; };
    const choices = [];
    const orders = [];
    initPricing(root, { onChoice: view => choices.push(view), onOrder: view => orders.push(view) });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(choices, [], 'neither the first paint nor the switch to pounds is a choice');
    orderClick();
    assert.deepEqual(orders.map(view => [view.plan, view.paid, view.amount, view.currency]), [['vip', 3, 39, 'GBP']]);
    state.plan = 'standard';
    state.paid = '12';
    handlers.change();
    assert.deepEqual(choices.map(view => [view.plan, view.paid, view.amount, view.currency]), [['standard', 12, 110, 'GBP']]);
    orderClick();
    assert.deepEqual(orders.at(-1).title, 'Standard · 12 luni + 1 lună cadou');
});
