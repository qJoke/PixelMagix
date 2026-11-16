import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canPlayClips, createTvClips } from '../js/tv-clips.js';

// Browser doubles: a screen that records inserted nodes and a video that records calls.
function fakeScreen() {
    const fx = { name: 'canvas.tv__fx' };
    const children = [{ name: 'img' }, fx];
    return {
        children,
        fx,
        querySelector: selector => (selector === '.tv__fx' ? fx : null),
        insertBefore(node, reference) {
            const index = children.indexOf(reference);
            children.splice(index < 0 ? children.length : index, 0, node);
        }
    };
}

function fakeVideo() {
    const listeners = {};
    const classes = new Set();
    return {
        attributes: {},
        classes,
        plays: 0,
        pauses: 0,
        paused: true,
        readyState: 0,
        currentTime: 0,
        playResult: undefined,
        classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(type, listener) { (listeners[type] ||= []).push(listener); },
        emit(type) { (listeners[type] || []).forEach(listener => listener({ type })); },
        play() {
            this.plays += 1;
            this.paused = false;
            return this.playResult ?? Promise.resolve();
        },
        pause() {
            this.pauses += 1;
            this.paused = true;
        }
    };
}

function setup(options = {}) {
    const screen = fakeScreen();
    const made = [];
    const createVideo = () => {
        const video = fakeVideo();
        made.push(video);
        return video;
    };
    const sources = { sport: 'video/tv-sport-960.mp4', stiri: 'video/tv-stiri-960.mp4' };
    const clips = createTvClips(screen, sources, { createVideo, ...options });
    return { screen, made, clips };
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('clips are allowed on a normal connection', () => {
    assert.equal(canPlayClips({}), true);
    assert.equal(canPlayClips({ effectiveType: '4g' }), true);
});

test('clips are refused with reduced motion, data saver or a slow connection', () => {
    assert.equal(canPlayClips({ reducedMotion: true }), false);
    assert.equal(canPlayClips({ saveData: true }), false);
    for (const effectiveType of ['slow-2g', '2g', '3g']) assert.equal(canPlayClips({ effectiveType }), false, effectiveType);
});

test('show creates one muted, inline, looping clip under the effects canvas and plays it', () => {
    const { screen, made, clips } = setup();
    clips.show('sport');
    assert.equal(made.length, 1);
    const [video] = made;
    assert.equal(video.src, 'video/tv-sport-960.mp4');
    assert.equal(video.muted, true);
    assert.equal(video.defaultMuted, true);
    assert.equal(video.playsInline, true);
    assert.equal(video.loop, true);
    assert.equal(video.preload, 'auto');
    assert.equal(video.attributes['aria-hidden'], 'true');
    assert.equal(video.attributes.playsinline, '');
    assert.equal(video.attributes.muted, '');
    assert.equal(video.className, 'tv__video');
    assert.equal(screen.children.indexOf(video), screen.children.indexOf(screen.fx) - 1);
    assert.equal(video.plays, 1);
});

test('a clip becomes visible only once it is really playing', () => {
    const { made, clips } = setup();
    clips.show('sport');
    assert.equal(made[0].classes.has('is-shown'), false);
    made[0].emit('playing');
    assert.equal(made[0].classes.has('is-shown'), true);
});

test('a late "playing" from a clip the visitor already left does not show it', () => {
    const { made, clips } = setup();
    clips.show('sport');
    clips.hide('sport');
    clips.show('stiri');
    made[0].emit('playing');
    assert.equal(made[0].classes.has('is-shown'), false);
});

test('hide pauses the clip and takes it out of view', () => {
    const { made, clips } = setup();
    clips.show('sport');
    made[0].emit('playing');
    clips.hide('sport');
    assert.equal(made[0].paused, true);
    assert.equal(made[0].classes.has('is-shown'), false);
});

test('showing a category again restarts its clip from the start and reuses the element', () => {
    const { made, clips } = setup();
    clips.show('sport');
    made[0].currentTime = 4.2;
    clips.hide('sport');
    clips.show('sport');
    assert.equal(made.length, 1);
    assert.equal(made[0].currentTime, 0);
    assert.equal(made[0].plays, 2);
});

test('a visitor pause freezes the current frame; resuming plays again', () => {
    const { made, clips } = setup();
    clips.show('sport');
    made[0].emit('playing');
    clips.setPaused(true);
    assert.equal(made[0].paused, true);
    assert.equal(made[0].classes.has('is-shown'), true);
    clips.setPaused(false);
    assert.equal(made[0].paused, false);
    assert.equal(made[0].plays, 2);
});

test('off screen the clip pauses, and it resumes on screen unless the visitor paused it', () => {
    const { made, clips } = setup();
    clips.show('sport');
    clips.setOffscreen(true);
    assert.equal(made[0].paused, true);
    clips.setOffscreen(false);
    assert.equal(made[0].paused, false);
    clips.setPaused(true);
    clips.setOffscreen(true);
    clips.setOffscreen(false);
    assert.equal(made[0].paused, true);
});

test('a clip shown while off screen or paused waits instead of playing', () => {
    const { made, clips } = setup();
    clips.setOffscreen(true);
    clips.show('sport');
    assert.equal(made[0].plays, 0);
    clips.setOffscreen(false);
    assert.equal(made[0].plays, 1);
});

test('blocked autoplay is reported and shows nothing; an interrupted play is not reported', async () => {
    let blocked = 0;
    const { made, clips } = setup({ onBlocked: () => { blocked += 1; } });
    clips.show('sport');
    made[0].playResult = Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
    clips.setPaused(false);
    await settle();
    assert.equal(blocked, 1);
    assert.equal(made[0].classes.has('is-shown'), false);
    made[0].playResult = Promise.reject(Object.assign(new Error('interrupted'), { name: 'AbortError' }));
    clips.setPaused(false);
    await settle();
    assert.equal(blocked, 1);
});

test('frame() offers the clip only while it is shown with a decoded frame', () => {
    const { made, clips } = setup();
    clips.show('sport');
    assert.equal(clips.frame('sport'), null);
    made[0].emit('playing');
    made[0].readyState = 1;
    assert.equal(clips.frame('sport'), null);
    made[0].readyState = 2;
    assert.equal(clips.frame('sport'), made[0]);
    assert.equal(clips.frame('stiri'), null);
});

test('a clip that fails to load is never shown again', () => {
    const { made, clips } = setup();
    clips.show('sport');
    made[0].emit('error');
    clips.hide('sport');
    clips.show('sport');
    assert.equal(made[0].plays, 1);
    made[0].emit('playing');
    assert.equal(made[0].classes.has('is-shown'), false);
});

test('disable stops and hides every clip, and nothing starts afterwards', () => {
    const { made, clips } = setup();
    clips.show('sport');
    made[0].emit('playing');
    clips.disable();
    assert.equal(made[0].paused, true);
    assert.equal(made[0].classes.has('is-shown'), false);
    clips.show('stiri');
    assert.equal(made.length, 1);
});

test('a category without a clip is ignored', () => {
    const { made, clips } = setup();
    clips.show('filme');
    assert.equal(made.length, 0);
    assert.equal(clips.frame('filme'), null);
});
