import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { PLANS, formatPrice, orderMessage, pricingView } from '../js/pricing.js';
import { buildWhatsAppUrl } from '../js/whatsapp.js';
import { formatThousands } from '../js/count-up.js';
import { contrastRatio } from './helpers/contrast.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const tags = selector => [...html.matchAll(new RegExp(`<[^>]*${selector}[^>]*>`, 'g'))].map(match => match[0]);

test('the auto-rotating TV title is not a live region (no announcement every few seconds)', () => {
    const [title] = tags('data-tv-title');
    assert.ok(title, 'TV title exists');
    assert.doesNotMatch(title, /aria-live/);
});

test('only the active TV image is exposed to assistive technology', () => {
    const images = tags('class="tv__img');
    assert.equal(images.length, 4);
    for (const image of images) {
        if (image.includes('is-active')) assert.doesNotMatch(image, /aria-hidden/);
        else assert.match(image, /aria-hidden="true"/);
    }
});

test('every TV picture names its clip, and each clip exists within the size budget', () => {
    const images = tags('data-tv-image=');
    assert.equal(images.length, 4);
    for (const image of images) {
        const key = image.match(/data-tv-image="([a-z]+)"/)[1];
        const clip = image.match(/data-tv-video="([^"]+)"/)?.[1];
        assert.equal(clip, `video/tv-${key}-960.mp4`, `${key} clip`);
        const bytes = statSync(new URL(`../${clip}`, import.meta.url)).size;
        assert.ok(bytes <= 360 * 1024, `${clip} is ${Math.round(bytes / 1024)} KB`);
    }
});

test('the TV has a motion pause button that the script reveals (hidden without JavaScript)', () => {
    const [button] = tags('data-tv-pause');
    assert.ok(button, 'pause button exists');
    assert.match(button, /^<button /);
    assert.match(button, /type="button"/);
    assert.match(button, /aria-pressed="false"/);
    assert.match(button, /aria-label="Oprește mișcarea"/);
    assert.match(button, /\shidden[\s>]/);
});

test('copy names no channel brands and shows no per-month prices', () => {
    const text = html.replace(/<[^>]+>/g, ' ');
    for (const banned of [/\bDigi\b/, /PRO ?TV/i, /Antena/, /\bHBO\b/, /Netflix/i, /Premier League/i, /adulți/i, /\/\s*lună/i, /pe lună/i]) {
        assert.doesNotMatch(text, banned);
    }
});

const inputs = name => [...html.matchAll(/<input\b[^>]*>/g)].map(match => match[0]).filter(tag => tag.includes(`name="${name}"`));
const textOf = attribute => {
    const match = html.match(new RegExp(`<[^>]*${attribute}[^>]*>([^<]*)<`));
    return match ? match[1].replace(/&nbsp;/g, ' ').trim() : null;
};

test('the price section works without JavaScript', () => {
    const plans = inputs('plan');
    const paid = inputs('paid');
    assert.equal(plans.length, 2);
    assert.equal(paid.length, 4);
    assert.deepEqual(plans.filter(tag => /\schecked/.test(tag)).map(tag => tag.match(/value="(\w+)"/)[1]), ['vip']);
    assert.deepEqual(paid.filter(tag => /\schecked/.test(tag)).map(tag => tag.match(/value="(\w+)"/)[1]), ['3']);
    assert.equal(textOf('data-card-price'), formatPrice(39, 'EUR'));
    const [order] = tags('data-order');
    const href = order.match(/href="([^"]+)"/)[1].replace(/&amp;/g, '&');
    assert.equal(href, buildWhatsAppUrl(orderMessage('vip', 3, 'EUR')));
});

test('"Cel mai ales" appears exactly once', () => {
    assert.equal(html.split('Cel mai ales').length - 1, 1);
});

