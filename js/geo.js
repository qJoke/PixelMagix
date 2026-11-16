// Asks our Cloudflare Worker which country the visit comes from (only to show £ or €). Any
// problem, a slow answer included, simply means "unknown": the page then stays in €.

export function detectCountry({ fetchImpl = globalThis.fetch, timeout = 2500 } = {}) {
    if (typeof fetchImpl !== 'function') return Promise.resolve(null);
    const controller = typeof AbortController === 'function' ? new AbortController() : null;

    const request = (async () => {
        const response = await fetchImpl('/geo.json', {
            cache: 'no-store',
            credentials: 'omit',
            headers: { Accept: 'application/json' },
            signal: controller?.signal
        });
        if (!response?.ok) return null;
        const data = await response.json();
        const country = typeof data?.country === 'string' ? data.country.trim().toUpperCase() : '';
        return /^[A-Z]{2}$/.test(country) ? country : null;
    })().catch(() => null);

    // Race a timer as well, so a fetch that ignores the abort signal cannot hold the page.
    let timer;
    const expired = new Promise(resolve => {
        timer = setTimeout(() => {
            controller?.abort();
            resolve(null);
        }, timeout);
    });
    return Promise.race([request, expired]).finally(() => clearTimeout(timer));
}
