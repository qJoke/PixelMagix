// Meta Pixel and Google Analytics 4. js/measure.js loads this module only after the visitor's consent;
// each tracker starts only with its own consent (Marketing = Meta, Statistici = Google) and its ID from
// js/tracking-config.js. The stubs below are the vendors' official snippets written out as module code
// (the CSP allows no inline script): calls made before a script arrives wait in its queue.
import { enabledTrackers } from './tracking-config.js';

export const META_SRC = 'https://connect.facebook.net/en_US/fbevents.js';
export const GA_SRC = 'https://www.googletagmanager.com/gtag/js?id=';

const LEAD = 'Test gratuit 36h';
const started = new WeakMap();
const stateOf = win => {
    if (!started.has(win)) started.set(win, {});
    return started.get(win);
};

const item = view => ({ item_id: `${view.plan}-${view.paid}`, item_name: view.title, item_category: view.name, price: view.amount, quantity: 1 });

// What each moment of the visit sends (spec §9). `data` is the price view (js/pricing.js) or { channel }.
export function eventsFor(name, data = {}) {
    switch (name) {
        case 'pricing_seen':
            return { meta: ['track', 'ViewContent', { content_name: 'Prețuri' }], ga: null };
        case 'plan_chosen':
            return {
                meta: ['trackCustom', 'AlegePachet', { pachet: data.name, luni: data.paid, value: data.amount, currency: data.currency, content_name: data.title }],
                ga: ['select_item', { item_list_id: 'preturi', item_list_name: 'Prețuri', currency: data.currency, items: [item(data)] }]
            };
        case 'trial':
            return { meta: ['track', 'Lead', { content_name: LEAD }], ga: ['generate_lead', { lead_source: LEAD }] };
        case 'order':
            return {
                meta: ['track', 'InitiateCheckout', { value: data.amount, currency: data.currency, content_name: data.title, pachet: data.name, luni: data.paid, num_items: 1 }],
                ga: ['begin_checkout', { currency: data.currency, value: data.amount, items: [item(data)] }]
            };
        case 'contact':
            return { meta: ['track', 'Contact', { content_name: data.channel }], ga: null };
        default:
            return { meta: null, ga: null };
    }
}

function addScript(doc, src) {
    const script = doc.createElement('script');
    script.async = true;
    script.src = src;
    doc.head.appendChild(script);
}

export function startMeta(id, { win, doc }) {
    const state = stateOf(win);
    if (state.meta) {
        win.fbq('consent', 'grant');
        return;
    }
    state.meta = true;
    if (!win.fbq) {
        const fbq = function () {
            if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
            else fbq.queue.push(arguments);
        };
        if (!win._fbq) win._fbq = fbq;
        fbq.push = fbq;
        fbq.loaded = true;
        fbq.version = '2.0';
        fbq.queue = [];
        win.fbq = fbq;
    }
    // Meta's documented switch: the in-page links (#preturi…) change the address, and Meta would
    // otherwise count each jump as a new PageView.
    win.fbq.disablePushState = true;
    // No automatic button-click / page-metadata events: only the events of spec §9.
    win.fbq('set', 'autoConfig', false, id);
    win.fbq('init', id);
    win.fbq('track', 'PageView');
    addScript(doc, META_SRC);
}

export function stopMeta({ win }) {
    if (stateOf(win).meta) win.fbq('consent', 'revoke');
}

export function startGa(id, { win, doc }) {
    const state = stateOf(win);
    win[`ga-disable-${id}`] = false;
    if (state.ga) {
        win.gtag('consent', 'update', { analytics_storage: 'granted' });
        return;
    }
    state.ga = true;
    win.dataLayer = win.dataLayer || [];
    win.gtag = function gtag() {
        win.dataLayer.push(arguments);
    };
    // Consent Mode v2, basic: the tag loads only now, and only statistics are granted. Google's ad signals
    // stay denied (the banner's Marketing covers Meta only).
    win.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
    win.gtag('consent', 'update', { analytics_storage: 'granted' });
    win.gtag('set', 'ads_data_redaction', true);
    win.gtag('js', new Date());
    win.gtag('config', id, { allow_google_signals: false, allow_ad_personalization_signals: false });
    addScript(doc, `${GA_SRC}${encodeURIComponent(id)}`);
}

export function stopGa(id, { win }) {
    if (!stateOf(win).ga) return;
    // Google's documented switch: no more hits from this page, cookieless pings included.
    win[`ga-disable-${id}`] = true;
    win.gtag('consent', 'update', { analytics_storage: 'denied' });
}

export function applyChoice(choice, config, env) {
    const on = enabledTrackers(config);
    if (on.marketing) {
        if (choice.marketing) startMeta(config.metaPixelId, env);
        else stopMeta(env);
    }
    if (on.statistici) {
        if (choice.statistici) startGa(config.ga4Id, env);
        else stopGa(config.ga4Id, env);
    }
}

export function send(name, data, choice, config, { win }) {
    const { meta, ga } = eventsFor(name, data);
    const on = enabledTrackers(config);
    if (meta && choice.marketing && on.marketing && typeof win.fbq === 'function') win.fbq(...meta);
    if (ga && choice.statistici && on.statistici && typeof win.gtag === 'function') win.gtag('event', ...ga);
}
