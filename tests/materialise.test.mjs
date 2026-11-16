import assert from 'node:assert/strict';
import { test } from 'node:test';
import { materialise } from '../js/materialise.js';

// A photo inside its card, and a document that hands out recording elements.
function fakePhoto() {
    const parent = {
        inserted: [],
        insertBefore(node, before) {
            this.inserted.push({ node, before });
            node.parentNode = this;
            return node;
        }
    };
    const img = { parentNode: parent, nextSibling: 'scrim' };
    return { parent, img };
}

const doc = {
    createElement: tag => ({
        tag,
        className: '',
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        remove() { this.removed = true; }
    })
};

// A dissolve double: records how it was made and played, and lets the test finish the effect.
function fakeMake() {
    const made = [];
    const make = (canvas, options) => {
        const entry = { canvas, options, played: null };
        made.push(entry);
        return {
            play: (from, to) => {
                entry.played = [from, to];
                return new Promise((resolve, reject) => Object.assign(entry, { resolve, reject }));
            }
        };
    };
    return { made, make };
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('a decorative canvas goes right after the photo and is covered in its card colour', () => {
    const { parent, img } = fakePhoto();
    const { made, make } = fakeMake();
    materialise(img, { doc, make, colourOf: () => 'rgb(11, 13, 43)' });
    const [{ node: canvas, before }] = parent.inserted;
    assert.equal(canvas.tag, 'canvas');
    assert.equal(before, 'scrim', 'placed right after the photo, under anything that sits on top of it');
    assert.equal(canvas.className, 'photo-fx');
    assert.equal(canvas.attributes['aria-hidden'], 'true');
    assert.equal(made.length, 1);
    assert.equal(made[0].canvas, canvas);
    assert.deepEqual(made[0].played, ['rgb(11, 13, 43)', img]);
});

test('the canvas leaves once the photo is shown', async () => {
    const { parent, img } = fakePhoto();
    const { made, make } = fakeMake();
    const done = materialise(img, { doc, make, colourOf: () => '#0b0d2b' });
    const canvas = parent.inserted[0].node;
    await settle();
    assert.equal(canvas.removed, undefined, 'still there while the photo builds up');
    made[0].resolve();
    await done;
    assert.equal(canvas.removed, true);
});

test('the canvas leaves even if the effect fails, and nothing is thrown', async () => {
    const { parent, img } = fakePhoto();
    const { made, make } = fakeMake();
    const done = materialise(img, { doc, make, colourOf: () => '#0b0d2b' });
    made[0].reject(new Error('no 2D context'));
    await done;
    assert.equal(parent.inserted[0].node.removed, true);
});

test('a photo that is not in the page is left alone', async () => {
    const { made, make } = fakeMake();
    await materialise({ parentNode: null }, { doc, make, colourOf: () => '#000' });
    await materialise(null, { doc, make, colourOf: () => '#000' });
    assert.equal(made.length, 0);
});

test('a dissolve that throws at once still leaves no canvas behind', async () => {
    const { parent, img } = fakePhoto();
    const make = () => { throw new Error('canvas unsupported'); };
    await materialise(img, { doc, make, colourOf: () => '#000' });
    assert.equal(parent.inserted[0].node.removed, true);
});
