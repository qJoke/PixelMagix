// Prices, labels and the WhatsApp order text for the 2-step selector. Pure data and functions:
// the page only renders what these return. Prices are the owner's, unchanged; the same number is
// shown in € or £. There is deliberately no per-month price anywhere.
import { buildWhatsAppUrl } from './whatsapp.js';
import { withOrigin } from './origin.js';

export const PLANS = {
    standard: {
        id: 'standard',
        name: 'Standard',
        screens: 3,
        quality: 'FHD',
        options: [
            { paid: 1, bonus: 0, price: 12 },
            { paid: 3, bonus: 1, price: 35 },
            { paid: 6, bonus: 1, price: 60 },
            { paid: 12, bonus: 1, price: 110 }
        ]
    },
    vip: {
        id: 'vip',
        name: 'VIP',
        screens: 5,
        quality: '4K',
        options: [
            { paid: 1, bonus: 0, price: 14 },
            { paid: 3, bonus: 1, price: 39 },
            { paid: 6, bonus: 2, price: 69 },
            { paid: 12, bonus: 2, price: 139 }
        ]
    }
};

export const DEFAULT_CHOICE = { plan: 'vip', paid: 3 };
export const FAVOURITE_LABEL = 'Cel mai ales';

const SYMBOLS = { EUR: '€', GBP: '£' };
const NBSP = ' ';

export function findOption(planId, paid) {
    const plan = Object.hasOwn(PLANS, planId) ? PLANS[planId] : null;
    return plan?.options.find(option => option.paid === Number(paid)) ?? null;
}

export function currencyFor(country) {
    return String(country ?? '').trim().toUpperCase() === 'GB' ? 'GBP' : 'EUR';
}

export function formatPrice(amount, currency) {
    return `${amount}${NBSP}${SYMBOLS[currency] ?? SYMBOLS.EUR}`;
}

const months = count => (count === 1 ? '1 lună' : `${count} luni`);

export function durationLabel(option) {
    return option.bonus ? `${months(option.paid)} + ${months(option.bonus)} cadou` : months(option.paid);
}

export function giftLabel(option) {
    return option.bonus ? `+${months(option.bonus)} cadou` : '';
}

// The one true label the owner's data supports: VIP 3+1 is the most chosen package.
export function isFavourite(planId, paid) {
    return planId === 'vip' && Number(paid) === 3;
}

export function orderMessage(planId, paid, currency) {
    const plan = PLANS[planId];
    const option = findOption(planId, paid);
    const price = formatPrice(option.price, currency).replace(NBSP, ' ');
    return `Salut! Vreau pachetul ${plan.name} · ${durationLabel(option)} (${price}). Îmi trimiteți, vă rog, pașii de plată?`;
}

// "În aceeași casă": one subscription works in one home (all screens on the same internet connection).
const PLAN_BENEFITS = {
    standard: ['Până la 3 ecrane, în aceeași casă', 'Calitate până la Full HD'],
    vip: ['Până la 5 ecrane, în aceeași casă', 'Calitate până la 4K']
};
// The words of those first benefits that set each plan apart (shown in bold).
const PLAN_HIGHLIGHTS = {
    standard: ['3 ecrane', 'Full HD'],
    vip: ['5 ecrane', '4K']
};
const SHARED_BENEFITS = ['Canale românești în direct, cu ghid TV', 'Filme și seriale la cerere', 'Te ajutăm la instalare'];

// Everything the selector shows for one choice, in one currency. An unknown choice falls back to the
// default package, so the page can never show an impossible combination. `code` is the ad origin code
// (js/origin.js) for the WhatsApp order; name, amount and currency also feed the ad events.
export function pricingView(planId, paid, currency, code = '') {
    const valid = findOption(planId, paid) !== null;
    const plan = PLANS[valid ? planId : DEFAULT_CHOICE.plan];
    const option = findOption(plan.id, valid ? paid : DEFAULT_CHOICE.paid);
    const durationText = durationLabel(option);
    return {
        plan: plan.id,
        name: plan.name,
        paid: option.paid,
        bonus: option.bonus,
        title: `${plan.name} · ${durationText}`,
        durationText,
        price: formatPrice(option.price, currency),
        amount: option.price,
        currency: Object.hasOwn(SYMBOLS, currency) ? currency : 'EUR',
        gift: giftLabel(option),
        favourite: isFavourite(plan.id, option.paid),
        benefits: [...PLAN_BENEFITS[plan.id], ...SHARED_BENEFITS],
        highlights: PLAN_HIGHLIGHTS[plan.id],
        orderHref: buildWhatsAppUrl(withOrigin(orderMessage(plan.id, option.paid, currency), code)),
        options: plan.options.map(item => ({
            paid: item.paid,
            label: durationLabel(item),
            months: months(item.paid),
            price: formatPrice(item.price, currency),
            gift: giftLabel(item),
            favourite: isFavourite(plan.id, item.paid)
        }))
    };
}
