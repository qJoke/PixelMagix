// Pixel Magix TV — entry module (loaded with type="module", so it runs after the HTML is parsed).
import { buildWhatsAppUrl, TRIAL_MESSAGE } from './js/whatsapp.js';
import { addOriginToHref, originCode, withOrigin } from './js/origin.js';
import { createMeasurement } from './js/measure.js';
import { initHeroTv } from './js/hero-tv.js';
import { initSiteChrome } from './js/site-chrome.js';
import { initPricing } from './js/pricing-ui.js';
import { initTabs, showDevice } from './js/tabs.js';
import { initReveal } from './js/reveal.js';
import { countUp } from './js/count-up.js';
import { initPointerFx } from './js/pointer-fx.js';
import { materialise } from './js/materialise.js';

// Each part starts on its own: if one fails (an old browser, say), the others still work.
const run = (name, init) => {
    try {
        init();
    } catch (error) {
        console.error(`[pixelmagix] ${name}`, error);
    }
};

// The ad that brought this visit ("FB-IT-1"), from the address only; it ends every WhatsApp message.
const code = originCode(location.search);

run('trial links', () => {
    const trialUrl = buildWhatsAppUrl(withOrigin(TRIAL_MESSAGE, code));
    document.querySelectorAll('.js-trial').forEach(link => {
        link.href = trialUrl;
    });
});
run('origin code', () => {
    if (!code) return;
    // Install help and the footer number; the order link gets the code from the price selector.
    document.querySelectorAll('a[href^="https://wa.me/"]:not(.js-trial):not([data-order])').forEach(link => {
        link.href = addOriginToHref(link.href, code);
    });
});
// Cookie banner, then Meta Pixel / Google Analytics only after the visitor's consent (js/measure.js).
let measurement = { track() {} };
run('measurement', () => {
    measurement = createMeasurement();
    measurement.init();
});
run('chrome', () => initSiteChrome());
run('tv', () => initHeroTv(document.querySelector('[data-tv]')));
run('pricing', () => initPricing(document.querySelector('[data-pricing]'), {
    code,
    priceNodes: document.querySelectorAll('[data-price]'),
    onChoice: view => measurement.track('plan_chosen', view),
    onOrder: view => measurement.track('order', view)
}));
run('install tabs', () => {
    const guide = document.querySelector('[data-install]');
    const stage = guide?.querySelector('.device');
    initTabs(guide, { onSelect: tab => showDevice(stage, tab.dataset.device) });
});
run('reveal', () => initReveal(document, {
    // The first time a card appears, its big numbers count up and its photo builds up from pixels.
    onReveal: element => {
        element.querySelectorAll?.('[data-count]').forEach(number => {
            countUp(number, { to: Number(number.dataset.count), suffix: '+' });
        });
        element.querySelectorAll?.('[data-materialise]').forEach(photo => materialise(photo));
    }
}));
run('pointer', () => initPointerFx(document));
// A mouse-only extra: phones never download it.
run('sparkles', () => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    import('./js/sparkle-trail.js').then(({ initSparkleTrail }) => initSparkleTrail(document), error => console.error('[pixelmagix] sparkles', error));
});
