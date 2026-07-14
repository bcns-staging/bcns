/**
 * Proxies adsb.lol's live aircraft API and adds CORS headers, since
 * adsb.lol doesn't send them itself — the static site (7beacons.com)
 * can't call it directly from browser JS otherwise.
 */

const ALLOWED_ORIGINS = new Set([
  "https://www.7beacons.com",
  "https://7beacons.com",
  "http://localhost:4321",
]);

function corsHeaders(origin: string | null): HeadersInit {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://www.7beacons.com";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    const lat = url.searchParams.get("lat");
    const lon = url.searchParams.get("lon");
    const dist = url.searchParams.get("dist") ?? "250";

    if (!lat || !lon) {
      return new Response(JSON.stringify({ error: "lat and lon query params are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const upstream = await fetch(
      `https://api.adsb.lol/v2/lat/${encodeURIComponent(lat)}/lon/${encodeURIComponent(lon)}/dist/${encodeURIComponent(dist)}`,
      // No cacheEverything: that previously caused an errored (429)
      // response to get cached and served back on every subsequent
      // request. Without it, Cloudflare only caches normally-cacheable
      // (successful) responses, per standard HTTP semantics.
      { cf: { cacheTtl: 5 } }
    );

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json",
        ...(upstream.ok ? { "Cache-Control": "public, max-age=5" } : {}),
        ...corsHeaders(origin),
      },
    });
  },
} satisfies ExportedHandler;
