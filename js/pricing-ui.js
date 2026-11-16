// Wires the 2-step price selector: every change re-renders the option prices, the card and the
// WhatsApp order link from pricingView(). The HTML already shows the default choice, so this is an
// enhancement; /geo.json may switch everything to £ once.
import { DEFAULT_CHOICE, FAVOURITE_LABEL, currencyFor, formatPrice, pricingView } from './pricing.js';
import { detectCountry } from './geo.js';

const setText = (node, text) => {
    if (node && node.textContent !== text) node.textContent = text;
};

// Restart a one-shot CSS animation (the price "swap") by re-adding its class after a reflow.
const replay = (node, className) => {
    if (!node?.classList) return;
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
};

// A tag is hidden when it has nothing to say (no gift, not the favourite).
const setTag = (node, text) => {
    if (!node) return;
    setText(node, text);
    node.hidden = !text;
};

// One benefit row. Its key words are bold (and glow for a moment on VIP); after a plan switch the row
// cascades in, `cascade` being its place in the list.
const benefitItem = (text, words, cascade, glow) => {
    const item = document.createElement('li');
    const at = words ? text.indexOf(words) : -1;
    if (at < 0) {
        item.textContent = text;
    } else {
        const strong = document.createElement('strong');
        strong.textContent = words;
        if (glow) strong.classList.add('is-glow');
        item.appendChild(document.createTextNode(text.slice(0, at)));
        item.appendChild(strong);
        item.appendChild(document.createTextNode(text.slice(at + words.length)));
    }
    if (cascade >= 0) {
        item.classList.add('is-in');
        item.style.setProperty('--i', String(cascade));
    }
    return item;
};

// `code` is the ad origin code that ends the WhatsApp order message (js/origin.js). For the ad events,
// onChoice(view) hears only the visitor's own changes and onOrder(view) the package on screen when
// "Comandă pe WhatsApp" is clicked. `priceNodes` are prices written elsewhere on the page (the FAQ list),
// each with its amount in data-price: they switch to £ together with the selector.
export function initPricing(root, { code = '', onChoice, onOrder, priceNodes = [] } = {}) {
    const form = root?.querySelector('[data-pricing-form]');
    if (!form) return;
    const card = {
        title: root.querySelector('[data-card-title]'),
        price: root.querySelector('[data-card-price]'),
        gift: root.querySelector('[data-card-gift]'),
        months: root.querySelector('[data-card-months]'),
        benefits: root.querySelector('[data-card-benefits]'),
        order: root.querySelector('[data-order]'),
        summary: root.querySelector('[data-card-summary]')
    };
    const optionNodes = [...form.querySelectorAll('[data-option]')];
    let currency = 'EUR';
    let shownPlan = null;
    let shownMonths = null;
    let shown = null;

    // The package's months as squares next to the gift label: the paid ones, then the gift ones. Only a
    // package with a gift is drawn. The squares are redrawn when the months change (VIP 3 + 1 and Standard
    // 3 + 1 are the same four), and pop in only after the visitor's own choice.
    const drawMonths = (view, popIn) => {
        const months = `${view.paid}+${view.bonus}`;
        if (!card.months || months === shownMonths) return;
        shownMonths = months;
        while (card.months.firstChild) card.months.removeChild(card.months.firstChild);
        const total = view.bonus ? view.paid + view.bonus : 0;
        card.months.hidden = total === 0;
        card.months.style.setProperty('--paid', String(view.paid));
        if (popIn) card.months.classList.add('is-in');
        else card.months.classList.remove('is-in');
        for (let index = 0; index < total; index += 1) {
            const square = document.createElement('i');
            square.classList.add('months__m');
            if (index >= view.paid) square.classList.add('months__m--gift');
            square.style.setProperty('--i', String(index));
            card.months.appendChild(square);
        }
    };

    const choice = () => ({
        plan: form.querySelector('input[name="plan"]:checked')?.value ?? DEFAULT_CHOICE.plan,
        paid: Number(form.querySelector('input[name="paid"]:checked')?.value ?? DEFAULT_CHOICE.paid)
    });

    const render = ({ announce = false } = {}) => {
        const { plan, paid } = choice();
        const view = pricingView(plan, paid, currency, code);
        shown = view;
        // For the styles that follow the plan (the lit column of the comparison, the house): a browser
        // without :has() learns the choice from here.
        root.dataset.plan = view.plan;
        // The order link first: whatever else happens, WhatsApp gets the package on screen.
        if (card.order) card.order.href = view.orderHref;
        optionNodes.forEach((node, index) => {
            const option = view.options[index];
            if (!option) return;
            setText(node.querySelector('[data-option-months]'), option.months);
            setText(node.querySelector('[data-option-price]'), option.price);
            setTag(node.querySelector('[data-option-gift]'), option.gift);
            setTag(node.querySelector('[data-option-favourite]'), option.favourite ? FAVOURITE_LABEL : '');
        });
        setText(card.title, view.title);
        if (announce && card.price && card.price.textContent !== view.price) replay(card.price, 'is-swapping');
        setText(card.price, view.price);
        setTag(card.gift, view.gift);
        drawMonths(view, announce);
        if (card.benefits) {
            // Only the visitor's own switch between Standard and VIP plays the cascade.
            const switched = announce && shownPlan !== null && view.plan !== shownPlan;
            // No replaceChildren(): Safari before 14 (iOS 13) runs this module but lacks it.
            while (card.benefits.firstChild) card.benefits.removeChild(card.benefits.firstChild);
            view.benefits.forEach((text, index) => {
                const item = benefitItem(text, view.highlights[index], switched ? index : -1, switched && view.plan === 'vip');
                card.benefits.appendChild(item);
            });
            shownPlan = view.plan;
        }
        // Polite announcement only for the visitor's own changes, never on load.
        if (announce) setText(card.summary, `Ai ales ${view.title}: ${view.price}.`);
    };

    form.addEventListener('change', () => {
        render({ announce: true });
        onChoice?.(shown);
    });
    form.addEventListener('submit', event => event.preventDefault());
    card.order?.addEventListener?.('click', () => onOrder?.(shown));
    render();
    detectCountry().then(country => {
        if (currencyFor(country) !== 'GBP') return;
        currency = 'GBP';
        render();
        priceNodes.forEach(node => setText(node, formatPrice(Number(node.dataset.price), currency)));
    });
}
