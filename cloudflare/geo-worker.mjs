const jsonHeaders = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
};

export default {
    async fetch(request) {
        const url = new URL(request.url);

        if (url.pathname !== '/geo.json') {
            return new Response('Not found', {
                status: 404,
                headers: {
                    'cache-control': 'no-store',
                    'x-content-type-options': 'nosniff'
                }
            });
        }

        const rawCountry = typeof request.cf?.country === 'string' ? request.cf.country.trim().toUpperCase() : '';
        const country = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : null;

        return new Response(JSON.stringify({ country }), {
            headers: jsonHeaders
        });
    }
};
