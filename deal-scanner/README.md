# Deal Scanner

Watches Amazon laptop listings via the Keepa Deals API and posts new discounts
to Discord. Unrelated to the 7 Beacons site — it just lives in this repo.
Nothing here is part of the Astro build or the Cloud Run deploy.

## What it does

1. Queries Keepa's Deals API for Laptops, Buy Box Used, 35%+ below the 90-day average
2. Keeps only deals Keepa found in the last 24 hours
3. Diffs against the previous run, so you only ever see what's new
4. Posts each new deal to Discord as a card (image, price, discount, condition, sales-rank drops)

## Running it

```bash
export KEEPA_API_KEY=...
export DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
python3 scanner.py
```

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `KEEPA_API_KEY` | *(required)* | Keepa API key, from your Keepa dashboard |
| `DISCORD_WEBHOOK_URL` | *(required)* | Discord channel webhook |
| `STATE_PATH` | `state.json` | Where the "already sent" set is stored |
| `MIN_DISCOUNT` | `35` | Minimum % below average to alert on |
| `CATEGORIES` | `565108,13896597011,284822` | Amazon browse nodes: Laptops, Desktop Towers, Graphics Cards |
| `MIN_PRICE` / `MAX_PRICE` | `200` / `50000` | Price bounds in dollars |
| `PRICE_TYPES` | `19,32` | Deal types to rotate through, one per run (19=Used-Like New, 32=Buy Box Used) |
| `MIN_REALERT_DROP` | `5` | How much cheaper (%) an already-alerted ASIN must get before alerting again |
| `DRY_RUN` | `0` | `1` logs what would be posted instead of sending |
| `DATE_RANGES` | `3` | Keepa buckets: 0=day, 1=week, 2=month, 3=90d. Comma-separated |
| `QUIET_WHEN_EMPTY` | `0` | `1` = stay silent when nothing is new |
| `VERIFY_TLS` | `1` | `0` disables cert checks (needed behind TLS-inspecting AV) |

## Token cost

Keepa meters by token. A Deals query costs **5 tokens** regardless of how many
results come back, so one sweep = 5 tokens with the default single date range.

| Cadence | Tokens/hour |
|---|---|
| Every 5 min | 60 |
| Every 7 min | 43 |
| Every 30 min | 10 |

A Keepa Pro subscription generates 1 token/minute (60/hour), capped at a
60-token bucket. Adding categories is free (`includeCategories` is an array in
the same call); adding **deal types is not** — each `priceTypes` value needs its
own call, so a second condition doubles the cost.

## Notes

- **Date ranges are separate datasets, not nested.** Keepa's "All combined" UI
  view is a union of all four buckets. A deal can show a 0% day-delta but 57%
  against its 90-day average, so querying one bucket will not surface
  everything the UI shows. `DATE_RANGES=0,1,2,3` reproduces the UI at 4x cost.
- **Deltas drift** as the trailing average updates, so a deal can cross your
  threshold in either direction between runs. A floor a few points below your
  real target absorbs that.
- **State is only written on successful delivery.** If Discord rejects the post,
  state is left alone so the next run retries, rather than marking undelivered
  deals as sent.
- Keepa gzips responses regardless of `Accept-Encoding`.
- Discord sits behind Cloudflare, which 403s urllib's default User-Agent.

## Deployment

Runs as a Cloud Run job on a Cloud Scheduler trigger, in the same GCP project
as the 7 Beacons site (`project-0abb08b6-4e60-4be0-8db`, `us-central1`).

| Resource | Name |
|---|---|
| Cloud Run job | `deal-scanner` |
| Scheduler | `deal-scanner-trigger` (`*/7 * * * *` UTC) |
| State bucket | `gs://project-0abb08b6-4e60-4be0-8db-deal-scanner/state.json` |
| Secrets | `keepa-api-key`, `discord-webhook-url` (Secret Manager) |

State lives in GCS because Cloud Run is stateless -- losing it means every
tracked deal gets re-sent as a duplicate.

Redeploy after changing `scanner.py`:

```bash
gcloud run jobs deploy deal-scanner --source deal-scanner --region us-central1
```

Run once manually:

```bash
gcloud run jobs execute deal-scanner --region us-central1
```

## Rotating deal types

Keepa allows only one `priceTypes` value per query, so multiple deal types are
rotated across runs rather than fetched together -- each extra type in a single
run costs another 5 tokens. With two types on a 7-minute schedule, each is
checked every 14 minutes at no extra cost.

The rotation cursor lives in state, and each type keeps its **own** seen-map:
the same ASIN can appear under both types at different prices, and a shared map
would let one feed suppress the other's alerts or look like a price drop.

An ASIN alerts when it is genuinely unseen, or when it becomes at least
`MIN_REALERT_DROP` percent cheaper than the best price ever reported for it
across *every* type. Without that floor most of one feed's alerts are just
restatements of the other's: measured on live data, 6 of 8 Buy Box Used deals
were laptops already sent as Like New, quoted within $15 -- one to the cent.

## Categories

Categories are free to add -- they go in one array on the same call, unlike
price types. The only ceiling is the 150-results-per-page cap, past which
paging costs another 5 tokens. Keepa resolves child nodes automatically, so
a parent node covers its children.

| Node | Category |
|---|---|
| `565108` | Laptops |
| `565098` | Desktops (parent of the three below) |
| `13896597011` | Desktops > Towers |
| `13896591011` | Desktops > Minis |
| `13896603011` | Desktops > All-in-Ones |
| `284822` | Graphics Cards |

Amazon's own category tagging is unreliable -- a 27" ASUS monitor turned up
under Towers, and a Psycho box set under PlayStation 5 > Consoles. Expect the
occasional wrong-product-type alert.

PlayStation was evaluated and dropped: consoles showed **zero** deals at even
10% off across 90 days and three price types, so the filter would never fire.
Sony holds console pricing too tightly for discounts to appear.

## Per-category title filters

`CATEGORY_TITLE_FILTERS` maps a category node to a regex its titles must match.
Filters apply **only** to deals actually listed in that category, which matters:
gaming laptop titles name their GPU ("Alienware 16 ... RTX 5070"), so a global
title filter would silently gut the laptop feed.

Graphics Cards (`284822`) is restricted to RTX 40/50-series. The pattern
requires a real model tier -- `RTX\s*[45]0(50|60|70|80|90)` -- because the
looser `RTX\s*(40|50)\d\d` also matches the **Quadro RTX 4000**, a 2018
workstation card rather than a 40-series GeForce.

Expect this feed to be quiet. Current-generation GPUs hold their price: across
90 days the only RTX 40/50 card discounted at all was a 5060 Ti at 26%, under
the default 35% floor. A 35%-off 40/50-series card is a genuinely rare event,
which is arguably the point of watching for it.
