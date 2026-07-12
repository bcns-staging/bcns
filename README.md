# 7 Beacons

Landing page for [www.7beacons.com](https://www.7beacons.com), built with [Astro](https://astro.build) and deployed to GitHub Pages.

## Project structure

```text
/
├── public/
│   └── CNAME              # custom domain for GitHub Pages
├── src/
│   ├── components/        # Header, Hero, Footer
│   ├── layouts/           # Layout.astro (HTML shell, meta, CSP)
│   ├── styles/            # global.css
│   └── pages/
│       └── index.astro
├── Dockerfile              # multi-stage: build with Node, serve with nginx
├── docker-compose.yml       # `dev` (hot reload) and `prod` (nginx, prod-like) services
└── .github/workflows/
    ├── ci.yml               # runs on PRs: typecheck, build, uploads preview artifact
    └── deploy.yml            # runs on push to main: build, deploy to GitHub Pages
```

## Local development

Without Docker:

```sh
npm install
npm run dev        # http://localhost:4321
```

With Docker (no local Node install needed):

```sh
docker compose up dev            # hot reload at http://localhost:4321
docker compose up --build prod   # prod-like build served by nginx at http://localhost:8080
```

The `prod` service builds and serves the exact static output GitHub Pages will serve, so it's the best way to sanity-check a change before it ships.

## Commands

| Command          | Action                                    |
| :--------------- | :----------------------------------------- |
| `npm install`     | Install dependencies                       |
| `npm run dev`      | Start local dev server at `localhost:4321` |
| `npm run check`    | Type-check the project                     |
| `npm run build`     | Build production site to `./dist/`         |
| `npm run preview`    | Preview the build locally                  |

## Deployment pipeline

1. **Open a PR** against `main`. The `CI` workflow type-checks and builds the site, and uploads the build as a downloadable artifact (`site-preview`) so it can be reviewed before merging.
2. **Merge to `main`**. The `Deploy to GitHub Pages` workflow rebuilds the site and deploys it to GitHub Pages.
3. Optional manual gate: add required reviewers on the `github-pages` environment (repo Settings → Environments) so a deploy to production needs an explicit approval after CI passes and before it goes live.

### One-time repo setup (do this once in GitHub)

- Settings → Pages → Build and deployment → Source: **GitHub Actions**.
- Settings → Pages → Custom domain: `www.7beacons.com` (this also gets committed via `public/CNAME`), then enable **Enforce HTTPS** once the certificate is issued.
- DNS at your registrar (Namecheap):
  - `CNAME` record: host `www` → `bcns-staging.github.io`
  - Apex `7beacons.com` → redirect to `https://www.7beacons.com` (Namecheap's "URL Redirect Record", since GitHub recommends the `www` subdomain as the canonical domain for Pages)
