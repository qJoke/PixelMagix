import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initConsentBanner } from '../js/consent-banner.js';

// A minimal DOM: just what the banner touches.
function fakeDocument() {
    const doc = { activeElement: null };
    const element = (name, extra = {}) => {
        const listeners = {};
        const attributes = {};
        const node = {
            name,
            hidden: false,
            checked: false,
            textContent: '',
            dataset: {},
            focusOptions: null,
            setAttribute: (key, value) => { attributes[key] = String(value); },
            getAttribute: key => attributes[key] ?? null,
            addEventListener: (type, handler) => { (listeners[type] ??= []).push(handler); },
            fire(type, event = {}) {
                const full = { key: '', defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...event };
                (listeners[type] ?? []).forEach(handler => handler(full));
                return full;
            },
            focus(options) { doc.activeElement = node; node.focusOptions = options ?? null; },
            ...extra
        };
        return node;
    };
    doc.body = element('body');
    doc.main = element('main');
    doc.getElementById = id => (id === 'continut' ? doc.main : null);
    return { doc, element };
}

function fakeBanner({ enabled = { statistici: true, marketing: true } } = {}) {
    const { doc, element } = fakeDocument();
    const parts = {
        accept: element('accept'),
        reject: element('reject'),
        save: element('save'),
        settings: element('settings'),
        options: element('options', { hidden: true }),
        statistici: element('statistici'),
        marketing: element('marketing'),
        rowStatistici: element('row-statistici'),
        rowMarketing: element('row-marketing')
    };
    parts.rowStatistici.dataset.consentRow = 'statistici';
    parts.rowMarketing.dataset.consentRow = 'marketing';
    parts.settings.setAttribute('aria-expanded', 'false');
    const root = element('root', {
        hidden: true,
        contains: node => node === root || Object.values(parts).includes(node),
        querySelector: selector => ({
            '[data-consent-accept]': parts.accept,
            '[data-consent-reject]': parts.reject,
            '[data-consent-save]': parts.save,
            '[data-consent-settings]': parts.settings,
            '[data-consent-options]': parts.options,
            'input[name="statistici"]': parts.statistici,
            'input[name="marketing"]': parts.marketing
        })[selector] ?? null,
        querySelectorAll: selector => (selector === '[data-consent-row]' ? [parts.rowStatistici, parts.rowMarketing] : [])
    });
    const status = element('status');
    const choices = [];
    const banner = initConsentBanner(root, { enabled, status, doc, onChoice: choice => choices.push(choice) });
    return { doc, root, parts, status, choices, banner, element };
}

test('"Accept tot" and "Refuz" decide both categories at once and close the banner', () => {
    const accepted = fakeBanner();
    accepted.banner.show();
    assert.equal(accepted.root.hidden, false);
    accepted.parts.accept.fire('click');
    assert.deepEqual(accepted.choices, [{ statistici: true, marketing: true }]);
    assert.equal(accepted.root.hidden, true);

    const refused = fakeBanner();
    refused.banner.show();
    refused.parts.reject.fire('click');
    assert.deepEqual(refused.choices, [{ statistici: false, marketing: false }]);
    assert.equal(refused.root.hidden, true);
});

test('"Salvez alegerea" keeps exactly the switches that are on, and they start off', () => {
    const { banner, parts, choices } = fakeBanner();
    banner.show();
    assert.equal(parts.statistici.checked, false);
    assert.equal(parts.marketing.checked, false);
    parts.statistici.checked = true;
    parts.save.fire('click');
    assert.deepEqual(choices, [{ statistici: true, marketing: false }]);
});

test('a category whose tracker is switched off is hidden and never granted', () => {
    const { banner, parts, choices } = fakeBanner({ enabled: { statistici: true, marketing: false } });
    assert.equal(parts.rowMarketing.hidden, true);
    assert.equal(parts.rowStatistici.hidden, false);
    banner.show();
    parts.accept.fire('click');
    assert.deepEqual(choices, [{ statistici: true, marketing: false }]);
});

test('"Setări" opens and closes the options and says so to assistive technology', () => {
    const { banner, parts } = fakeBanner();
    banner.show();
    parts.settings.fire('click');
    assert.equal(parts.options.hidden, false);
    assert.equal(parts.settings.getAttribute('aria-expanded'), 'true');
    parts.settings.fire('click');
    assert.equal(parts.options.hidden, true);
    assert.equal(parts.settings.getAttribute('aria-expanded'), 'false');
});

test('reopening from the footer shows the current choice in open settings, then focus goes back to the opener', () => {
    const { banner, parts, root, doc, choices, element } = fakeBanner();
    const opener = element('footer-button');
    banner.openSettings({ statistici: true, marketing: false }, opener);
    assert.equal(root.hidden, false);
    assert.equal(parts.options.hidden, false);
    assert.equal(parts.statistici.checked, true);
    assert.equal(parts.marketing.checked, false);
    assert.equal(doc.activeElement, root, 'focus moves into the banner');
    parts.marketing.checked = true;
    parts.statistici.checked = false;
    doc.activeElement = parts.save;
    parts.save.fire('click');
    assert.deepEqual(choices, [{ statistici: false, marketing: true }]);
    assert.equal(doc.activeElement, opener);
    assert.equal(parts.options.hidden, true, 'the next opening starts from a clean state');
});

test('after a first-visit decision, focus moves to the main content only if it was inside the banner', () => {
    const inside = fakeBanner();
    inside.banner.show();
    inside.doc.activeElement = inside.parts.reject;
    inside.parts.reject.fire('click');
    assert.equal(inside.doc.activeElement, inside.doc.main);
    assert.deepEqual(inside.doc.main.focusOptions, { preventScroll: true });

    const outside = fakeBanner();
    outside.banner.show();
    outside.doc.activeElement = outside.doc.body;
    outside.parts.accept.fire('click');
    assert.equal(outside.doc.activeElement, outside.doc.body);
});

test('Escape closes a reopened banner without changing anything, but never the first-visit banner', () => {
    const first = fakeBanner();
    first.banner.show();
    first.root.fire('keydown', { key: 'Escape' });
    assert.equal(first.root.hidden, false);
    assert.deepEqual(first.choices, []);

    const again = fakeBanner();
    const opener = again.element('footer-button');
    again.banner.openSettings({ statistici: false, marketing: false }, opener);
    const event = again.root.fire('keydown', { key: 'Escape' });
    assert.equal(again.root.hidden, true);
    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(again.choices, []);
    assert.equal(again.doc.activeElement, opener);
});

test('the status region confirms every decision (re-announced each time)', () => {
    const { banner, parts, status } = fakeBanner();
    banner.show();
    parts.accept.fire('click');
    const first = status.textContent;
    assert.equal(first.trim(), 'Am salvat alegerea ta.');
    banner.openSettings({ statistici: true, marketing: true });
    parts.save.fire('click');
    assert.equal(status.textContent.trim(), 'Am salvat alegerea ta.');
    assert.notEqual(status.textContent, first, 'the text changes, so screen readers announce it again');
});
