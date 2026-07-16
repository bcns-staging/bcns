# 7 Beacons

Landing page for `www.7beacons.com`. Astro (static, ships ~zero JS), containerized
with Docker, deployed to Google Cloud Run (behind an external HTTPS Load Balancer) via
GitHub Actions. Full details in [README.md](README.md).

## Repo / hosting facts

- GitHub: `bcns-staging/bcns` (`gh` CLI is authenticated with repo/workflow scope — prefer `gh api`/`gh pr`/`gh run` over asking the user to click through the GitHub UI).
- Domain: `www.7beacons.com` is canonical (set in `astro.config.mjs`); apex `7beacons.com` is also served directly (both are on the Load Balancer's managed SSL cert).
- DNS lives at Namecheap: `A` records on both `@` and `www` point to the GCP Load Balancer's reserved static IP `136.69.58.246`.
- GCP project: `project-0abb08b6-4e60-4be0-8db`, region `us-central1`. Resources: Artifact Registry repo `bcns`, Cloud Run service `bcns-site`, external HTTPS Load Balancer (serverless NEG `bcns-neg` → backend service `bcns-backend` → url-maps `bcns-urlmap`/`bcns-urlmap-redirect` → static IP `bcns-lb-ip` → managed cert `bcns-ssl-cert` → proxies `bcns-https-proxy`/`bcns-http-proxy` → forwarding rules `bcns-https-fr`/`bcns-http-fr`).
- GitHub Actions authenticates to GCP via Workload Identity Federation (pool `github-pool`, provider `github-provider`, scoped to `repository == bcns-staging/bcns`) impersonating service account `bcns-deployer@project-0abb08b6-4e60-4be0-8db.iam.gserviceaccount.com` — no long-lived key stored in GitHub.
- GitHub Pages is disabled (was the previous host); `.github/workflows/deploy.yml` is kept but manually disabled (not deleted) as a reference/rollback point.

## Pipeline (4 stages)

1. **Dev**: `npm run dev` or `docker compose up dev` → `localhost:4321`, hot reload.
2. **Prod-like local preview**: `npm run build && npm run preview`, or `docker compose up --build prod` → `localhost:8080`, the exact container image (nginx on port 8080, matching Cloud Run's required port) that ships to production. Do this before opening a PR.
3. **CI** (`.github/workflows/ci.yml`): runs on PRs into `main` and on pushes to any other branch. Type-checks, builds, uploads the build as a downloadable artifact.
4. **Deploy** (`.github/workflows/deploy-gcp.yml`): runs on push to `main`. Type-checks, builds the Docker image, pushes it to Artifact Registry, and deploys to Cloud Run. No manual approval gate is configured yet — every merge to `main` goes live immediately.

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
