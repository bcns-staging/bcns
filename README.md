# 7 Beacons

Landing page for [www.7beacons.com](https://www.7beacons.com), built with [Astro](https://astro.build) and deployed to Google Cloud Run.

## Project structure

```text
/
├── src/
│   ├── components/        # Header, Hero, Footer
│   ├── layouts/           # Layout.astro (HTML shell, meta, CSP)
│   ├── styles/            # global.css
│   └── pages/
│       └── index.astro
├── Dockerfile              # multi-stage: build with Node, serve with nginx (port 8080)
├── nginx.conf               # nginx config (listens on 8080 for Cloud Run)
├── docker-compose.yml       # `dev` (hot reload) and `prod` (nginx, prod-like) services
└── .github/workflows/
    ├── ci.yml               # runs on PRs: typecheck, build, uploads preview artifact
    └── deploy-gcp.yml         # runs on push to main: build, push to Artifact Registry, deploy to Cloud Run
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

The `prod` service builds and serves the exact container image that ships to Cloud Run, so it's the best way to sanity-check a change before it ships.

### Local Docker builds behind SSL-inspecting proxies

If `docker compose up` fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` or "certificate not trusted", something on your network/machine (corporate proxy, or antivirus SSL scanning like Norton, Kaspersky, etc.) is intercepting HTTPS and the container doesn't trust its root certificate — even though your host OS does. This doesn't affect GitHub Actions (no interception there), only local builds.

Fix: export that root CA cert and drop it in `certs/` (already gitignored, so it never gets committed) — the Dockerfile and `dev` service pick up any `certs/*.crt` file automatically. On Windows, find the cert in `certmgr.msc` under Trusted Root Certification Authorities (look for your antivirus/proxy vendor's name) and export it as Base-64 X.509 (`.cer`/`.crt`).

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
2. **Merge to `main`**. The `Deploy to Cloud Run` workflow (`.github/workflows/deploy-gcp.yml`) type-checks, builds the Docker image, pushes it to Artifact Registry, and deploys it to the `bcns-site` Cloud Run service.
3. No manual approval gate is configured — every merge to `main` goes live immediately.

Authentication to GCP uses Workload Identity Federation (no long-lived service account key in GitHub): the workflow exchanges its OIDC token for short-lived credentials, impersonating a deploy-only service account scoped to this repo.

### Infrastructure (one-time GCP setup, already provisioned)

- **Compute**: Cloud Run service `bcns-site` in `us-central1`, container listens on port 8080.
- **Registry**: Artifact Registry Docker repo `bcns` in `us-central1`.
- **Traffic**: external HTTPS Load Balancer in front of Cloud Run (serverless NEG → backend service → URL map → reserved static IP → Google-managed SSL cert for `www.7beacons.com` + `7beacons.com` → HTTPS proxy, plus an HTTP proxy that redirects to HTTPS).
- **DNS** at your registrar (Namecheap → Domain List → Manage → Advanced DNS): `A` records on both `@` and `www` point to the Load Balancer's reserved static IP.
- **Auth**: Workload Identity Pool/provider trusting GitHub's OIDC issuer, restricted to `repository == bcns-staging/bcns`, bound to a dedicated `bcns-deployer` service account with `run.developer`, `artifactregistry.writer`, and `iam.serviceAccountUser` roles only.
