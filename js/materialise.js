// Photos build up from pixels the first time they appear, like the TV in the first screen: a canvas in the
// card's colour (set in CSS) covers the photo, then lifts tile by tile. Called when the card is revealed, so
// the cover is in place before the card's first visible frame. Without JavaScript, with reduced motion or
// on any problem, the photo is simply shown.
import { createDissolve } from './pixel-dissolve.js';

export function materialise(img, {
    doc = document,
    make = createDissolve,
    colourOf = element => getComputedStyle(element).color
} = {}) {
    const parent = img?.parentNode;
    if (!parent) return Promise.resolve();
    const canvas = doc.createElement('canvas');
    canvas.className = 'photo-fx';
    canvas.setAttribute('aria-hidden', 'true');
    parent.insertBefore(canvas, img.nextSibling);
    let effect;
    try {
        // Synchronous on purpose: the cover is painted in this same task, before the card is ever shown.
        effect = make(canvas, { tile: 20, duration: 900, decodeTimeout: 4000 }).play(colourOf(canvas), img);
    } catch (error) {
        effect = Promise.reject(error);
    }
    const done = () => canvas.remove();
    return Promise.resolve(effect).then(done, done);
}
