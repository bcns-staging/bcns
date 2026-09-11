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
