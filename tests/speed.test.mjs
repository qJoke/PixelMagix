// What keeps the first screen fast. Each rule here was measured with Lighthouse on 15 Nov 2026
// (planuri/unelte/viteza): breaking one costs layout work before the first paint, or a busy main thread after it.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = read('style.css');
const pages = readdirSync(new URL('../', import.meta.url)).filter(name => name.endsWith('.html'));

// Every @font-face: its file and the characters it holds.
const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => ({
    file: body.match(/url\('([^']+)'\)/)[1],
    ranges: body.match(/unicode-range:\s*([^;]+);/)[1].split(',').map(part => {
        const [from, to = from] = part.trim().replace(/^U\+/i, '').split('-');
        return [parseInt(from, 16), parseInt(to, 16)];
    })
}));
const holds = (face, char) => face.ranges.some(([from, to]) => char.codePointAt(0) >= from && char.codePointAt(0) <= to);
const visibleText = html => html.slice(html.indexOf('<body'))
    .replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

test('every font file a page needs for its text is requested in the head, not found during the first layout', () => {
    // ă, ș and ț live in the "latin-ext" files. Found only while laying out the text, they arrived late and the
    // whole page was laid out again once or twice (174 ms of layout before the first paint instead of 88).
    assert.equal(faces.length, 4, 'two families, each in two files');
    for (const path of pages) {
        const html = read(path);
        const head = html.slice(0, html.indexOf('</head>'));
        const letters = [...new Set(visibleText(html))].filter(char => char.trim());
        for (const face of faces) {
            const needed = letters.filter(char => holds(face, char));
            if (!needed.length) continue;
            const preload = new RegExp(`<link rel="preload" href="/?${face.file.replaceAll('.', '\\.')}" as="font" type="font/woff2" crossorigin>`);
            assert.match(head, preload, `${path} shows ${needed.slice(0, 5).join(' ')} from ${face.file}`);
        }
    }
});

// --- Animations that never end ---------------------------------------------------------------------------
// The stylesheet as a flat list of rules, each with the @media/@supports blocks it sits in.
function rulesOf(source) {
    const rules = [];
    const walk = (block, media) => {
        let at = 0;
        while (at < block.length) {
            const open = block.indexOf('{', at);
            if (open < 0) break;
            const prelude = block.slice(at, open).trim().replace(/\s+/g, ' ');
            let depth = 1;
            let end = open + 1;
            for (; end < block.length && depth; end += 1) depth += block[end] === '{' ? 1 : block[end] === '}' ? -1 : 0;
            const body = block.slice(open + 1, end - 1);
            if (/^@(media|supports)\b/.test(prelude)) walk(body, [...media, prelude]);
            else if (prelude.startsWith('@keyframes ')) rules.push({ keyframes: prelude.split(' ')[1], body });
            else if (!prelude.startsWith('@')) rules.push({ selector: prelude, body, media });
            at = end;
        }
    };
    walk(source.replace(/\/\*[\s\S]*?\*\//g, ''), []);
    return rules;
}
const rules = rulesOf(css);
const animated = Object.fromEntries(rules.filter(rule => rule.keyframes)
    .map(rule => [rule.keyframes, [...new Set([...rule.body.matchAll(/([\w-]+)\s*:/g)].map(match => match[1]))]]));
const endless = rules.filter(rule => rule.selector && /animation:[^;]*\binfinite\b/.test(rule.body))
    .map(rule => ({ ...rule, name: rule.body.match(/animation:\s*([\w-]+)/)[1] }));

test('animations that never end move only what the compositor can move: transform and opacity', () => {
    // Anything else is recalculated and repainted on the main thread, on every frame, for as long as the page is
    // open. The LIVE dot (box-shadow) and the button shine (background-position) kept the main thread about 41% busy
    // after the first paint; with them off it was 15%.
    assert.ok(endless.length >= 10, `${endless.length} endless animations found`);
    // The one exception: gradient text cannot be moved by the compositor, so it flows on large screens only.
    const largeScreensOnly = ['grad-flow'];
    for (const { selector, name, media } of endless) {
        assert.ok(animated[name], `@keyframes ${name} exists`);
        if (largeScreensOnly.includes(name)) {
            assert.ok(media.some(query => /min-width:\s*1024px/.test(query)), `${name} on ${selector} runs only from 1024px up`);
            continue;
        }
        assert.deepEqual(animated[name].filter(property => property !== 'transform' && property !== 'opacity'), [], `${name} on ${selector}`);
    }
});

test('the pause button stops every animation that never ends', () => {
    const pause = rules.find(rule => rule.selector?.startsWith('html.motion-paused ') && /animation-play-state:\s*paused/.test(rule.body));
    assert.ok(pause, 'the html.motion-paused rule exists');
    const stopped = pause.selector.split(',').map(part => part.trim().replace(/^html\.motion-paused /, ''));
    for (const { selector, name } of endless) {
        for (const part of selector.split(',').map(piece => piece.trim())) {
            // ".hero__title .grad" stops through ".grad", ".aurora__wave:nth-child(1)" through ".aurora__wave".
            const covered = stopped.some(target => part === target || part.endsWith(` ${target}`) || part.startsWith(`${target}:nth-child(`));
            assert.ok(covered, `${name} on ${part} is stopped by the pause button`);
        }
    }
});

test('every large main button keeps its label in one <span>, where its hover sparkle hangs', () => {
    // The button's own ::before is its gloss and its ::after the shine, so the sparkle of the large buttons sits
    // on the label's ::after. A large main button without that <span> would silently lose the sparkle.
    assert.ok(rules.some(rule => rule.selector === '.btn--primary.btn--lg > span::after'), 'the sparkle rule');
    let large = 0;
    for (const path of pages) {
        for (const [, attributes, inner] of read(path).matchAll(/<(?:a|button)\b([^>]*\bbtn--primary\b[^>]*)>([\s\S]*?)<\/(?:a|button)>/g)) {
            if (!/\bbtn--lg\b/.test(attributes)) continue;
            large += 1;
            // Direct children only: the icon is an <svg> with a <use> inside.
            const children = [...inner.replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>').matchAll(/<(\w+)/g)].map(match => match[1]);
            assert.equal(children.filter(tag => tag === 'span').length, 1, `${path}: ${inner.replace(/\s+/g, ' ').slice(0, 80)}`);
        }
    }
    assert.ok(large >= 5, `${large} large main buttons`);
});
