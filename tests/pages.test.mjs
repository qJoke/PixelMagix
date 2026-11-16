import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { test } from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('internal folders are kept off the public site', () => {
    assert.ok(existsSync(new URL('../_config.yml', import.meta.url)), '_config.yml exists');
    const config = read('_config.yml');
    const excluded = config.split('exclude:')[1] ?? '';
    for (const entry of ['tests/', 'cloudflare/', '"*.md"']) assert.ok(excluded.includes(`- ${entry}`), entry);
});

test('the privacy page matches what the site does now', () => {
    const page = read('politica-de-confidentialitate.html');
    const text = page.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    for (const gone of [/EmailJS/i, /newsletter/i, /Google Fonts/i, /formular/i, /fonts\.googleapis/, /nu folosește cookie-uri de urmărire/, /nu le dăm altcuiva/]) {
        assert.doesNotMatch(page, gone);
    }
    for (const present of ['WhatsApp', 'Messenger', 'Cloudflare', 'pixelmagixtv@gmail.com', 'Ultima actualizare: 14 noiembrie 2026']) {
        assert.ok(text.includes(present), present);
    }
    assert.match(page, /<link rel="stylesheet" href="style\.css[^"]*">/);
    assert.doesNotMatch(page, /<script/i);
});

test('the privacy page explains the trackers: what, why, how long, and how to withdraw consent', () => {
    const page = read('politica-de-confidentialitate.html');
    const text = page.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    for (const present of [
        'doar dacă ești de acord',
        'Google Analytics', 'Google Ireland Limited', '_ga', '2 ani',
        'Meta Pixel', 'Meta Platforms Ireland Limited', '_fbp', '_fbc', '90 de zile',
        'pixelmagix-consent', '6 luni',
        'Setări cookie', 'ștergem cookie-urile',
        'Cod: FB-IT-1'
    ]) {
        assert.ok(text.includes(present), present);
    }
    // The settings open straight from here: the home page reads #setari-cookie.
    assert.match(page, /href="index\.html#setari-cookie"/);
    assert.match(page, /<meta name="description"\s+content="[^"]*cookie/);
});

test('the share image is the new one', () => {
    const html = read('index.html');
    const meta = name => html.match(new RegExp(`<meta (?:property|name)="${name}" content="([^"]+)"`))?.[1];
    assert.equal(meta('og:image'), 'https://pixelmagix.shop/img/og-pixelmagix.jpg');
    assert.equal(meta('twitter:image'), 'https://pixelmagix.shop/img/og-pixelmagix.jpg');
    assert.equal(meta('og:image:width'), '1200');
    assert.equal(meta('og:image:height'), '630');
    assert.ok(meta('og:image:alt'), 'og:image:alt is set');
    const file = new URL('../img/og-pixelmagix.jpg', import.meta.url);
    assert.ok(existsSync(file), 'img/og-pixelmagix.jpg exists');
    assert.ok(statSync(file).size <= 150 * 1024, `${Math.round(statSync(file).size / 1024)} KB`);
});

