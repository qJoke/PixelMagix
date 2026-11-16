// Local-only static preview through the Cloudflare Worker, with its final (strictest) CSP: a page that works
// here also works under the transition policy, which only adds the old site's hosts.
// Run: node tests/preview.mjs [port]   (default 5188; no upload; listens on loopback only)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { finalContentSecurityPolicy, handleRequest } from '../cloudflare/geo-worker.mjs';

const root = new URL('../', import.meta.url);
const types = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', webp: 'image/webp', png: 'image/png', ico: 'image/x-icon', jpg: 'image/jpeg', svg: 'image/svg+xml', woff2: 'font/woff2', txt: 'text/plain; charset=utf-8', xml: 'application/xml; charset=utf-8', mp4: 'video/mp4' };
const pages = new Set(['index.html', 'politica-de-confidentialitate.html', '404.html', 'style.css', 'script.js', 'robots.txt', 'sitemap.xml']);
// Like GitHub Pages: a wrong address gets 404.html, with status 404, whatever its folder depth.
const notFound = async () => new Response(await readFile(fileURLToPath(new URL('404.html', root))), { status: 404, headers: { 'Content-Type': types.html, 'Cache-Control': 'no-store' } });
// One level of public asset folders; names restricted so no traversal or dotfiles can match.
const nestedAsset = /^(js|img|fonts|video)\/[A-Za-z0-9-]+\.(js|webp|svg|woff2|txt|mp4)$/;
const rootAsset = /^[^./\\][^/\\]*\.(webp|png|jpg|svg|ico)$/;
const server = createServer(async (req, res) => {
    try {
        const path = new URL(req.url, 'http://localhost').pathname;
        const filename = decodeURIComponent(path === '/' ? 'index.html' : path.slice(1));
        const extension = filename.split('.').pop();
        const request = new Request(`https://pixelmagix.shop${req.url}`, { method: req.method });
        const result = await handleRequest(request, async () => {
            if (!['GET', 'HEAD'].includes(req.method)) return new Response('Method not allowed', { status: 405 });
            if (!pages.has(filename) && !nestedAsset.test(filename) && !rootAsset.test(filename)) return notFound();
            try {
                const data = await readFile(fileURLToPath(new URL(filename.split('/').map(encodeURIComponent).join('/'), root)));
                return new Response(req.method === 'HEAD' ? null : data, { headers: { 'Content-Type': types[extension], 'Cache-Control': 'no-store' } });
            } catch { return notFound(); }
        }, { contentSecurityPolicy: finalContentSecurityPolicy });
        res.writeHead(result.status, Object.fromEntries(result.headers));
        res.end(Buffer.from(await result.arrayBuffer()));
    } catch { res.writeHead(400); res.end('Bad request'); }
});
const port = Number(process.argv[2] || process.env.PORT) || 5188;
server.listen(port, '127.0.0.1', () => console.log(`PixelMagix preview: http://127.0.0.1:${port}/`));
