// Content Security Policy for the HTML pages. Keep it in sync with what index.html and js/ load.
// The new site loads its own files, plus Meta Pixel and Google Analytics 4 (js/trackers.js), and those only
// after the visitor's consent. Inline styles stay allowed; inline or injected scripts never are.
const META_SCRIPT = 'https://connect.facebook.net';
const META_EVENTS = 'https://www.facebook.com';
const GOOGLE_TAG = 'https://www.googletagmanager.com';
const GA_COLLECT = 'https://*.google-analytics.com';

const sitePolicy = [
    ['default-src', ["'self'"]],
    ['base-uri', ["'none'"]],
    ['object-src', ["'none'"]],
    ['frame-ancestors', ["'none'"]],
    ['form-action', ["'none'"]],
    ['script-src', ["'self'", META_SCRIPT, GOOGLE_TAG]],
    ['script-src-attr', ["'none'"]],
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['font-src', ["'self'"]],
    ['img-src', ["'self'", 'data:', META_EVENTS, GOOGLE_TAG, GA_COLLECT]],
    ['connect-src', ["'self'", META_EVENTS, GOOGLE_TAG, GA_COLLECT, 'https://analytics.google.com', 'https://*.analytics.google.com']],
    ['frame-src', ["'none'"]],
    ['worker-src', ["'none'"]],
    ['upgrade-insecure-requests', []]
];

// What the old site (live until 17 Nov 2026) loaded from other hosts: AOS, EmailJS, intl-tel-input,
// Font Awesome, Google Fonts, posters and trailers. Only the transition policy uses them; remove the list
// once a rollback to the old site is no longer wanted.
const legacySources = {
    'script-src': [
        'https://cdn.jsdelivr.net/npm/aos@2.3.1/dist/aos.js',
        'https://cdn.jsdelivr.net/npm/@emailjs/browser@4.4.1/dist/email.min.js',
        'https://cdn.jsdelivr.net/npm/intl-tel-input@25.12.4/build/js/intlTelInput.min.js',
        'https://cdn.jsdelivr.net/npm/intl-tel-input@25.12.4/build/js/utils.js'
    ],
    'style-src': [
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net/npm/aos@2.3.1/dist/aos.css',
        'https://cdn.jsdelivr.net/npm/intl-tel-input@25.12.4/build/css/intlTelInput.css',
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css'
    ],
    'font-src': ['https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/webfonts/'],
    'img-src': ['https://image.tmdb.org', 'https://images.unsplash.com', 'https://upload.wikimedia.org', 'https://cdn.jsdelivr.net/npm/intl-tel-input@25.12.4/build/img/'],
    'connect-src': ['https://api.emailjs.com'],
    'frame-src': ['https://www.youtube.com']
};

const serialize = policy => policy.map(([name, sources]) => [name, ...sources].join(' ')).join('; ');
// 'none' must stand alone, so it gives way when the old site adds a source to the same directive.
const withLegacy = policy => policy.map(([name, sources]) => {
    const extra = legacySources[name] ?? [];
    return [name, extra.length ? [...sources.filter(source => source !== "'none'"), ...extra] : sources];
});

export const finalContentSecurityPolicy = serialize(sitePolicy);
export const transitionContentSecurityPolicy = serialize(withLegacy(sitePolicy));

// The new site has been live since 17 Nov 2026, so the Worker sends the final policy. 'transition' (the final
// policy plus the hosts the old site loaded) stays only so that a rollback to the old site is one word away.
export const CSP_STAGE = 'final';
export const pageContentSecurityPolicy = CSP_STAGE === 'final' ? finalContentSecurityPolicy : transitionContentSecurityPolicy;

const securityHeaders = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    // Start with one day on the verified HTTPS apex. No subdomain/preload claim.
    'strict-transport-security': 'max-age=86400'
};

const jsonHeaders = {
    ...securityHeaders,
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
};

function localResponse(request, body, status = 200, extraHeaders = {}) {
    return new Response(request.method === 'HEAD' ? null : JSON.stringify(body), {
        status,
        headers: { ...jsonHeaders, ...extraHeaders }
    });
}

// `contentSecurityPolicy` is for the local preview (tests/preview.mjs), which checks the strictest policy.
export async function handleRequest(request, fetchOrigin = globalThis.fetch, { contentSecurityPolicy = pageContentSecurityPolicy } = {}) {
    const url = new URL(request.url);

    // This is an origin wrapper for the configured apex, never an open proxy.
    if (url.hostname !== 'pixelmagix.shop') {
        return localResponse(request, { error: 'Not found' }, 404);
    }

    if (url.protocol === 'http:') {
        url.protocol = 'https:';
        return new Response(null, {
            status: 308,
            headers: { ...securityHeaders, location: url.toString() }
        });
    }

    if (url.pathname === '/geo.json') {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return localResponse(request, { error: 'Method not allowed' }, 405, { allow: 'GET, HEAD' });
        }

        // Cloudflare metadata is trusted; caller-supplied headers/query/body are not.
        const rawCountry = typeof request.cf?.country === 'string' ? request.cf.country.trim().toUpperCase() : '';
        const country = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : null;
        return localResponse(request, { country });
    }

    try {
        // A routed Worker can fetch its existing GitHub Pages origin directly.
        // Preserve redirect responses instead of following a different origin.
        const originResponse = await fetchOrigin(new Request(request, { redirect: 'manual' }));
        const headers = new Headers(originResponse.headers);
        for (const [name, value] of Object.entries(securityHeaders)) {
            if (!headers.has(name)) headers.set(name, value);
        }
        const contentType = headers.get('content-type') || '';
        if (/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(contentType)) {
            // A future origin policy is retained; browsers enforce both policies.
            headers.append('content-security-policy', contentSecurityPolicy);
        }

        return new Response(originResponse.body, {
            status: originResponse.status,
            statusText: originResponse.statusText,
            headers
        });
    } catch {
        // Never return origin errors, request headers or form data to the client.
        return localResponse(request, { error: 'Temporarily unavailable' }, 502);
    }
}

export default {
    async fetch(request) {
        return handleRequest(request);
    }
};
