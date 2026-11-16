// What search engines read: titles, descriptions and (further down) the files and data made for them.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const exists = path => existsSync(new URL(`../${path}`, import.meta.url));
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const titleOf = page => page.match(/<title>([^<]*)<\/title>/)?.[1].trim() ?? null;
const metaOf = (page, name) => page.match(new RegExp(`<meta\\s+(?:name|property)="${name}"\\s+content="([^"]*)"`))?.[1] ?? null;
// Characters as a reader counts them (ț and ă are one each).
const length = text => [...text].length;

const canonicalOf = page => page.match(/<link rel="canonical" href="([^"]+)">/)?.[1] ?? null;
// The pages search engines may list: every HTML page of the site that does not ask to stay out of the results.
const listedPages = readdirSync(new URL('../', import.meta.url))
    .filter(name => name.endsWith('.html') && !/<meta name="robots" content="[^"]*noindex/.test(read(name)));

test('the home page title says what the site is, in the words people search for', () => {
    // Plan §10: "televiziune românească în străinătate" first, the brand last. The old title was only a slogan.
    assert.match(titleOf(read('index.html')), /^Televiziune românească în străinătate\b.* Pixel Magix TV$/);
});

test('the home page description names the service, who it is for and the free trial', () => {
    const description = metaOf(read('index.html'), 'description');
    for (const words of [/canale românești/i, /diaspora/i, /test gratuit/i]) assert.match(description, words);
});

test('every listed page has its own title and description, short enough to show whole in a search result', () => {
    const seen = { titles: new Set(), descriptions: new Set() };
    for (const path of listedPages) {
        const page = read(path);
        const title = titleOf(page);
        const description = metaOf(page, 'description');
        assert.ok(title, `${path} has a title`);
        assert.ok(description, `${path} has a description`);
        assert.ok(length(title) <= 60, `${path}: title has ${length(title)} characters`);
        assert.ok(length(description) <= 155, `${path}: description has ${length(description)} characters`);
        assert.ok(!seen.titles.has(title), `${path}: the title is not repeated`);
        assert.ok(!seen.descriptions.has(description), `${path}: the description is not repeated`);
        seen.titles.add(title);
        seen.descriptions.add(description);
    }
});

test('a shared link shows the same title as the page', () => {
    const page = read('index.html');
    assert.equal(metaOf(page, 'og:title'), titleOf(page));
    assert.equal(metaOf(page, 'twitter:title'), titleOf(page));
});

// --- Structured data (JSON-LD, plan §10): who we are, what the site is called, the FAQ ---------------------
// It only repeats what a visitor can read on the page; these tests fail when the two drift apart.
const html = read('index.html');
const textOf = markup => markup.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').replace(/\s+([.,!?:])/g, '$1').trim();
const structuredData = () => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => match[1]);
const entry = type => {
    const [block] = structuredData();
    assert.ok(block, 'the page has a structured data block');
    const found = JSON.parse(block)['@graph'].find(item => item['@type'] === type);
    assert.ok(found, `${type} is described`);
    return found;
};
const footer = html.slice(html.indexOf('<footer'), html.indexOf('</footer>'));

