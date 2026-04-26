# Cloudflare geo endpoint

This Worker provides the same-origin currency signal used by the website.

## Route

Configure the Worker on this exact route:

```text
pixelmagix.shop/geo.json
```

The main site can stay on GitHub Pages. Only `/geo.json` needs to be served by Cloudflare Workers.

## Response

```json
{ "country": "GB" }
```

The website shows GBP only when `country` is `GB`. Any other response or failure keeps EUR.

## Deploy outline

1. Add `pixelmagix.shop` to Cloudflare and point the domain nameservers to Cloudflare.
2. Keep the DNS records for GitHub Pages active and proxied through Cloudflare.
3. Deploy `geo-worker.mjs` as a Cloudflare Worker.
4. Use `wrangler.example.jsonc` as a starting point for the Worker route config.
