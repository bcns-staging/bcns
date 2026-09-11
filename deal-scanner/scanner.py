#!/usr/bin/env python3
"""Amazon used-laptop deal scanner.

Queries Keepa's Deals API across all four date-range buckets, unions the
results, keeps only deals found in the last 24h, diffs against the previous
run, and posts anything new to Discord.

Why four queries: Keepa's "All combined" view is a union, not a single
dateRange value. A deal can show a 0% day-delta but 57% against its 90-day
average -- filtering on any single range silently drops those.
"""

import gzip
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request

# --- config -----------------------------------------------------------------

KEEPA_KEY = os.environ.get("KEEPA_API_KEY", "").strip()
DISCORD_WEBHOOK = os.environ.get("DISCORD_WEBHOOK_URL", "").strip()
STATE_PATH = os.environ.get("STATE_PATH", "state.json")

# This machine's Norton TLS interception breaks Python cert validation.
# Set VERIFY_TLS=0 locally; leave it on (default) in Cloud Run.
VERIFY_TLS = os.environ.get("VERIFY_TLS", "1") != "0"

# Send a "nothing new" message instead of staying silent.
QUIET_WHEN_EMPTY = os.environ.get("QUIET_WHEN_EMPTY", "0") == "1"

DOMAIN = 1                      # amazon.com
CATEGORIES = [565108]           # Laptops (565098 = Desktops)
PRICE_TYPE = 32                 # Buy Box Used (with shipping)
# Deltas drift as the trailing average updates, so a deal can hover across
# the cutoff. A floor a few points below your target absorbs that.
DELTA_PERCENT_RANGE = [int(os.environ.get("MIN_DISCOUNT", "35")), 100]
CURRENT_RANGE = [0, 5000000]    # cents
MAX_AGE_HOURS = 24
# Keepa buckets: 0=day, 1=week, 2=month, 3=90d. Using 90d only (5 tokens
# /sweep): a price measured against its 90-day average is the honest "is
# this actually cheap" signal, where a short-interval drop can just be an
# inflated price falling back to normal. Keepa's "All combined" UI view is
# the union of all four -- set DATE_RANGES=0,1,2,3 to reproduce it.
DATE_RANGES = [
    int(x) for x in os.environ.get("DATE_RANGES", "3").split(",") if x.strip()
]

KEEPA_EPOCH_OFFSET_MIN = 21564000   # Keepa minutes -> unix seconds

# Keepa warehouseCondition codes (deal-object docs). 0 means no warehouse
# deal exists, so we omit the field entirely rather than show "unknown".
CONDITION_LABELS = {
    2: "Used - Like New",
    3: "Used - Very Good",
    4: "Used - Good",
    5: "Used - Acceptable",
}


def _ctx():
    if VERIFY_TLS:
        return None
    c = ssl.create_default_context()
    c.check_hostname = False
    c.verify_mode = ssl.CERT_NONE
    return c