test('each price step is a fieldset with a legend', () => {
    // What a screen reader announces: the decorative step number is aria-hidden.
    const legends = [...html.matchAll(/<fieldset[\s\S]*?<legend[^>]*>([\s\S]*?)<\/legend>/g)].map(match => match[1]
        .replace(/<span[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim());
    assert.deepEqual(legends, ['Câte ecrane folosești?', 'Pentru cât timp?']);
});

// --- Standard next to VIP (15 Nov 2026): the differences and the one-home rule, where the plan is chosen -------
const planStep = () => html.match(/<fieldset class="pricing__step">[\s\S]*?<\/fieldset>/)?.[0] ?? '';

test('under the plan choice a table compares Standard and VIP, in step with the selector\'s data', () => {
    const step = planStep();
    // The tiles answer the step's question ("Câte ecrane folosești?"); everything else is in the table.
    const tiles = [...step.matchAll(/<span class="choice__meta">([^<]+)<\/span>/g)].map(match => match[1]);
    assert.deepEqual(tiles, [`Până la ${PLANS.standard.screens} ecrane`, `Până la ${PLANS.vip.screens} ecrane`]);
    // A glass frame holds the table, so the chosen column can be lit behind the cells.
    const table = step.match(/<div class="compare">\s*<table class="compare__table">([\s\S]*?)<\/table>\s*<\/div>/)?.[1];
    assert.ok(table, 'the table is inside the first step, right after the two plans');
    assert.match(table, /<caption class="sr-only">[^<]+<\/caption>/);
    assert.deepEqual([...table.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map(match => match[1]), [PLANS.standard.name, PLANS.vip.name]);
    const body = [...table.matchAll(/<tr>\s*<th scope="row">([\s\S]*?)<\/th>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g)];
    // What a visitor reads in each cell, whatever wraps it.
    const rows = Object.fromEntries(body.map(([, label, standard, vip]) => [stripTags(label), [stripTags(standard), stripTags(vip)]]));
    // Gift months of the packages longer than one month: the same for all of them, or "up to" the largest.
    const gift = plan => {
        const months = plan.options.filter(option => option.paid > 1).map(option => option.bonus);
        const most = Math.max(...months);
        return months.every(count => count === most) ? `+${most}` : `până la +${most}`;
    };
    assert.deepEqual(rows, {
        Ecrane: [String(PLANS.standard.screens), String(PLANS.vip.screens)],
        Imagine: [PLANS.standard.quality, PLANS.vip.quality],
        'Luni cadou': [gift(PLANS.standard), gift(PLANS.vip)]
    });
    // Standard is Full HD (the owner, 15 Nov 2026): "FHD" in the table, next to VIP's "4K".
    assert.deepEqual(rows.Imagine, ['FHD', '4K']);
    // Each row label carries a small decorative icon, and picture quality reads like the badge on a TV box.
    for (const [, label] of body) {
        assert.match(label, /<svg class="icon compare__icon" aria-hidden="true"><use href="img\/icons\.svg#i-[a-z]+"><\/use><\/svg>/, stripTags(label));
    }
    const quality = body.find(([, label]) => stripTags(label) === 'Imagine');
    for (const cell of quality.slice(2)) assert.match(cell, /^<span class="compare__badge">[^<]+<\/span>$/);
});

test('every icon the pages use exists in the sprite', () => {
    const sprite = readFileSync(new URL('../img/icons.svg', import.meta.url), 'utf8');
    const symbols = new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map(match => match[1]));
    for (const page of ['index.html', 'politica-de-confidentialitate.html', '404.html']) {
        const source = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
        const used = [...new Set([...source.matchAll(/href="\/?img\/icons\.svg#([^"]+)"/g)].map(match => match[1]))];
        assert.deepEqual(used.filter(id => !symbols.has(id)), [], page);
    }
});

test('the one-home rule is written right under the plan choice', () => {
    // One subscription works in one home: the system tells by the internet connection, and blocks a subscription
    // used from different places. A visitor has to read that before choosing how many screens.
    const rule = planStep().match(/<p class="pricing__rule">([\s\S]*?)<\/p>/)?.[1];
    assert.ok(rule, 'the rule is inside the first step');
    const text = rule.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    assert.match(text, /o casă/);
    assert.match(text, /același internet/);
});

// The parts that depend on the chosen plan (the lit column, the house below it) follow one hook on the price
// section: data-plan, written by js/pricing-ui.js, or :has() where the script did not run. An old WebView has no
// :has(); the forgiving :is() keeps the rule alive there, on data-plan alone.
const planHook = plan => `.pricing:is([data-plan="${plan}"], :has(.choice__input[value="${plan}"]:checked))`;
const selectorsOf = () => cssRules.map(rule => rule.selector.replace(/\s+/g, ' '));

test('the chosen plan lights its column in the comparison, with the script or without it', () => {
    for (const plan of ['standard', 'vip']) {
        assert.ok(selectorsOf().some(selector => selector.includes(`${planHook(plan)} .compare::before`)), `${plan}: the capsule`);
    }
    // The old highlight tinted the cells and knew only :has().
    assert.ok(!selectorsOf().some(selector => /\.pricing__step:has\(/.test(selector) && selector.includes('.compare')), 'no rule left on :has() alone');
});

test('the plan that is not chosen stays readable in the comparison (contrast at least 4.5)', () => {
    // The table is glass over the page, so its backdrop changes with the scroll. The lightest it gets: the violet
    // glow of the space background (24% over #070824) under the highlight of the glass (7% white).
    const backdrop = '#2e2b5a';
    for (const [property, what] of [['--compare-dim', 'a value of the other plan'], ['--compare-dim-gold', 'its gift months']]) {
        const ink = cssColour('.compare', property, backdrop);
        const ratio = contrastRatio(ink, backdrop);
        assert.ok(ratio >= 4.5, `${what}: ${ink} on ${backdrop} = ${ratio.toFixed(2)}`);
    }
    // Stepping back is done with those colours, never with opacity (which dims below what the numbers above say).
    const dimmed = cssRules.filter(rule => /\.compare__(table|gift|upto|num|badge|label)/.test(rule.selector));
    assert.ok(dimmed.some(rule => /color:\s*var\(--compare-dim\)/.test(rule.body)), 'the other plan uses --compare-dim');
    assert.ok(dimmed.some(rule => /color:\s*var\(--compare-dim-gold\)/.test(rule.body)), 'its gift months use --compare-dim-gold');
    for (const rule of dimmed) assert.doesNotMatch(rule.body, /opacity:/, rule.selector.replace(/\s+/g, ' ').slice(0, 80));
});

test('on the narrowest phones the plans get wider columns in the comparison, and the capsule follows them', () => {
    // Measured at 280 px: "Standard" in the header was wider than a 31% capsule and stuck out on both sides.
    const narrow = css.split('@media (max-width: 339px) {').slice(1).find(part => part.includes('.compare::before')) ?? '';
    assert.match(narrow, /\.compare__table thead td \{\s*width: 34%;/, 'labels 34%, each plan 33%');
    assert.match(narrow, /\.compare::before \{\s*left: calc\(34% \+ 4px\);\s*width: calc\(33% - 8px\);/, 'the capsule sits in the 33% column');
    // VIP moves the capsule by exactly one column: its own width plus the two insets.
    assert.match(narrow, /\.compare::before \{\s*transform: translateX\(calc\(100% \+ 8px\)\);/);
    assert.match(narrow, /\.compare__table thead th \{[^}]*font-size: 0\.8rem;/);
    // The labels lose room to the plans, so they get smaller too: "Luni cadou" wrapped at 280 px otherwise.
    assert.match(narrow, /\.compare__table tbody th \{[^}]*font-size: 0\.82rem;/);
});

test('a decorative house lights three screens for Standard and five for VIP', () => {
    // The one-home rule as a drawing, between the table and the rule: one roof, one router, the plan's screens.
    const step = planStep();
    const house = step.match(/<div class="home-viz" aria-hidden="true">([\s\S]*?<\/svg>)\s*<\/div>/)?.[1];
    assert.ok(house, 'the house is in the first step, hidden from assistive technology');
    const at = marker => step.indexOf(marker);
    assert.ok(at('class="compare"') < at('class="home-viz"') && at('class="home-viz"') < at('class="pricing__rule"'), 'after the table, before the rule');
    assert.match(house, /<svg class="home-viz__art" viewBox="[\d\s.-]+" focusable="false">/);
    const devices = [...house.matchAll(/<g class="(hv-dev[^"]*)">/g)].map(match => match[1].split(' '));
    assert.equal(devices.length, PLANS.vip.screens, 'one device per VIP screen');
    assert.equal(devices.filter(classes => classes.includes('hv-dev--core')).length, PLANS.standard.screens, 'lit for both plans');
    assert.equal(devices.filter(classes => classes.includes('hv-dev--vip')).length, PLANS.vip.screens - PLANS.standard.screens, 'lit for VIP only');
    // The TV wears the picture quality of the chosen plan; the two extra screens say whose they are.
    assert.deepEqual(Object.fromEntries([...house.matchAll(/<text class="hv-q hv-q--(standard|vip)"[^>]*>([^<]+)<\/text>/g)].map(match => [match[1], match[2]])),
        { standard: PLANS.standard.quality, vip: PLANS.vip.quality });
    assert.deepEqual([...house.matchAll(/<text class="hv-tag"[^>]*>([^<]+)<\/text>/g)].map(match => match[1]), [PLANS.vip.name, PLANS.vip.name]);
    // Self-contained: every url(#id) is defined here, once on the page, and its look lives in the stylesheet.
    const defined = [...house.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    for (const [, id] of house.matchAll(/url\(#([^)]+)\)/g)) assert.ok(defined.includes(id), `#${id} is defined in the drawing`);
    for (const id of defined) assert.equal(ids.filter(other => other === id).length, 1, `id="${id}" is unique on the page`);
    assert.doesNotMatch(house, /\sstyle="/);
    // VIP lights the two extra screens through the plan hook, and nothing in the house moves on its own.
    assert.ok(selectorsOf().some(selector => selector.includes(`${planHook('vip')} .hv-dev--vip .hv-on`)), 'VIP lights the extra screens');
    const houseRules = cssRules.filter(rule => rule.selector.includes('.hv-'));
    assert.ok(houseRules.length >= 10, `${houseRules.length} house rules`);
    for (const rule of houseRules) assert.doesNotMatch(rule.body, /\binfinite\b/, rule.selector);
});

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
const sectionBlock = marker => {
    const start = html.indexOf(marker);
    return start < 0 ? '' : html.slice(start, html.indexOf('</section>', start));
};

test('sections follow the planned order', () => {
    const order = ['id="acasa"', 'id="ce-primesti"', 'id="preturi"', 'id="cum-functioneaza"', 'id="instalare"', 'class="section diaspora"', 'id="intrebari"', 'class="section final-cta"'];
    const positions = order.map(marker => html.indexOf(marker));
    positions.forEach((position, index) => assert.ok(position > 0, `${order[index]} is on the page`));
    assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test('every in-page link points at an existing id', () => {
    const targets = [...new Set([...html.matchAll(/href="#([^"]*)"/g)].map(match => match[1]))];
    assert.deepEqual(targets.filter(id => !ids.includes(id)), []);
});

test('the FAQ works without JavaScript', () => {
    const items = [...sectionBlock('id="intrebari"').matchAll(/<details\b[^>]*>[\s\S]*?<\/details>/g)].map(match => match[0]);
    assert.equal(items.length, 10);
    for (const item of items) {
        assert.match(item, /<summary\b[^>]*>[^<]*\S/);
        assert.doesNotMatch(item.match(/<details\b[^>]*>/)[0], /\sopen/);
    }
});

test('the page has one h1 and every section after the first screen has an h2', () => {
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    // Every section except the first screen (which has the h1); the cookie banner counts too.
    const sections = [...html.matchAll(/<section\b[\s\S]*?<\/section>/g)].map(match => match[0])
        .filter(section => !section.startsWith('<section class="hero"'));
    assert.ok(sections.length >= 6, `${sections.length} sections`);
    for (const section of sections) assert.match(section, /<h2\b/, section.slice(0, 90));
});

test('images below the first screen load lazily and have size and alt', () => {
    const heroEnd = html.indexOf('</section>', html.indexOf('id="acasa"'));
    const images = [...html.slice(heroEnd).matchAll(/<img\b[^>]*>/g)].map(match => match[0]);
    assert.ok(images.length >= 4, `${images.length} images`);
    for (const image of images) {
        for (const rule of [/loading="lazy"/, /\swidth="\d+"/, /\sheight="\d+"/, /\salt="/]) assert.match(image, rule, image);
    }
});

test('Messenger is offered next to WhatsApp in the final CTA', () => {
    const block = sectionBlock('class="section final-cta"');
    assert.match(block, /href="https:\/\/m\.me\/pixelmagix\.shop"/);
    assert.match(block, /class="[^"]*js-trial/);
});

test('the install guide keeps the exact apps, code and download links', () => {
    const block = sectionBlock('id="instalare"');
    const tabs = [...block.matchAll(/<button\b[^>]*role="tab"[^>]*>([^<]*)<\/button>/g)].map(match => match[1].trim());
    assert.deepEqual(tabs, ['Samsung TV', 'LG TV', 'Android TV / Fire TV', 'Telefon', 'Windows', 'Mac', 'Apple TV']);
    // Without JavaScript the tab row stays hidden and every panel is readable; the script turns them into tabs.
    assert.match(block.match(/<div\b[^>]*role="tablist"[^>]*>/)[0], /\shidden[\s>]/);
    const panels = [...block.matchAll(/<article\b[^>]*class="[^"]*install__panel[^"]*"[^>]*>/g)].map(match => match[0]);
    assert.equal(panels.length, 7);
    for (const panel of panels) assert.doesNotMatch(panel, /\shidden/);
    for (const tab of block.matchAll(/aria-controls="([^"]+)"/g)) assert.ok(ids.includes(tab[1]), `panel ${tab[1]} exists`);
    assert.match(block, />3246757</);
    const downloads = [...block.matchAll(/<a\b[^>]*href="(https:\/\/signal-player\.com\/[^"]+)"[^>]*>/g)];
    assert.deepEqual(downloads.map(match => match[1]).sort(), [
        'https://signal-player.com/signal.apk?v=1.0.37',
        'https://signal-player.com/signal.apk?v=1.0.37',
        'https://signal-player.com/signal.dmg',
        'https://signal-player.com/signal.exe'
    ]);
    for (const [tag] of downloads) assert.match(tag, /rel="noopener noreferrer"/);
    assert.match(block, /Hot Player/);
    assert.match(block, /Signal Player/);
});

test('each install panel names the right apps and what to send us', () => {
    const block = sectionBlock('id="instalare"');
    const panel = id => {
        const start = block.indexOf(`id="${id}"`);
        assert.ok(start > 0, `${id} exists`);
        return block.slice(start, block.indexOf('</article>', start));
    };
    const text = markup => markup.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
    // Smart TVs and Apple TV: the app shows a MAC code, and the customer sends it to us.
    for (const id of ['inst-samsung', 'inst-lg']) {
        assert.match(text(panel(id)), /Hot Player/, id);
        assert.match(text(panel(id)), /SmartOne/, id);
    }
    for (const id of ['inst-samsung', 'inst-lg', 'inst-appletv']) assert.match(text(panel(id)), /codul MAC/, id);
    assert.match(panel('inst-appletv'), /href="https:\/\/apps\.apple\.com\/us\/app\/hot-player\/id6695762404\?platform=tv"/);
    // Android TV / Fire TV: Downloader by AFTVnews first, with its icon so people recognise it in the store.
    const firstStep = panel('inst-android').match(/<li>([\s\S]*?)<\/li>/)[1];
    assert.match(text(firstStep), /Downloader by AFTVnews/);
    const icon = firstStep.match(/<img\b[^>]*>/)?.[0];
    assert.ok(icon, 'the Downloader icon is in the first step');
    for (const attribute of [/\salt=""/, /\swidth="\d+"/, /\sheight="\d+"/]) assert.match(icon, attribute);
    const src = icon.match(/\ssrc="([^"]+\.webp)"/)?.[1];
    assert.ok(src, 'the icon is a WebP file');
    assert.ok(statSync(new URL(`../${src}`, import.meta.url)).size <= 8 * 1024, `${src} stays small`);
    // Phones: Signal Player (APK) on Android, Another IPTV Player on iPhone.
    const phone = text(panel('inst-telefon'));
    assert.match(phone, /Signal Player/);
    assert.match(phone, /Another IPTV Player/);
    assert.doesNotMatch(phone, /Hot Player|Google Play/);
    assert.match(panel('inst-telefon'), /href="https:\/\/apps\.apple\.com\/us\/app\/another-iptv-player-m3u-xtream\/id6747290392"/);
    for (const [tag] of block.matchAll(/<a\b[^>]*href="https:\/\/apps\.apple\.com\/[^"]+"[^>]*>/g)) {
        assert.match(tag, /target="_blank"/);
        assert.match(tag, /rel="noopener noreferrer"/);
    }
});

const faqItems = () => [...sectionBlock('id="intrebari"').matchAll(/<details\b[^>]*>[\s\S]*?<\/details>/g)].map(match => ({
    question: stripTags(match[0].match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/)[1]),
    answer: match[0].match(/<div class="faq__a">([\s\S]*)<\/div>/)[1]
}));

test('the FAQ names the same apps for each device as the install guide', () => {
    // The guide is the source: when a panel gets another app, this answer has to follow. (It once kept
    // Hot Player for phones after the guide had moved them to Signal Player and Another IPTV Player.)
    const guide = sectionBlock('id="instalare"');
    const appsOf = id => {
        const start = guide.indexOf(`id="${id}"`);
        return [...guide.slice(start, guide.indexOf('</article>', start)).matchAll(/class="app-chip">([^<]+)</g)].map(match => match[1]);
    };
    const devices = [
        [/Samsung TV/, 'inst-samsung'], [/LG TV/, 'inst-lg'], [/Android TV/, 'inst-android'], [/Fire TV/, 'inst-android'],
        [/telefoane Android/, 'inst-telefon'], [/iPhone/, 'inst-telefon'], [/Windows/, 'inst-windows'], [/\bMac\b/, 'inst-mac'],
        [/Apple TV/, 'inst-appletv']
    ];
    const apps = ['Hot Player', 'SmartOne', 'Signal Player', 'Another IPTV Player'];
    const answer = stripTags(faqItems().find(item => item.question === 'Ce aplicații folosesc?')?.answer ?? '');
    const named = Object.fromEntries(devices.map(([, id]) => [id, new Set()]));
    for (const sentence of answer.split(/(?<=\.)\s+/)) {
        const inSentence = apps.filter(app => sentence.includes(app));
        for (const [device, id] of devices) {
            if (!device.test(sentence)) continue;
            for (const app of inSentence) {
                assert.ok(appsOf(id).includes(app), `"${sentence}" names ${app}, which the guide does not offer for ${id}`);
                named[id].add(app);
            }
        }
    }
    for (const id of Object.keys(named)) assert.deepEqual([...named[id]].sort(), appsOf(id).sort(), `apps named for ${id}`);
});

test('the FAQ lists every package at the price the selector shows', () => {
    // Hand-written text, so search engines read the Standard prices too (the selector shows them only after a
    // click). The selector's data decides: a price changed there has to change here.
    const answer = faqItems().find(item => item.question === 'Cât costă abonamentul?')?.answer;
    assert.ok(answer, 'the question exists');
    const blocks = [...answer.matchAll(/<p><strong>([^<]+)<\/strong>([^<]*)<\/p>\s*<ul>([\s\S]*?)<\/ul>/g)];
    assert.deepEqual(blocks.map(([, name]) => name), ['Standard', 'VIP']);
    for (const [, name, detail, rows] of blocks) {
        const view = pricingView(name.toLowerCase(), 1, 'EUR');
        assert.ok(detail.includes(`până la ${PLANS[view.plan].screens} ecrane`), `${name}:${detail}`);
        const lines = [...rows.matchAll(/<li>([^<]+)<span data-price="(\d+)">([^<]+)<\/span><\/li>/g)];
        assert.deepEqual(lines.map(([, label, , shown]) => `${label}${shown.replace(/&nbsp;/g, ' ')}`),
            view.options.map(option => `${option.label}: ${option.price}`));
        // data-price is what the script reads to show the visitor's currency (js/pricing-ui.js).
        assert.deepEqual(lines.map(([, , amount]) => Number(amount)), PLANS[view.plan].options.map(option => option.price));
    }
});

test('the FAQ says what the plan table says: screens, Full HD or 4K, and one home', () => {
    const answer = question => stripTags(faqItems().find(item => item.question === question)?.answer ?? '');
    const screens = answer('Pe câte ecrane pot folosi abonamentul?');
    for (const words of [`până la ${PLANS.standard.screens} ecrane`, `până la ${PLANS.vip.screens} ecrane`, 'Full HD', '4K', 'aceeași casă', 'același internet']) {
        assert.ok(screens.includes(words), `the screens answer says "${words}"`);
    }
    // The rule has its own question, in the words a customer would use. It covers the phone too: the owner
    // confirmed (15 Nov 2026) that a phone on mobile data is blocked even when nothing is playing at home.
    const away = answer('Pot folosi abonamentul și în altă parte decât acasă?');
    for (const words of ['o singură casă', 'același internet', 'se blochează automat', 'telefon', 'date mobile']) {
        assert.ok(away.includes(words), `the away-from-home answer says "${words}"`);
    }
    // Standard is Full HD everywhere (it used to say "SD și HD", and "HD" in the price list).
    assert.ok(answer('Cât costă abonamentul?').includes(`Standard (până la ${PLANS.standard.screens} ecrane, Full HD)`));
    assert.doesNotMatch(html, /SD și HD|ecrane, HD\)/);
});

test('no line promises that the subscription works wherever you are', () => {
    // It works in any country, but in one home, on that home's internet (the owner's rule, 15 Nov 2026).
    // "Oriunde ai fi" and "oriunde ai o conexiune bună la internet" said otherwise.
    const visible = html.slice(html.indexOf('<body')).replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');
    assert.doesNotMatch(visible, /oriunde/i);
    const country = stripTags(faqItems().find(item => item.question === 'Funcționează în orice țară?')?.answer ?? '');
    assert.ok(country.includes('în orice țară') && country.includes('internetul de acasă'), country);
    assert.ok(stripTags(sectionBlock('class="section diaspora"')).includes('casa ta'), 'the diaspora card speaks of your home');
});

const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

test('the footer has contact, privacy and the four social icons', () => {
    const footer = html.slice(html.indexOf('<footer'), html.indexOf('</footer>'));
    assert.ok(footer.length > 0, 'footer exists');
    for (const href of ['https://wa.me/447449765468', 'mailto:pixelmagixtv@gmail.com', 'https://m.me/pixelmagix.shop', 'politica-de-confidentialitate.html']) {
        assert.ok(footer.includes(`href="${href}"`), href);
    }
    const social = [...footer.matchAll(/<a\b[^>]*class="[^"]*social__link[^"]*"[^>]*>/g)].map(match => match[0]);
    assert.equal(social.length, 4);
    const hrefs = social.map(tag => tag.match(/href="([^"]+)"/)[1]);
    assert.equal(hrefs.filter(href => href === 'https://www.facebook.com/pixelmagix.shop/').length, 3);
    assert.equal(hrefs.filter(href => href === 'https://www.instagram.com/pixelmagixtv').length, 1);
    for (const tag of social) {
        const href = tag.match(/href="([^"]+)"/)[1];
        const label = href.includes('instagram') ? 'Pixel Magix pe Instagram' : 'Pixel Magix pe Facebook';
        assert.match(tag, new RegExp(`aria-label="${label}"`), tag);
        assert.match(tag, /rel="noopener noreferrer"/, tag);
    }
});

test('paused motion stops the marquee and the background', () => {
    const rule = css.match(/([^{}]*\.motion-paused[^{}]*)\{([^}]*)\}/);
    assert.ok(rule, 'a .motion-paused rule exists');
    const [, selectors, body] = rule;
    assert.match(body, /animation-play-state:\s*paused/);
    assert.match(selectors, /\.motion-paused \.marquee__list/);
    assert.match(selectors, /\.motion-paused \.space::after/);
});

test('the category bar never runs out: each copy slides by its own width, and wide screens get five copies', () => {
    const start = html.indexOf('<div class="marquee"');
    const bar = html.slice(start, html.indexOf('</section>', start));
    const lists = [...bar.matchAll(/<ul class="marquee__list"([^>]*)>([\s\S]*?)<\/ul>/g)];
    assert.equal(lists.length, 5);
    const items = ([, , inner]) => [...inner.matchAll(/<li>([^<]+)<\/li>/g)].map(match => match[1]);
    lists.forEach((list, index) => {
        assert.deepEqual(items(list), items(lists[0]), `copy ${index + 1} repeats the same categories`);
        if (index === 0) assert.doesNotMatch(list[1], /aria-hidden/);
        else assert.match(list[1], /aria-hidden="true"/);
    });
    // Each list slides by its own width (-100%), so the loop has no seam whatever the number of copies.
    assert.match(css, /@keyframes marquee\s*\{\s*to\s*\{\s*transform:\s*translateX\(-100%\);?\s*\}\s*\}/);
    assert.match(cssRules.find(rule => rule.selector === '.marquee__list').body, /animation:\s*marquee 42s linear infinite/);
    assert.doesNotMatch(cssRules.find(rule => rule.selector === '.marquee__track').body, /animation/);
    // Phones need two copies (one copy is wider than the screen); from 960px all five run, enough up to ~4800px.
    assert.match(css, /\.marquee__list:nth-child\(n \+ 3\)\s*\{\s*display:\s*none;?\s*\}/);
    assert.match(css, /@media \(min-width: 960px\)\s*\{\s*\.marquee__list:nth-child\(n \+ 3\)\s*\{\s*display:\s*flex;?\s*\}\s*\}/);
    // Hover and reduced motion stop the lists themselves (the pause button is checked above).
    assert.match(css, /\.marquee:hover \.marquee__list\s*\{\s*animation-play-state:\s*paused;?\s*\}/);
    assert.match(css, /prefers-reduced-motion: reduce[\s\S]*\.marquee__list\s*\{\s*animation:\s*none;?\s*\}/);
});

test('the glass button keeps its border (it is not lost to .btn)', () => {
    const rule = css.match(/\n\.btn--glass\s*\{([^}]*)\}/);
    assert.ok(rule, '.btn--glass rule exists');
    assert.match(rule[1], /border:\s*1px solid/);
});

// --- Effects (stage 2, part 3) -------------------------------------------------------------------
const stripTags = text => text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/\s+([.,!?:])/g, '$1').trim();
const cssRules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, selector, body]) => ({ selector: selector.trim(), body }));
const pausedSelectors = () => css.match(/([^{}]*\.motion-paused[^{}]*)\{[^}]*animation-play-state:\s*paused/)?.[1] ?? '';

test('the headline stays exactly the owner\'s', () => {
    const title = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)[1];
    assert.equal(stripTags(title), 'România pe ecranul tău, fără compromisuri.');
});

test('how it works shows an example WhatsApp chat that screen readers read as plain text', () => {
    const block = sectionBlock('id="cum-functioneaza"');
    const figure = block.match(/<figure\b[^>]*class="chat-demo[^"]*"[^>]*>[\s\S]*?<\/figure>/)?.[0];
    assert.ok(figure, 'the chat demo is in the section');
    assert.equal(stripTags(figure.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/)?.[1] ?? ''), 'Exemplu de conversație pe WhatsApp');
    assert.doesNotMatch(figure, /role="img"/);
    // Only "Tu" (the visitor) and Pixel Magix speak: an illustration, not a customer testimonial.
    const lines = [...figure.matchAll(/<p class="chat__text">([\s\S]*?)<\/p>/g)].map(match => stripTags(match[1]));
    assert.deepEqual(lines, [
        'Tu: Salut! Vreau testul gratuit de 36h.',
        'Pixel Magix: Salut! Ți-am activat testul de 36 de ore.',
        'Pixel Magix: Îți trimit acum datele și pașii de instalare.'
    ]);
});

test('the example phone has a status bar, chat actions and a full message field, all decorative', () => {
    // What makes the drawing read as a real phone (16 Nov 2026). None of it is content: the three messages stay
    // the only thing a screen reader meets.
    const figure = sectionBlock('id="cum-functioneaza"').match(/<figure\b[^>]*class="chat-demo[^"]*"[^>]*>[\s\S]*?<\/figure>/)?.[0] ?? '';
    const system = figure.match(/<div class="chat__system" aria-hidden="true">([\s\S]*?)<\/div>/)?.[1];
    assert.ok(system, 'a status bar, hidden from assistive technology');
    const times = [...figure.matchAll(/<span class="chat__meta" aria-hidden="true">(\d\d:\d\d)/g)].map(match => match[1]);
    assert.equal(times.length, 3);
    assert.equal(stripTags(system), times.at(-1), 'the phone clock shows the time of the last message');
    // The header actions and the tools of the message field sit inside parts that are already hidden.
    const bar = figure.match(/<div class="chat__bar" aria-hidden="true">([\s\S]*?)<\/div>\s*<div class="chat__body">/)?.[1] ?? '';
    const actions = bar.match(/<span class="chat__actions">([\s\S]*?)<\/span>/)?.[1] ?? '';
    assert.deepEqual([...actions.matchAll(/img\/icons\.svg#i-([a-z]+)"/g)].map(match => match[1]), ['video', 'call', 'more']);
    const input = figure.match(/<div class="chat__input" aria-hidden="true">([\s\S]*?)<\/div>\s*<\/div>\s*<\/figure>/)?.[1] ?? '';
    assert.deepEqual([...input.matchAll(/img\/icons\.svg#i-([a-z]+)"/g)].map(match => match[1]), ['smile', 'clip', 'camera', 'mic']);
    assert.match(input, /<span class="chat__placeholder">Mesaj<\/span>/);
    // A new conversation starts at the top of the screen, as in the app.
    assert.match(cssRules.find(rule => rule.selector === '.chat__body')?.body ?? '', /justify-content:\s*flex-start/);
});

test('the chat demo plays once its messages are revealed, so without JavaScript the whole chat is simply there', () => {
    // The message list is the trigger (not the phone): on a phone the chat starts only when the visitor
    // can actually see the messages.
    const animated = cssRules.filter(rule => rule.selector.includes('chat') && /animation[\w-]*\s*:/.test(rule.body));
    assert.ok(animated.length >= 4, `${animated.length} animated chat rules`);
    for (const rule of animated) {
        for (const part of rule.selector.split(',')) {
            assert.match(part, /^\.motion-ok \.chat(__msgs(\.reveal)?\.is-revealed|-demo:has\(\.chat__msgs\.is-revealed\))(\s|$)/, part.trim());
        }
    }
});

test('the first screen has an aurora that is pure decoration', () => {
    const start = html.indexOf('id="acasa"');
    const hero = html.slice(start, html.indexOf('</section>', start));
    assert.match(hero, /<div class="aurora" aria-hidden="true">/);
});

test('the aurora moves only transform and opacity of soft gradients, never a blur', () => {
    const rules = cssRules.filter(rule => rule.selector.includes('aurora'));
    assert.ok(rules.length >= 3, `${rules.length} aurora rules`);
    for (const rule of rules) assert.doesNotMatch(rule.body, /filter|blur\(/, rule.selector);
    const frames = [...css.matchAll(/@keyframes aurora[\w-]*\s*\{([\s\S]*?)\n\}/g)].map(match => match[1]);
    assert.ok(frames.length >= 2, `${frames.length} aurora keyframes`);
    for (const body of frames) {
        for (const [, property] of body.matchAll(/([\w-]+)\s*:/g)) assert.ok(['transform', 'opacity'].includes(property), property);
    }
});

test('the aurora is off for reduced motion and for reduced transparency', () => {
    assert.match(css, /@media \(prefers-reduced-motion: reduce\), \(prefers-reduced-transparency: reduce\) \{\s*\.aurora \{\s*display: none;/);
});

test('the hero lead names one screen at a time, while screen readers get the whole sentence', () => {
    const lead = html.match(/<p class="hero__lead">([\s\S]*?)<\/p>/)?.[1] ?? '';
    assert.equal(stripTags(lead.match(/<span class="lead-static">([\s\S]*?)<\/span>/)?.[1] ?? ''), 'Pe televizor, telefon sau laptop, în orice țară.');
    assert.match(lead, /<span class="lead-rotator" aria-hidden="true">/);
    const words = [...lead.matchAll(/<span class="rotator__word">([^<]+)<\/span>/g)].map(match => match[1]);
    assert.deepEqual(words, ['televizor.', 'telefon.', 'laptop.']);
    // Without motion (or without support) the static sentence is what everyone sees.
    assert.match(css, /\n\.lead-rotator\s*\{\s*display:\s*none;/);
});

test('the pause button also stops the new endless motion', () => {
    const selectors = pausedSelectors();
    for (const part of ['.aurora__wave', '.rotator__word']) assert.ok(selectors.includes(`.motion-paused ${part}`), part);
});

test('the photos of "Ce primești" and the diaspora card are marked to build up from pixels', () => {
    const photos = [...sectionBlock('id="ce-primesti"').matchAll(/<img\b[^>]*class="tile__img"[^>]*>/g)].map(match => match[0]);
    assert.equal(photos.length, 3);
    for (const tag of photos) assert.match(tag, /\sdata-materialise[\s>]/, tag);
    // The diaspora photo gets a positioned wrapper so the canvas can lie exactly over it.
    assert.match(sectionBlock('class="section diaspora"'), /<div class="diaspora__media">\s*<img\b[^>]*class="diaspora__img"[^>]*\sdata-materialise[\s>]/);
    const cover = cssRules.find(rule => rule.selector === '.photo-fx');
    assert.ok(cover, '.photo-fx rule exists');
    assert.match(cover.body, /position:\s*absolute/);
    assert.match(cover.body, /\scolor:/, 'the cover colour lives in CSS');
});

test('the "Ce primești" photos show people at home, and the hero TV keeps its own stills', () => {
    // The tiles used to repeat three of the TV's stills, two screens further down. Since 16 Nov 2026 they show who
    // is watching (the owner's choice); the TV above keeps showing what is on, with its clips.
    const photos = [...sectionBlock('id="ce-primesti"').matchAll(/<img\b[^>]*class="tile__img"[^>]*>/g)].map(match => match[0]);
    const names = ['acasa-meci', 'acasa-film', 'acasa-copii'];
    assert.deepEqual(photos.map(tag => tag.match(/\ssrc="([^"]+)"/)[1]), names.map(name => `img/${name}-720.webp`));
    photos.forEach((tag, index) => {
        const name = names[index];
        assert.equal(tag.match(/\ssrcset="([^"]+)"/)[1].replace(/\s+/g, ' '), `img/${name}-720.webp 720w, img/${name}-1280.webp 1280w`);
        for (const [width, limit] of [[1280, 60], [720, 30]]) {
            const bytes = statSync(new URL(`../img/${name}-${width}.webp`, import.meta.url)).size;
            assert.ok(bytes <= limit * 1024, `${name}-${width}: ${Math.round(bytes / 1024)} KB`);
        }
    });
    assert.deepEqual(tags('data-tv-image=').map(tag => (tag.match(/\ssrc="([^"]+)"/) ?? tag.match(/\sdata-src="([^"]+)"/))[1]),
        ['sport', 'stiri', 'filme', 'copii'].map(key => `img/tv-${key}-1280.webp`));
});

test('without JavaScript the price card already shows the VIP key words in bold', () => {
    const list = html.match(/<ul class="pricing__benefits"[^>]*>([\s\S]*?)<\/ul>/)[1];
    assert.deepEqual([...list.matchAll(/<strong>([^<]+)<\/strong>/g)].map(match => match[1]), pricingView('vip', 3, 'EUR').highlights);
    // And the same five lines the script writes for VIP, word for word.
    assert.deepEqual([...list.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(match => match[1].replace(/<[^>]+>/g, '')), pricingView('vip', 3, 'EUR').benefits);
});

test('without JavaScript the price card already draws the default package as squares', () => {
    // VIP · 3 luni + 1 lună cadou: three paid months and a gold one, before the gift label. Decorative: the
    // title above says the same in words.
    const gift = html.match(/<p class="pricing__gift">([\s\S]*?)<\/p>/)?.[1] ?? '';
    const row = gift.match(/^<span class="months" data-card-months aria-hidden="true">([\s\S]*?)<\/span><span class="gift" data-card-gift>/)?.[1];
    assert.ok(row !== undefined, 'the squares come right before the gift label');
    const view = pricingView('vip', 3, 'EUR');
    const kinds = [...row.matchAll(/<i class="([^"]+)"><\/i>/g)].map(match => match[1]);
    assert.deepEqual(kinds, [...Array(view.paid).fill('months__m'), ...Array(view.bonus).fill('months__m months__m--gift')]);
    assert.equal(row.replace(/<i class="[^"]+"><\/i>/g, '').trim(), '', 'nothing else in the row');
    // No script numbers these squares, so the stylesheet does: up to the longest package there is.
    const longest = Math.max(...Object.values(PLANS).flatMap(plan => plan.options.map(option => option.paid + option.bonus)));
    for (let place = 2; place <= longest; place += 1) {
        const rule = cssRules.find(candidate => candidate.selector === `.months__m:nth-child(${place})`);
        assert.match(rule?.body ?? '', new RegExp(`--i:\\s*${place - 1};`), `square ${place}`);
    }
});

test('the pause button hides the wand sparkles too', () => {
    const rule = cssRules.find(candidate => candidate.selector === 'html.motion-paused .sparkles');
    assert.ok(rule, 'html.motion-paused .sparkles rule exists');
    assert.match(rule.body, /display:\s*none/);
    const layer = cssRules.find(candidate => candidate.selector === '.sparkles');
    assert.ok(layer, '.sparkles rule exists');
    assert.match(layer.body, /pointer-events:\s*none/);
    assert.match(layer.body, /position:\s*fixed/);
});

test('each install tab names its device, and a decorative device mockup starts on the first one', () => {
    const block = sectionBlock('id="instalare"');
    const devices = [...block.matchAll(/<button\b[^>]*role="tab"[^>]*\sdata-device="([a-z]+)"[^>]*>/g)].map(match => match[1]);
    assert.deepEqual(devices, ['samsung', 'lg', 'android', 'telefon', 'windows', 'mac', 'appletv']);
    const stage = block.match(/<div class="device"[^>]*>/)?.[0];
    assert.ok(stage, 'the device stage exists');
    assert.match(stage, /aria-hidden="true"/);
    assert.match(stage, /data-device="samsung"/);
    const screens = [...block.matchAll(/<img\b[^>]*class="device__img[^"]*"[^>]*>/g)].map(match => match[0]);
    assert.equal(screens.length, 2, 'one wide screen (TV, laptop) and one tall screen (phone)');
    for (const tag of screens) assert.match(tag, /\salt=""/);
});

test('the device screens are light WebP pictures (at most 80 KB each)', () => {
    for (const name of ['app-ecran-lat', 'app-ecran-telefon']) {
        const bytes = statSync(new URL(`../img/${name}.webp`, import.meta.url)).size;
        assert.ok(bytes <= 80 * 1024, `${name}: ${Math.round(bytes / 1024)} KB`);
    }
});

// Colours as written in style.css: #rrggbb, or rgb(r g b / a) painted over `under`.
function cssColour(selector, property, under = '#000000') {
    const rule = cssRules.find(candidate => candidate.selector === selector);
    assert.ok(rule, `${selector} exists`);
    const value = rule.body.match(new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`))?.[1].trim();
    assert.ok(value, `${selector} { ${property} }`);
    if (value.startsWith('#')) return value;
    const [r, g, b, a = 1] = value.match(/[\d.]+/g).map(Number);
    const base = [1, 3, 5].map(index => parseInt(under.slice(index, index + 2), 16));
    return `#${[r, g, b].map((channel, index) => Math.round(a * channel + (1 - a) * base[index]).toString(16).padStart(2, '0')).join('')}`;
}

test('the example chat keeps every line of text readable (contrast at least 4.5)', () => {
    const out = cssColour('.chat__row--out .chat__bubble', 'background');
    const reply = cssColour('.chat__bubble', 'background');
    const bar = cssColour('.chat__bar', 'background');
    const text = cssColour('.chat', 'color');
    const pairs = [
        [text, out, 'message on the visitor bubble'],
        [text, reply, 'message on a reply bubble'],
        [cssColour('.chat__meta', 'color', out), out, 'time on the visitor bubble'],
        [cssColour('.chat__meta', 'color', reply), reply, 'time on a reply bubble'],
        [cssColour('.chat__status', 'color'), bar, '"online"'],
        [cssColour('.chat__typing', 'color'), bar, '"scrie…"'],
        [cssColour('.chat__day', 'color'), cssColour('.chat__day', 'background'), '"Azi"'],
        [cssColour('.chat__field', 'color'), cssColour('.chat__field', 'background'), '"Mesaj"']
    ];
    for (const [ink, paper, what] of pairs) {
        const ratio = contrastRatio(ink, paper);
        assert.ok(ratio >= 4.5, `${what}: ${ink} on ${paper} = ${ratio.toFixed(2)}`);
    }
});

test('the install guide grid never grows wider than a small phone screen', () => {
    // An auto column would grow to the widest unbreakable button text and widen the page at 280-320 px.
    const rule = cssRules.find(candidate => candidate.selector === '.install__wrap');
    assert.ok(rule, '.install__wrap exists');
    assert.match(rule.body, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test('on small phones the install download buttons may wrap (no page wider than the screen)', () => {
    // "Descarcă pentru Windows" on one line needs 290 px: at 280-320 px it widened the whole page.
    const rule = cssRules.find(candidate => candidate.selector === '.install__actions .btn');
    assert.ok(rule, '.install__actions .btn exists (small-screen rule)');
    assert.match(rule.body, /white-space:\s*normal/);
});

test('the aurora fades in after the first paint, so it never delays the headline or the TV', () => {
    // Painting the large gradient waves in the first frame cost about 50 ms of first paint on a slow phone.
    const rule = cssRules.find(candidate => candidate.selector === '.aurora' && /animation:/.test(candidate.body));
    assert.ok(rule, 'an animated .aurora rule exists');
    const [, delay] = rule.body.match(/animation:\s*fade-in\s+[\d.]+s\s+[\w-]+\s+([\d.]+)s\s+backwards/) ?? [];
    assert.ok(Number(delay) >= 0.5, `fade-in delay ${delay}s`);
});

test('the space background (nebula, grid, pixel dust) is not painted over by the page body', () => {
    // .space is fixed with z-index -1 in the root stacking context, so an opaque body background paints above it.
    // The page colour belongs on html (it fills the whole canvas).
    const body = cssRules.find(rule => rule.selector === 'body');
    const background = body.body.match(/(?:^|[;\s])background(?:-color)?:\s*([^;]+);/)?.[1].trim();
    assert.ok(!background || ['transparent', 'none'].includes(background), `body background: ${background}`);
    assert.match(cssRules.find(rule => rule.selector === 'html').body, /background:\s*var\(--bg\)/);
    assert.match(cssRules.find(rule => rule.selector === '.space').body, /z-index:\s*-1/);
});

test('while scrolling, the space glow shifts within the brand colours (never toward green)', () => {
    // A negative hue rotation turns the cyan glow green; a positive one moves cyan to blue/violet and violet to magenta.
    const frames = css.match(/@keyframes nebula-shift\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    const degrees = Number(frames.match(/hue-rotate\((-?[\d.]+)deg\)/)?.[1]);
    assert.ok(degrees > 0 && degrees <= 40, `hue-rotate(${degrees}deg)`);
});

test('on very narrow phones the header shows only the hat, so its button never covers the name', () => {
    // Measured: "Test gratuit" overlapped "Pixel Magix" at 280 px; on the privacy page "Înapoi la site" did so up to
    // 340 px and even widened the page at 280-300 px.
    for (const [query, selector] of [['(max-width: 319px)', '.site-header .brand__name'], ['(max-width: 359px)', '.legal-header .brand__name']]) {
        const block = css.split(`@media ${query} {`).slice(1).find(part => part.includes(selector)) ?? '';
        const rule = block.slice(block.indexOf(selector));
        assert.match(rule, /^[^{]*\{\s*display:\s*none;/, `${query} hides ${selector}`);
    }
    // The links keep their accessible name.
    const home = html.slice(html.indexOf('<header class="site-header"'), html.indexOf('</header>'));
    assert.match(home, /class="brand"[^>]*aria-label="Pixel Magix/);
    const privacy = readFileSync(new URL('../politica-de-confidentialitate.html', import.meta.url), 'utf8');
    assert.match(privacy, /class="brand"[^>]*aria-label="Pixel Magix/);
});

test('the privacy page title fits small phones', () => {
    // "confidențialitate" is one long word: at a fixed minimum of 32 px it stuck out of the card and widened the
    // page at 280-320 px. Small screens now get a smaller title (tablets and desktops keep theirs), and the word
    // may break as a last resort.
    const rule = cssRules.find(candidate => candidate.selector === '.legal h1');
    assert.ok(rule, '.legal h1 exists');
    assert.match(rule.body, /overflow-wrap:\s*break-word/);
    const floor = Number(rule.body.match(/font-size:\s*max\(([\d.]+)rem/)?.[1]);
    assert.ok(floor > 0 && floor <= 1.5, `smallest title size ${floor}rem`);
});

// --- Cookie banner (Etapa 3) -----------------------------------------------------------------------------
const consentBlock = () => html.slice(html.indexOf('<section class="consent'), html.indexOf('</section>', html.indexOf('<section class="consent')));

test('the cookie banner comes first in the page, hidden until the script decides', () => {
    const [banner] = tags('data-consent ');
    assert.ok(banner, 'banner exists');
    assert.match(banner, /^<section class="consent glass"/);
    assert.match(banner, /aria-labelledby="consent-title"/);
    assert.match(banner, /tabindex="-1"/);
    assert.match(banner, /\shidden[\s>]/);
    assert.ok(html.indexOf('<section class="consent') < html.indexOf('class="skip-link"'), 'before the skip link');
    assert.match(consentBlock(), /<h2 class="consent__title" id="consent-title">[\s\S]*Cookie-uri<\/h2>/);
    assert.match(consentBlock(), /href="politica-de-confidentialitate\.html"/);
});

test('the first screen offers one "Accept toate" in the brand gradient; "Refuz toate" waits in the settings', () => {
    const block = consentBlock();
    const buttonsIn = part => [...part.matchAll(/<button ([^>]*)>([^<]*)<\/button>/g)].map(([, attributes, label]) => ({ attributes, label: label.trim() }));
    const classOf = attributes => attributes.match(/class="([^"]+)"/)?.[1] ?? '';
    const first = buttonsIn(block.match(/<div class="consent__actions">([\s\S]*?)<\/div>/)?.[1] ?? '');
    assert.equal(first.length, 1, 'one button on the first screen');
    assert.equal(first[0].label, 'Accept toate');
    assert.match(first[0].attributes, /data-consent-accept/);
    assert.match(first[0].attributes, /type="button"/);
    assert.match(classOf(first[0].attributes), /\bbtn--primary\b/);
    assert.doesNotMatch(classOf(first[0].attributes), /\bbtn--sm\b/);
    assert.equal(block.match(/\bbtn--primary\b/g)?.length, 1, 'the only gradient button in the banner');
    // Refusing stays possible: in the settings, with the same weight as saving a custom choice.
    const options = block.match(/<div class="consent__options"[\s\S]*?<div class="consent__actions">/)?.[0] ?? '';
    const pair = buttonsIn(options.match(/<div class="consent__pair">([\s\S]*?)<\/div>/)?.[1] ?? '');
    assert.deepEqual(pair.map(button => button.label), ['Salvez alegerea', 'Refuz toate']);
    assert.match(pair[0].attributes, /data-consent-save/);
    assert.match(pair[1].attributes, /data-consent-reject/);
    for (const button of pair) {
        assert.equal(classOf(button.attributes), 'btn btn--glass btn--sm glass-lite');
        assert.match(button.attributes, /type="button"/);
    }
});

test('the first-screen text still says what the cookies are for (statistics and ads)', () => {
    const text = consentBlock().match(/<p class="consent__text">([\s\S]*?)<\/p>/)?.[1].replace(/\s+/g, ' ').trim() ?? '';
    assert.match(text, /\bstatistici\b/);
    assert.match(text, /\breclame\b/);
});

test('the settings start closed, with unticked switches for Statistici and Marketing', () => {
    const block = consentBlock();
    const settings = block.match(/<button [^>]*data-consent-settings[^>]*>/)?.[0] ?? '';
    assert.match(settings, /aria-expanded="false"/);
    assert.match(settings, /aria-controls="consent-options"/);
    assert.match(block, /<div class="consent__options" id="consent-options" data-consent-options hidden>/);
    const switches = [...block.matchAll(/<input [^>]*class="consent__switch"[^>]*>/g)].map(match => match[0]);
    assert.deepEqual(switches.map(tag => tag.match(/name="([a-z]+)"/)[1]), ['statistici', 'marketing']);
    for (const tag of switches) {
        assert.match(tag, /type="checkbox"/);
        assert.doesNotMatch(tag, /\schecked/);
        assert.match(tag, /aria-describedby="consent-desc-[a-z]+"/);
    }
    const text = block.replace(/<[^>]+>/g, ' ');
    for (const words of ['Statistici', 'Google Analytics', 'Marketing', 'Meta Pixel', 'Strict necesare', 'Salvez alegerea']) {
        assert.ok(text.includes(words), words);
    }
});

test('the footer has a "Setări cookie" button that the script reveals, and the choice is confirmed politely', () => {
    const footer = html.slice(html.indexOf('<footer'), html.indexOf('</footer>'));
    assert.match(footer, /<li data-consent-footer hidden><button class="link-button" type="button" id="setari-cookie" data-consent-open>Setări cookie<\/button><\/li>/);
    const [status] = tags('data-consent-status');
    assert.ok(status, 'status region exists');
    assert.match(status, /aria-live="polite"/);
    assert.ok(!consentBlock().includes('data-consent-status'), 'outside the banner, so it is heard after the banner closes');
});

test('the banner floats above the tab bar, scrolls inside when tall, and moves only when motion is welcome', () => {
    const rule = selector => cssRules.find(({ selector: found }) => found.split(',').map(part => part.trim()).includes(selector))?.body ?? '';
    assert.match(rule('.consent'), /position:\s*fixed/);
    assert.ok(Number(rule('.consent').match(/z-index:\s*(\d+)/)?.[1]) > 50, 'above the header and the tab bar (50)');
    assert.match(rule('.consent'), /bottom:\s*calc\([^;]*var\(--tabbar-h\)/);
    assert.match(rule('.consent[hidden]'), /display:\s*none/);
    assert.match(rule('.consent__inner'), /overflow-y:\s*auto/);
    assert.match(rule('.consent__inner'), /max-height:/);
    // "Salvez alegerea" and "Refuz toate" share a row, and stack instead of overflowing on narrow phones.
    assert.match(rule('.consent__pair'), /display:\s*flex/);
    assert.match(rule('.consent__pair'), /flex-wrap:\s*wrap/);
    assert.match(rule('.consent__pair .btn'), /flex:\s*1 1 0/);
    const motion = css.match(/@media \(prefers-reduced-motion: no-preference\) \{\s*\.consent \{\s*animation:[^}]*\}/);
    assert.ok(motion, 'the entrance animation exists only for prefers-reduced-motion: no-preference');
    assert.match(css, /@media \(forced-colors: active\) \{\s*\.consent__switch \{\s*appearance: auto;/);
});

test('the catalogue shows 9.100+ films and 950+ series, and each count-up ends on the text in the HTML', () => {
    // The number is written once in the heading (a second, hidden copy made search engines read "9.100+9.100+").
    const counts = [...html.matchAll(/<h3 class="tile__title"([^>]*)>\s*<span data-count="(\d+)">([^<]+)<\/span>([^<]*)<\/h3>/g)]
        .map(([, attributes, to, shown, rest]) => ({ spoken: attributes.match(/\saria-label="([^"]+)"/)?.[1], to: Number(to), shown, text: `${shown}${rest}` }));
    assert.deepEqual(counts.map(({ shown }) => shown), ['9.100+', '950+']);
    for (const { spoken, to, shown, text } of counts) {
        assert.equal(`${formatThousands(to)}+`, shown, 'the count-up stops on the number already written in the page');
        // The heading's label is its final text, so a screen reader never reads a number that is still counting.
        assert.equal(spoken, text, 'screen readers hear the final heading');
    }
    const descriptions = [...tags('og:description'), ...tags('twitter:description')];
    assert.equal(descriptions.length, 2);
    for (const tag of descriptions) assert.match(tag, /9\.100\+ filme la cerere și 950\+ seriale la cerere/);
    assert.doesNotMatch(html, /12\.000|1\.300/);
});

test('the page gives one number of Romanian channels: 470+ (the owner\'s count since 15 Nov 2026, was 520+)', () => {
    const chips = [...html.matchAll(/<li class="chip glass-lite">([^<]+)<\/li>/g)].map(match => match[1]);
    assert.ok(chips.includes('470+ canale românești'), chips.join(' | '));
    const descriptions = [...tags('og:description'), ...tags('twitter:description')];
    assert.equal(descriptions.length, 2);
    for (const tag of descriptions) assert.match(tag, /470\+ de canale românești/);
    // Wherever the page counts channels, it is the same number. (The share image img/og-pixelmagix.jpg shows it
    // too; it is rendered from design-originale/og/og.html, which is not in the repository.)
    const counts = [...html.matchAll(/(\d[\d.]*\+)(?: de)? canale/g)].map(match => match[1]);
    assert.deepEqual([...new Set(counts)], ['470+']);
});
