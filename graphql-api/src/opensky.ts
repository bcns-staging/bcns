export interface Aircraft {
  icao24: string;
  callsign: string;
  originCountry: string;
  lat: number;
  lng: number;
  velocity: number | null;
  heading: number | null;
  onGround: boolean;
}

// OpenSky's ADS-B data is intentionally public - aircraft transponders are
// required by aviation regulators to broadcast this, unlike the fictional
// person data elsewhere in this API, so no role/access-control gate here.
//
// KNOWN LIMITATION: as deployed on Cloud Run, this returns an empty list.
// Both opensky-network.org and auth.opensky-network.org (a completely
// separate domain, the OAuth2 token server) time out on connect from Cloud
// Run's shared egress IPs - confirmed with valid OAuth2 credentials too, so
// this isn't a rate-limit/auth issue, it's a network-level block against
// Google's cloud IP ranges covering OpenSky's whole domain. No fix from our
// side short of routing traffic through a non-cloud-flagged egress path.
// The code is otherwise correct and works fine from a non-blocked network
// (e.g. local dev) - see graphql-api's README/AGENTS.md note if present.
const OPENSKY_STATES_URL =
  "https://opensky-network.org/api/states/all?lamin=40.4&lomin=-74.3&lamax=41.0&lomax=-73.6";
const OPENSKY_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

// One shared in-memory cache, refetched at most every CACHE_TTL_MS -
// regardless of how many clients are subscribed, OpenSky only gets polled
// once per window. Rate limits matter even at this demo's small scale.
const CACHE_TTL_MS = 12000;
let cache: Aircraft[] = [];
let cachedAt = 0;

// OAuth2 client credentials flow - tokens expire every 30 minutes, cached
// here and refreshed a little early rather than waiting for a 401.
let accessToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;

  const res = await fetch(OPENSKY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.OPENSKY_CLIENT_ID ?? "",
      client_secret: process.env.OPENSKY_CLIENT_SECRET ?? "",
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenSky token request failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  accessToken = json.access_token;
  tokenExpiresAt = Date.now() + (json.expires_in - 30) * 1000; // refresh 30s early
  return accessToken;
}

// OpenSky returns each aircraft as a positional array, not an object -
// indices per https://openskynetwork.github.io/opensky-api/rest.html
function parseState(state: unknown[]): Aircraft | null {
  const icao24 = state[0] as string;
  const callsign = (state[1] as string | null)?.trim();
  const originCountry = state[2] as string;
  const lng = state[5] as number | null;
  const lat = state[6] as number | null;
  const onGround = state[8] as boolean;
  const velocity = state[9] as number | null;
  const heading = state[10] as number | null; // "true_track", degrees clockwise from north

  if (lat === null || lng === null || !callsign) return null;
  return { icao24, callsign, originCountry, lat, lng, velocity, heading, onGround };
}

export async function getAircraftNearNYC(): Promise<Aircraft[]> {
  if (Date.now() - cachedAt < CACHE_TTL_MS) return cache;

  let res: Response;
  try {
    const token = await getAccessToken();
    res = await fetch(OPENSKY_STATES_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.error("OpenSky fetch failed:", err, (err as Error & { cause?: unknown }).cause);
    return cache; // serve stale cache rather than fail the request
  }
  if (!res.ok) return cache;

  const json = (await res.json()) as { states: unknown[][] | null };
  cache = (json.states ?? [])
    .map(parseState)
    .filter((a): a is Aircraft => a !== null)
    .slice(0, 15);
  cachedAt = Date.now();
  return cache;
}
