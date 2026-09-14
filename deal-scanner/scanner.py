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
import re
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

# Log what would be sent instead of posting -- for testing filters and
# rotation without spamming the channel.
DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"

# How much cheaper an already-alerted ASIN must get before it alerts again,
# in percent. Rotating deal types surface the same laptop at near-identical
# prices (Buy Box Used often undercuts Like New by a few dollars), so without
# a floor most of one feed's alerts are restatements of the other's.
MIN_REALERT_DROP = float(os.environ.get("MIN_REALERT_DROP", "5"))

DOMAIN = 1                      # amazon.com
# Amazon browse nodes. Free to add -- they go in one array on the same call,
# unlike price types. The only ceiling is the 150-results-per-page cap, past
# which paging costs another 5 tokens.
#   565108       Laptops          13896597011  Desktops > Towers
#   565098       Desktops         13896591011  Desktops > Minis
#   13896603011  Desktops > All-in-Ones
# Keepa resolves child nodes automatically, so a parent covers its children.
#   284822       Graphics Cards
CATEGORIES = [
    int(x) for x in
    os.environ.get("CATEGORIES", "565108,13896597011,284822").split(",") if x.strip()
]

# Title patterns applied only to deals in a given category. Scoping matters:
# gaming laptop titles also name their GPU ("Alienware 16 ... RTX 5070"), so a
# global title filter would silently gut the laptop feed.
#
# The GPU pattern requires a real 40/50-series model tier (4050-4090, 5050-5090)
# rather than RTX\s*(40|50)\d\d, which also matches the Quadro RTX 4000 -- a
# 2018 workstation card, not a 40-series GeForce.
#
# Laptops and towers must name a *discrete* GPU. Matching a bare "Radeon"
# or "Arc" would let integrated graphics through -- "Ryzen 5 7520U with
# Radeon 610M" is an iGPU, not a card -- so AMD requires the RX prefix and
# Intel requires an Arc model number.
_DISCRETE_GPU = re.compile(
    r"(GeForce|RTX\s*A?\d{3,4}|GTX\s*\d{3,4}|Radeon\s+RX\s*\d{3,4}"
    r"|Arc\s+A\d{3}|Quadro)",
    re.I,
)

# Keyed on the *leaf* nodes products are actually tagged with, not the
# parents we query. includeCategories=565108 (Laptops) returns items tagged
# 13896615011 / 13896609011 and never 565108 itself, so a filter keyed on the
# parent silently matches nothing and lets everything through.
CATEGORY_TITLE_FILTERS = {
    284822: re.compile(r"RTX\s*[45]0(50|60|70|80|90)", re.I),  # Graphics Cards
    13896615011: _DISCRETE_GPU,  # Traditional Laptops
    13896609011: _DISCRETE_GPU,  # 2 in 1 Laptops
    13896597011: _DISCRETE_GPU,  # Desktop Towers
}
# Keepa priceTypes. Only one per query -- each extra type is another call
# (another 5 tokens). This same value indexes the current/avg/deltaPercent
# arrays on the deal object, so it must stay in sync with the query.
PRICE_TYPE_LABELS = {
    0: "Amazon",
    1: "Marketplace New",
    2: "Used",
    9: "Warehouse",
    19: "Used - Like New",
    20: "Used - Very Good",
    21: "Used - Good",
    22: "Used - Acceptable",
    32: "Buy Box Used",
}
# Only one price type can be queried per call, so multiple types are
# rotated across runs rather than fetched together -- each extra type in a
# single run would cost another 5 tokens. With two types on a 7-minute
# schedule, each is checked every 14 minutes at no extra cost.
PRICE_TYPES = [
    int(x) for x in os.environ.get("PRICE_TYPES", "19,32").split(",") if x.strip()
]
# Set per-run by main() from the rotation cursor. Also indexes the
# current/avg/deltaPercent arrays, so it must match the query.
PRICE_TYPE = PRICE_TYPES[0]
# Deltas drift as the trailing average updates, so a deal can hover across
# the cutoff. A floor a few points below your target absorbs that.
DELTA_PERCENT_RANGE = [int(os.environ.get("MIN_DISCOUNT", "35")), 100]
# Keepa prices are in cents; these are set in dollars for sanity. The floor
# exists because sub-$200 hits are dominated by Chromebooks and accessories
# where shipping eats any margin -- a 50% discount on a $65 Chromebook is
# not a deal worth being paged about.
MIN_PRICE = float(os.environ.get("MIN_PRICE", "200"))
MAX_PRICE = float(os.environ.get("MAX_PRICE", "50000"))
CURRENT_RANGE = [int(MIN_PRICE * 100), int(MAX_PRICE * 100)]
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


