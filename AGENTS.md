# 7 Beacons

Landing page for `www.7beacons.com`. Astro (static, ships ~zero JS), containerized
with Docker, deployed to GitHub Pages via GitHub Actions. Full details in [README.md](README.md).

## Repo / hosting facts

- GitHub: `bcns-staging/bcns` (`gh` CLI is authenticated with repo/workflow scope — prefer `gh api`/`gh pr`/`gh run` over asking the user to click through the GitHub UI).
- Domain: `www.7beacons.com` is canonical (set in `public/CNAME` and `astro.config.mjs`); apex `7beacons.com` redirects to it.
- DNS lives at Namecheap: `A` records on `@` point to GitHub Pages' 4 IPs, `CNAME` on `www` points to `bcns-staging.github.io`.
- GitHub Pages source is "GitHub Actions" (set via `gh api repos/bcns-staging/bcns/pages`, not the UI). HTTPS is enforced; cert auto-renews via GitHub.

## Pipeline (4 stages)

1. **Dev**: `npm run dev` or `docker compose up dev` → `localhost:4321`, hot reload.
2. **Prod-like local preview**: `npm run build && npm run preview`, or `docker compose up --build prod` → `localhost:8080`, the exact static output + nginx security headers that ship to production. Do this before opening a PR.
3. **CI** (`.github/workflows/ci.yml`): runs on PRs into `main` and on pushes to any other branch. Type-checks, builds, uploads the build as a downloadable artifact (no live preview URL — GitHub Pages only serves one site per repo).
4. **Deploy** (`.github/workflows/deploy.yml`): runs on push to `main`. Builds and deploys to GitHub Pages. No manual approval gate is configured yet — every merge to `main` goes live immediately. (Optional: add required reviewers on the `github-pages` environment in Settings → Environments to add one.)

Normal flow: branch → edit → dev check → prod-like preview check → push → PR → CI passes → merge → deploy runs automatically.

## Known gotchas

- **This machine's network has Norton Antivirus SSL/TLS scanning (MITM)**, which re-signs HTTPS traffic with its own root CA. The host trusts it (needed `NODE_OPTIONS=--use-system-ca` for `npm install` to work), but Docker containers don't by default — that's why the `Dockerfile` and `docker-compose.yml` `dev` service pull in extra trusted certs from `certs/` (gitignored, not committed). See README "Local Docker builds behind SSL-inspecting proxies" if a container build fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
- Norton (or a caching DNS resolver) can also cause direct `curl`/`Invoke-WebRequest` to the live domain to fail or hang from this machine even when the deployment itself is fine — check `gh run view <id>` / the Actions tab for ground truth instead of trusting local network requests.
- Local DNS resolution on this machine can lag behind what's actually propagated. To check the real state, query the authoritative nameserver directly (`Resolve-DnsName <domain> -Server dns1.registrar-servers.com`) rather than assuming a local failure means DNS is misconfigured.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