def http_json(url, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Accept-Encoding": "identity",
            "User-Agent": "deal-scanner/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=60, context=_ctx()) as r:
        raw = r.read()
        # Keepa gzips responses regardless of Accept-Encoding.
        if r.headers.get("Content-Encoding") == "gzip" or raw[:2] == b"\x1f\x8b":
            raw = gzip.decompress(raw)
        return json.loads(raw.decode("utf-8", "replace"))


# --- keepa ------------------------------------------------------------------

def fetch_union():
    """Run all four date-range queries and union by ASIN."""
    union = {}
    tokens_left = None
    for dr in DATE_RANGES:
        query = {
            "page": 0,
            "domainId": DOMAIN,
            "includeCategories": CATEGORIES,
            "priceTypes": [PRICE_TYPE],
            "deltaPercentRange": DELTA_PERCENT_RANGE,
            "currentRange": CURRENT_RANGE,
            "isRangeEnabled": True,
            "isFilterEnabled": True,
            "dateRange": dr,
            "sortType": 1,          # newest first
        }
        resp = http_json(
            f"https://api.keepa.com/deal?key={KEEPA_KEY}", query
        )
        if "error" in resp:
            raise RuntimeError(f"Keepa error: {resp['error']}")
        tokens_left = resp.get("tokensLeft")
        for d in (resp.get("deals") or {}).get("dr") or []:
            union.setdefault(d["asin"], d)
    return union, tokens_left


def deal_age_hours(deal):
    created = (deal["creationDate"] + KEEPA_EPOCH_OFFSET_MIN) * 60
    return (time.time() - created) / 3600.0


def price_of(deal):
    cur = deal.get("current") or []
    v = cur[PRICE_TYPE] if len(cur) > PRICE_TYPE else -1
    return v if v and v > 0 else None


def best_discount(deal):
    """Highest delta across the four intervals -- what the UI headlines."""
    dp = deal.get("deltaPercent") or []
    vals = [row[PRICE_TYPE] for row in dp if len(row) > PRICE_TYPE]
    return max(vals) if vals else 0


def image_url(deal):
    img = deal.get("image")
    if not img:
        return None
    name = bytes(img).decode("ascii", "ignore") if isinstance(img, list) else str(img)
    return f"https://images-na.ssl-images-amazon.com/images/I/{name}" if name else None


# --- state ------------------------------------------------------------------

def load_state():
    try:
        with open(STATE_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"seen": {}}


def save_state(state):
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


# --- discord ----------------------------------------------------------------

def post_discord(content=None, embeds=None):
    if not DISCORD_WEBHOOK:
        print("[warn] no DISCORD_WEBHOOK_URL set; skipping post")
        return
    payload = {}
    if content:
        payload["content"] = content
    if embeds:
        payload["embeds"] = embeds
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        DISCORD_WEBHOOK,
        data=data,
        headers={
            "Content-Type": "application/json",
            # Cloudflare fronts Discord and rejects urllib's default UA
            # with 403 / error 1010.
            "User-Agent": "Mozilla/5.0 (deal-scanner)",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30, context=_ctx()) as r:
            r.read()
        return True
    except (urllib.error.HTTPError, urllib.error.URLError, OSError) as e:
        detail = ""
        if isinstance(e, urllib.error.HTTPError):
            detail = f" {e.code}: {e.read().decode('utf-8', 'replace')[:200]}"
        print(f"[error] discord post failed{detail or f': {e}'}")
        return False


def build_embed(deal):
    title = (deal.get("title") or deal["asin"])
    title = title.encode("utf-8", "replace").decode("utf-8", "replace")[:250]
    price = price_of(deal)
    pct = best_discount(deal)
    day_pct = (deal.get("deltaPercent") or [[]])[0]
    day_pct = day_pct[PRICE_TYPE] if len(day_pct) > PRICE_TYPE else 0

    fields = [
        {"name": "Price", "value": f"${price/100:,.2f}" if price else "-", "inline": True},
        {"name": "Discount", "value": f"{pct}% off", "inline": True},
        {"name": "Today", "value": f"{day_pct}%", "inline": True},
        {"name": "Rank drops (30d)", "value": str(deal.get("salesRankDrops30", "?")), "inline": True},
        {"name": "Found", "value": f"{deal_age_hours(deal):.0f}h ago", "inline": True},
    ]
    cond = CONDITION_LABELS.get(deal.get("warehouseCondition"))
    if cond:
        fields.append({"name": "Condition", "value": cond, "inline": True})

    embed = {
        "title": title,
        "url": f"https://www.amazon.com/dp/{deal['asin']}",
        "color": 0x2ECC71 if pct >= 50 else 0x3498DB,
        "fields": fields,
        "footer": {"text": f"ASIN {deal['asin']}"},
    }
    img = image_url(deal)
    if img:
        embed["thumbnail"] = {"url": img}
    return embed


# --- main -------------------------------------------------------------------

def main():
    if not KEEPA_KEY:
        sys.exit("KEEPA_API_KEY not set")

    union, tokens_left = fetch_union()
    recent = {
        asin: d for asin, d in union.items()
        if deal_age_hours(d) <= MAX_AGE_HOURS
    }

    state = load_state()
    seen = state.get("seen", {})
    first_run = not seen

    # Key on asin -> price, so a deeper discount on a known ASIN re-alerts.
    new_items = []
    for asin, deal in recent.items():
        price = price_of(deal)
        prev = seen.get(asin)
        if prev is None or (price is not None and price < prev):
            new_items.append(deal)

    print(f"union={len(union)}  last24h={len(recent)}  new={len(new_items)}  tokensLeft={tokens_left}")

    delivered = True
    if new_items:
        new_items.sort(key=deal_age_hours)
        for i in range(0, len(new_items), 10):     # discord caps 10 embeds/msg
            chunk = new_items[i:i + 10]
            header = (
                f"**{len(new_items)} deal(s)** — Laptops, Buy Box Used, {DELTA_PERCENT_RANGE[0]}%+ off"
                if i == 0 else None
            )
            if not post_discord(content=header, embeds=[build_embed(d) for d in chunk]):
                delivered = False
        print(f"{'posted' if delivered else 'FAILED to post'} {len(new_items)} deal(s)")
    else:
        if not QUIET_WHEN_EMPTY:
            post_discord(content=f"No updates yet — {len(recent)} deal(s) tracked, nothing new.")
        print("nothing new")

    if not delivered:
        # Leave state untouched so the next run retries these deals rather
        # than marking undelivered items as already seen.
        print("[warn] delivery failed -- state not updated, will retry next run")
        return

    state["seen"] = {
        asin: price_of(d) for asin, d in recent.items() if price_of(d)
    }
    state["last_run"] = int(time.time())
    state["tokens_left"] = tokens_left
    save_state(state)


if __name__ == "__main__":
    main()
