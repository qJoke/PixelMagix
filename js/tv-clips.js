// Short looping clips over the TV stills, so the "live" TV actually moves. The still always stays
// underneath: a clip fades in only once it is really playing, so a slow network, blocked autoplay
// or a load error simply leaves the still in place.

const SLOW_CONNECTIONS = new Set(['slow-2g', '2g', '3g']);

// Clips are an extra: skip them for visitors who asked for less motion or less data, or who are
// on a slow connection.
export function canPlayClips({ reducedMotion = false, saveData = false, effectiveType = '' } = {}) {
    return !reducedMotion && !saveData && !SLOW_CONNECTIONS.has(effectiveType);
}

const defaultCreateVideo = () => document.createElement('video');

// sources: { [category]: url }. One <video> per category, created the first time it is shown.
export function createTvClips(screen, sources, { createVideo = defaultCreateVideo, onBlocked } = {}) {
    const videos = new Map();
    const failed = new Set();
    let current = null;
    let userPaused = false;
    let offscreen = false;
    let disabled = false;

    const create = key => {
        const video = createVideo();
        video.className = 'tv__video';
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.loop = true;
        video.preload = 'auto';
        video.disablePictureInPicture = true;
        video.disableRemotePlayback = true;
        // iOS reads the attributes, not only the properties, when deciding about inline autoplay.
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('aria-hidden', 'true');
        video.addEventListener('playing', () => {
            if (key === current && !disabled && !failed.has(key)) video.classList.add('is-shown');
        });
        video.addEventListener('error', () => {
            failed.add(key);
            video.classList.remove('is-shown');
        });
        video.src = sources[key];
        screen.insertBefore(video, screen.querySelector('.tv__fx'));
        videos.set(key, video);
        return video;
    };

    const start = video => {
        const attempt = video.play();
        attempt?.catch?.(error => {
            // AbortError only means a pause() interrupted this play(); that is our own doing.
            if (error?.name === 'NotAllowedError' && video === videos.get(current)) onBlocked?.();
        });
    };

    const apply = () => {
        const video = videos.get(current);
        if (!video || disabled || failed.has(current)) return;
        if (userPaused || offscreen) video.pause();
        else start(video);
    };

    return {
        show(key) {
            if (disabled || !sources[key] || failed.has(key)) return;
            current = key;
            const video = videos.get(key) || create(key);
            video.currentTime = 0;
            if (!userPaused && !offscreen) start(video);
        },
        hide(key) {
            const video = videos.get(key);
            if (key === current) current = null;
            if (!video) return;
            video.pause();
            video.classList.remove('is-shown');
        },
        // The clip as a drawable picture (for the pixel dissolve), only while it is on screen.
        frame(key) {
            const video = videos.get(key);
            return video && video.classList.contains('is-shown') && video.readyState >= 2 ? video : null;
        },
        setPaused(flag) {
            userPaused = flag;
            apply();
        },
        setOffscreen(flag) {
            offscreen = flag;
            apply();
        },
        disable() {
            disabled = true;
            videos.forEach(video => {
                video.pause();
                video.classList.remove('is-shown');
            });
        }
    };
}