test('the home page has one block of structured data, and it is data: no inline code', () => {
    const blocks = structuredData();
    assert.equal(blocks.length, 1);
    const data = JSON.parse(blocks[0]);
    assert.equal(data['@context'], 'https://schema.org');
    assert.deepEqual(data['@graph'].map(item => item['@type']), ['Organization', 'WebSite', 'FAQPage']);
    // The Worker's policy forbids inline scripts; a JSON-LD block is never run, so it is the one exception.
    for (const [, attributes] of html.matchAll(/<script\b([^>]*)>/g)) {
        assert.ok(/\ssrc="/.test(attributes) || attributes === ' type="application/ld+json"', `<script${attributes}>`);
    }
});

test('the organisation in the structured data is the one in the footer', () => {
    const organisation = entry('Organization');
    assert.equal(organisation.name, metaOf(html, 'og:site_name'));
    assert.equal(organisation.url, canonicalOf(html));
    assert.ok(textOf(footer).includes(organisation.description), organisation.description);
    assert.ok(footer.includes(`href="mailto:${organisation.email}"`), organisation.email);
    assert.match(organisation.telephone, /^\+\d+$/);
    assert.ok(footer.includes(`href="https://wa.me/${organisation.telephone.slice(1)}"`), organisation.telephone);
    assert.ok(organisation.sameAs.length >= 2, 'Facebook and Instagram');
    for (const profile of organisation.sameAs) assert.ok(footer.includes(`href="${profile}"`), profile);
    // The logo is a file of this site: a square PNG of at least 112 px, which is what Google asks of a logo.
    const logo = new URL(organisation.logo);
    assert.equal(logo.origin, 'https://pixelmagix.shop');
    const png = readFileSync(new URL(`..${logo.pathname}`, import.meta.url));
    assert.equal(png.toString('latin1', 1, 4), 'PNG');
    const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    assert.ok(width === height && width >= 112, `${width}x${height}`);
});

test('the site in the structured data has the page\'s name, address and language', () => {
    const site = entry('WebSite');
    assert.equal(site.name, metaOf(html, 'og:site_name'));
    assert.equal(site.url, canonicalOf(html));
    assert.equal(site.inLanguage, html.match(/<html lang="([^"]+)"/)[1]);
    assert.equal(site.publisher['@id'], entry('Organization')['@id']);
});

test('the structured data repeats the FAQ exactly as a visitor reads it', () => {
    const start = html.indexOf('id="intrebari"');
    const visible = [...html.slice(start, html.indexOf('</section>', start)).matchAll(/<details\b[^>]*>[\s\S]*?<\/details>/g)]
        .map(([item]) => ({
            question: textOf(item.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/)[1]),
            answer: textOf(item.match(/<div class="faq__a">([\s\S]*)<\/div>/)[1])
        }));
    assert.ok(visible.length >= 9, `${visible.length} questions on the page`);
    const marked = entry('FAQPage').mainEntity.map(item => {
        assert.equal(item['@type'], 'Question');
        assert.equal(item.acceptedAnswer['@type'], 'Answer');
        return { question: item.name, answer: textOf(item.acceptedAnswer.text) };
    });
    assert.deepEqual(marked, visible);
});

// --- The two files search engines ask for ------------------------------------------------------------------
test('robots.txt closes no part of the site and points at the sitemap', () => {
    assert.ok(exists('robots.txt'), 'robots.txt exists');
    const rules = read('robots.txt').split(/\r?\n/).map(line => line.replace(/#.*/, '').trim()).filter(Boolean);
    assert.ok(rules.some(rule => /^user-agent:\s*\*$/i.test(rule)), 'it speaks to every crawler');
    // The site has nothing private. One stray "Disallow: /" would take it out of Google.
    assert.deepEqual(rules.filter(rule => /^disallow:\s*\S/i.test(rule)), []);
    assert.ok(rules.includes('Sitemap: https://pixelmagix.shop/sitemap.xml'), 'the sitemap line');
});

test('the sitemap lists exactly the pages search engines may show, at their canonical addresses', () => {
    assert.ok(exists('sitemap.xml'), 'sitemap.xml exists');
    const xml = read('sitemap.xml');
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">[\s\S]*<\/urlset>\s*$/);
    const listed = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<\/url>/g)].map(match => match[1]);
    assert.ok(listedPages.length >= 2, `${listedPages.length} pages to list`);
    assert.deepEqual([...listed].sort(), listedPages.map(path => canonicalOf(read(path))).sort());
    // Every address is a file of the site (the home address is index.html).
    for (const address of listed) {
        const { origin, pathname } = new URL(address);
        assert.equal(origin, 'https://pixelmagix.shop');
        assert.ok(exists(pathname === '/' ? 'index.html' : pathname.slice(1)), address);
    }
});