def passes_title_filter(deal):
    """Apply a category's title pattern, if it has one.

    Only deals actually listed in that category are tested, so a gaming
    laptop naming an RTX card in its title isn't judged by the GPU rule.
    """
    cats = deal.get("categories") or []
    title = deal.get("title") or ""
    for cat_id, pattern in CATEGORY_TITLE_FILTERS.items():
        if cat_id in cats and not pattern.search(title):
            return False
    return True


def deal_age_hours(deal):
    created = (deal["creationDate"] + KEEPA_EPOCH_OFFSET_MIN) * 60
    return (time.time() - created) / 3600.0


def price_of(deal):
    cur = deal.get("current") or []
    v = cur[PRICE_TYPE] if len(cur) > PRICE_TYPE else -1
    return v if v and v > 0 else None


def avg_price(deal):
    """Reference average the discount is measured against, for the same
    interval(s) we queried -- so "43% off" and "$1,373.41 average" agree."""
    avg = deal.get("avg") or []
    vals = [
        avg[i][PRICE_TYPE]
        for i in DATE_RANGES
        if i < len(avg) and len(avg[i]) > PRICE_TYPE and avg[i][PRICE_TYPE] > 0
    ]
    return max(vals) if vals else None


def best_discount(deal):
    """Delta for the interval(s) we actually queried.

    Deal objects carry deltas for all four intervals regardless of which
    bucket was requested, and they differ -- a laptop can read 59% against
    its weekly average but 54% against its 90-day one. Reporting the max
    across all four would show a number that doesn't match what Keepa's UI
    displays for the same drop-interval setting.
    """
    dp = deal.get("deltaPercent") or []
    vals = [
        dp[i][PRICE_TYPE]
        for i in DATE_RANGES
        if i < len(dp) and len(dp[i]) > PRICE_TYPE
    ]
    return max(vals) if vals else 0


def image_url(deal):
    img = deal.get("image")
    if not img:
        return None
    name = bytes(img).decode("ascii", "ignore") if isinstance(img, list) else str(img)
    return f"https://images-na.ssl-images-amazon.com/images/I/{name}" if name else None


# --- state ------------------------------------------------------------------

def _gcs_blob():
    """Resolve STATE_PATH of the form gs://bucket/path to a GCS blob."""
    from google.cloud import storage

    bucket_name, _, blob_name = STATE_PATH[len("gs://"):].partition("/")
    return storage.Client().bucket(bucket_name).blob(blob_name)


def load_state():
    if STATE_PATH.startswith("gs://"):
        blob = _gcs_blob()
        if not blob.exists():
            return {"seen": {}}
        return json.loads(blob.download_as_text())
    try:
        with open(STATE_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"seen": {}}


def save_state(state):
    body = json.dumps(state, indent=2)
    if STATE_PATH.startswith("gs://"):
        _gcs_blob().upload_from_string(body, content_type="application/json")
        return
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        f.write(body)


# --- discord ----------------------------------------------------------------

