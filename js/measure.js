// Measurement for the ads, in "basic consent mode": until the visitor chooses in the cookie banner, nothing
// is loaded from Meta or Google and nothing is written. This small module only listens for the moments the
// owner's ads care about; the banner (js/consent-banner.js) and the trackers (js/trackers.js) are loaded on
// demand: the banner when it has to show, the trackers after a consent (after the page's load for a choice
// made on an earlier visit, so they never compete with the first paint).
import { TRACKER_COOKIES, clearCookies, readConsent, saveConsent } from './consent.js';
import { TRACKING, enabledTrackers } from './tracking-config.js';

function localStore(win) {
    try {
        return win.localStorage;
    } catch {
        return null;
    }
}

// After the load event, when the browser is idle (at most 2 s later).
function afterLoad(win, doc) {
    return callback => {
        const go = () => (typeof win.requestIdleCallback === 'function'
            ? win.requestIdleCallback(callback, { timeout: 2000 })
            : win.setTimeout(callback, 1));
        if (doc.readyState === 'complete') go();
        else win.addEventListener('load', go, { once: true });
    };
}

const granted = choice => Boolean(choice?.statistici || choice?.marketing);
const keyOf = (name, data) => [name, data?.plan, data?.paid, data?.currency, data?.channel].join('|');

export function createMeasurement({
    doc = document,
    win = window,
    storage = localStore(win),
    config = TRACKING,
    loadBanner = () => import('./consent-banner.js'),
    loadTrackers = () => import('./trackers.js'),
    now = () => Date.now(),
    idle = afterLoad(win, doc)
} = {}) {
    const enabled = enabledTrackers(config);
    const env = { win, doc };
    const sent = new Set();
    const waiting = [];
    let current = null;
    let trackers = null;
    let loading = null;
    let banner = null;
    let pricingSeen = false;

    const load = () => {
        loading ??= loadTrackers().then(module => {
            trackers = module;
            module.applyChoice(current, config, env);
            waiting.splice(0).forEach(([name, data]) => module.send(name, data, current, config, env));
        }).catch(error => {
            loading = null;
            console.error('[pixelmagix] trackers', error);
        });
        return loading;
    };

    // One call per moment of the visit; each event with the same data goes out once per page view.
    const track = (name, data) => {
        if (name === 'pricing_seen') pricingSeen = true;
        if (!granted(current)) return;
        const key = keyOf(name, data);
        if (sent.has(key)) return;
        sent.add(key);
        if (trackers) {
            trackers.send(name, data, current, config, env);
            return;
        }
        waiting.push([name, data]);
        if (!loading) idle(load);
    };

    const decide = choice => {
        current = saveConsent(storage, choice, now());
        trackers?.applyChoice(current, config, env);
        // Withdrawn: the tracker (if it was running) is stopped first, then its cookies go.
        if (!current.statistici) clearCookies(doc, win.location?.hostname, TRACKER_COOKIES.statistici);
        if (!current.marketing) clearCookies(doc, win.location?.hostname, TRACKER_COOKIES.marketing);
        if (granted(current) && !trackers) load();
        if (pricingSeen) track('pricing_seen');
    };

    const bannerApi = () => {
        banner ??= loadBanner().then(({ initConsentBanner }) => {
            const root = doc.querySelector('[data-consent]');
            return root ? initConsentBanner(root, { enabled, onChoice: decide, status: doc.querySelector('[data-consent-status]'), doc }) : null;
        }).catch(error => {
            banner = null;
            console.error('[pixelmagix] cookie banner', error);
            return null;
        });
        return banner;
    };
    const openSettings = opener => bannerApi().then(api => api?.openSettings(current, opener));

    const listen = () => {
        doc.addEventListener('click', event => {
            const link = event.target?.closest?.('a[href]');
            // The order link is reported by the price card, which knows the package on screen.
            if (!link || link.matches('[data-order]')) return;
            if (link.matches('.js-trial')) track('trial');
            else if (link.href.startsWith('https://m.me/')) track('contact', { channel: 'Messenger' });
            else if (link.href.startsWith('https://wa.me/')) track('contact', { channel: 'WhatsApp' });
        });
        const pricing = doc.getElementById('preturi');
        if (!pricing || typeof win.IntersectionObserver !== 'function') return;
        // "Seen" = the price section reaches the middle band of the screen.
        const observer = new win.IntersectionObserver(entries => {
            if (!entries.some(entry => entry.isIntersecting)) return;
            observer.disconnect();
            track('pricing_seen');
        }, { rootMargin: '-40% 0px -40% 0px' });
        observer.observe(pricing);
    };

    return {
        track,
        init() {
            if (!enabled.statistici && !enabled.marketing) return;
            const footer = doc.querySelector('[data-consent-footer]');
            if (footer) footer.hidden = false;
            doc.querySelector('[data-consent-open]')?.addEventListener('click', event => openSettings(event.currentTarget));
            current = readConsent(storage, now());
            if (granted(current)) idle(load);
            if (win.location?.hash === '#setari-cookie') openSettings(null);
            else if (!current) bannerApi().then(api => api?.show(current));
            listen();
        }
    };
}
