# beacons-adsb-proxy

A small Cloudflare Worker that proxies [adsb.lol](https://api.adsb.lol/docs)'s live aircraft API and adds CORS headers, since adsb.lol doesn't send them itself — the static site (served from GitHub Pages) can't call it directly from browser JS otherwise. Used by the `/map` page's live traffic layer.

Deployed independently from the main site — this isn't part of the Astro build or GitHub Pages deploy.

## Local dev

```sh
npm install
npm run dev   # wrangler dev, http://127.0.0.1:8787
```

## Deploy

```sh
npm run deploy
```

Requires being logged in (`npx wrangler login`) to the Cloudflare account that owns `rk-0ne.workers.dev`.