def post_discord(content=None, embeds=None):
    if DRY_RUN:
        n = len(embeds or [])
        print(f"[dry-run] would post: {content or ''} ({n} embed(s))")
        return True
    if not DISCORD_WEBHOOK:
        # A missing webhook is a config error, not a transient failure --
        # report it as undelivered so state isn't advanced past deals that
        # nobody received.
        print("[error] no DISCORD_WEBHOOK_URL set; cannot deliver")
        return False
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

    avg = avg_price(deal)
    saving = (avg - price) if (avg and price) else None

    fields = [
        {"name": "Price", "value": f"${price/100:,.2f}" if price else "-", "inline": True},
        {"name": "Average", "value": f"${avg/100:,.2f}" if avg else "-", "inline": True},
        {"name": "Discount", "value": f"{pct}% off", "inline": True},
        {"name": "You save", "value": f"${saving/100:,.2f}" if saving else "-", "inline": True},
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
    global PRICE_TYPE

    if not KEEPA_KEY:
        sys.exit("KEEPA_API_KEY not set")

    state = load_state()

    # Pick this run's deal type from the rotation cursor, then advance it.
    cursor = int(state.get("rotation", 0)) % len(PRICE_TYPES)
    PRICE_TYPE = PRICE_TYPES[cursor]
    label = PRICE_TYPE_LABELS.get(PRICE_TYPE, PRICE_TYPE)

    # Each price type keeps its own seen-map: the same ASIN can appear under
    # both types at different prices, and a shared map would let one feed
    # suppress the other's alerts or fake a price drop.
    seen_all = state.get("seen", {})
    if seen_all and not isinstance(next(iter(seen_all.values())), dict):
        # Migrate the pre-rotation flat {asin: price} map, which belonged to
        # whichever single type was deployed at the time.
        seen_all = {str(PRICE_TYPES[0]): seen_all}
    seen = seen_all.get(str(PRICE_TYPE), {})

    union, tokens_left = fetch_union()
    recent = {
        asin: d for asin, d in union.items()
        if deal_age_hours(d) <= MAX_AGE_HOURS and passes_title_filter(d)
    }

    # Dedup on Keepa's deal event, not just price.
    #
    # Keying purely on "cheapest price ever recorded" deadlocks the feed:
    # every observed deal is written to state whether or not it was actually
    # sent, so an item that was muted once needs a 5% drop to ever alert --
    # even though you never heard about it. Observed live, five consecutive
    # deals sat muted for a day, three at exactly the recorded price.
    #
    # creationDate is when Keepa flagged this as a deal. A newer one is a
    # genuinely new event and worth reporting regardless of price history,
    # while the same event re-seen every 7 minutes (or under the other deal
    # type) stays quiet.
    def prior(asin):
        for m in seen_all.values():
            if isinstance(m, dict) and isinstance(m.get(asin), dict):
                yield m[asin]

    new_items = []
    suppressed = 0
    for asin, deal in recent.items():
        price = price_of(deal)
        created = deal.get("creationDate") or 0
        records = list(prior(asin))

        if not records:
            new_items.append(deal)
            continue

        newest_seen = max(r.get("created", 0) for r in records)
        cheapest = min(
            (r["price"] for r in records if r.get("price")), default=None
        )
        is_new_event = created > newest_seen
        is_real_drop = (
            price is not None
            and cheapest is not None
            and price <= cheapest * (1 - MIN_REALERT_DROP / 100.0)
        )
        if is_new_event or is_real_drop:
            new_items.append(deal)
        else:
            suppressed += 1

    print(
        f"type={PRICE_TYPE} ({label})  union={len(union)}  "
        f"last24h={len(recent)}  new={len(new_items)}  "
        f"cross-feed-suppressed={suppressed}  tokensLeft={tokens_left}"
    )

    delivered = True
    if new_items:
        new_items.sort(key=deal_age_hours)
        for i in range(0, len(new_items), 10):     # discord caps 10 embeds/msg
            chunk = new_items[i:i + 10]
            header = (
                f"**{len(new_items)} deal(s)** — {label}, "
                f"{DELTA_PERCENT_RANGE[0]}%+ off"
                if i == 0 else None
            )
            if not post_discord(content=header, embeds=[build_embed(d) for d in chunk]):
                delivered = False
        print(f"{'posted' if delivered else 'FAILED to post'} {len(new_items)} deal(s)")
    else:
        if not QUIET_WHEN_EMPTY:
            post_discord(
                content=f"No updates yet — {label}: {len(recent)} deal(s) tracked, nothing new."
            )
        print("nothing new")

    if not delivered:
        # Leave state untouched so the next run retries these deals rather
        # than marking undelivered items as already seen. The rotation
        # cursor stays put too, so the retry re-runs this same type.
        print("[warn] delivery failed -- state not updated, will retry next run")
        return

    seen_all[str(PRICE_TYPE)] = {
        asin: {
            "created": d.get("creationDate") or 0,
            "price": price_of(d),
        }
        for asin, d in recent.items()
        if price_of(d)
    }
    state["seen"] = seen_all
    state["rotation"] = cursor + 1
    state["last_run"] = int(time.time())
    state["tokens_left"] = tokens_left
    save_state(state)


if __name__ == "__main__":
    main()