test('home <-> privacy page navigations use a view transition where the browser supports it', () => {
    const css = read('style.css');
    // Opted in only when motion is welcome; ignored by browsers without cross-document view transitions.
    assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\s*@view-transition \{\s*navigation: auto;\s*\}/);
    // The floating header bar and the brand morph from one page into the other.
    assert.match(css, /\.site-header__bar,\s*\.legal-header__bar \{\s*view-transition-name: site-header;/);
    assert.match(css, /\.site-header \.brand,\s*\.legal-header \.brand \{\s*view-transition-name: brand;/);
    // A name may appear once per page: one brand inside each page's header.
    for (const [page, header] of [['index.html', 'site-header'], ['politica-de-confidentialitate.html', 'legal-header']]) {
        const html = read(page);
        assert.match(html, /<link rel="stylesheet" href="style\.css[^"]*">/);
        const block = html.slice(html.indexOf(`<header class="${header}"`), html.indexOf('</header>'));
        assert.equal((block.match(/class="brand"/g) || []).length, 1, page);
    }
});

test('no page explains who pays in pounds and who in euros', () => {
    // The owner's decision (14 Nov 2026): visitors from GB still see £ prices, but no text on the site explains the split.
    for (const path of ['index.html', 'politica-de-confidentialitate.html', '404.html']) {
        assert.doesNotMatch(read(path), /£|\blir[ae]\b|\bliră|\bsterlin|\beuro\b|\bGBP\b/i, path);
    }
});

test('a wrong address gets the site\'s own page, and it works from any folder depth', () => {
    assert.ok(existsSync(new URL('../404.html', import.meta.url)), '404.html exists (GitHub Pages serves it for every missing address)');
    const page = read('404.html');
    assert.match(page, /<html lang="ro">/);
    assert.equal((page.match(/<h1\b/g) || []).length, 1);
    // Not a page for search results, and no code: it has to work under the same policy as the others.
    assert.match(page, /<meta name="robots" content="noindex">/);
    assert.doesNotMatch(page, /rel="canonical"|<script/i);
    // GitHub Pages serves this file at the wrong address itself (/a/b/c), where "style.css" would mean
    // /a/b/style.css. So everything the page loads or links to starts at the root, and exists.
    const addresses = [
        ...[...page.matchAll(/\s(?:href|src)="([^"]+)"/g)].map(match => match[1]),
        ...[...page.matchAll(/\ssrcset="([^"]+)"/g)].flatMap(match => match[1].split(',').map(part => part.trim().split(/\s+/)[0]))
    ];
    const local = addresses.filter(address => !/^(https:|mailto:|#)/.test(address));
    assert.ok(local.length >= 6, `${local.length} local addresses`);
    for (const address of local) {
        assert.ok(address.startsWith('/'), `${address} starts at the root`);
        const file = address === '/' ? 'index.html' : address.slice(1).split(/[?#]/)[0];
        assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${address} exists`);
    }
    assert.ok(local.includes('/'), 'it leads back to the home page');
});

test('both pages use the hat icon made for small sizes (ICO 16/32/48 for tabs, 180 px for phones)', () => {
    for (const path of ['index.html', 'politica-de-confidentialitate.html']) {
        const page = read(path);
        assert.match(page, /<link rel="icon" href="favicon.ico" sizes="16x16 32x32 48x48">/, path);
        assert.match(page, /<link rel="apple-touch-icon" href="apple-touch-icon.png">/, path);
        assert.doesNotMatch(page, /Pixel%20Magix.webp/, path);
    }
    // ICO header: reserved 0, type 1, image count, then one 16-byte entry per image starting with its width.
    const ico = readFileSync(new URL('../favicon.ico', import.meta.url));
    assert.equal(ico.readUInt16LE(2), 1, 'an icon file');
    const widths = Array.from({ length: ico.readUInt16LE(4) }, (_, index) => ico[6 + index * 16]).sort((a, b) => a - b);
    assert.deepEqual(widths, [16, 32, 48]);
    // iPhones round the corners themselves and paint see-through parts black, so this one is an opaque square.
    const touch = readFileSync(new URL('../apple-touch-icon.png', import.meta.url));
    assert.deepEqual([touch.readUInt32BE(16), touch.readUInt32BE(20)], [180, 180]);
    assert.equal(touch[25], 2, 'RGB without transparency');
    for (const path of ['favicon.ico', 'apple-touch-icon.png']) {
        assert.ok(statSync(new URL(`../${path}`, import.meta.url)).size < 40 * 1024, `${path} stays light`);
    }
});

// Decodes an 8-bit RGBA, non-interlaced PNG (what Pillow writes inside the .ico) and returns its alpha channel.
function pngAlpha(png) {
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    assert.deepEqual([png[24], png[25], png[28]], [8, 6, 0], '8-bit RGBA, not interlaced');
    const parts = [];
    for (let offset = 8; offset < png.length; offset += 12 + png.readUInt32BE(offset)) {
        if (png.toString('latin1', offset + 4, offset + 8) === 'IDAT') parts.push(png.subarray(offset + 8, offset + 8 + png.readUInt32BE(offset)));
    }
    const raw = inflateSync(Buffer.concat(parts));
    const stride = width * 4;
    const pixels = Buffer.alloc(stride * height);
    for (let y = 0; y < height; y += 1) {
        const filter = raw[y * (stride + 1)];
        for (let i = 0; i < stride; i += 1) {
            const left = i >= 4 ? pixels[y * stride + i - 4] : 0;
            const up = y > 0 ? pixels[(y - 1) * stride + i] : 0;
            const upLeft = i >= 4 && y > 0 ? pixels[(y - 1) * stride + i - 4] : 0;
            const guess = left + up - upLeft;
            const near = [left, up, upLeft].map(value => Math.abs(guess - value));
            const paeth = near[0] <= near[1] && near[0] <= near[2] ? left : near[1] <= near[2] ? up : upLeft;
            pixels[y * stride + i] = (raw[y * (stride + 1) + 1 + i] + [0, left, up, (left + up) >> 1, paeth][filter]) & 255;
        }
    }
    return { width, height, at: (x, y) => pixels[(y * width + x) * 4 + 3] };
}

test('the tab icon is just the hat, with nothing behind it (as the owner chose on 15 Nov 2026)', () => {
    const ico = readFileSync(new URL('../favicon.ico', import.meta.url));
    for (let index = 0; index < ico.readUInt16LE(4); index += 1) {
        const entry = 6 + index * 16;
        const start = ico.readUInt32LE(entry + 12);
        const { width, height, at } = pngAlpha(ico.subarray(start, start + ico.readUInt32LE(entry + 8)));
        // Above the hat the icon is see-through: no tile or frame around it.
        for (const x of [0, width >> 1, width - 1]) assert.ok(at(x, 0) <= 8, `${width}px: top edge at x=${x} is see-through`);
        // The hat itself is solid enough to read at this size.
        let solid = 0;
        for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) if (at(x, y) > 200) solid += 1;
        assert.ok(solid / (width * height) > 0.12, `${width}px: the hat covers ${Math.round((solid / (width * height)) * 100)}%`);
    }
});
