const WORKER_URL = "https://beacons-adsb-proxy.rk-0ne.workers.dev";

// Near New York — dense enough traffic to be visually interesting.
const CENTER = { lat: 40.7128, lon: -74.006, distNm: 150 };

export interface LiveAircraft {
  lat: number;
  lon: number;
  track: number;
  flight: string;
}

interface AdsbAircraft {
  lat?: number;
  lon?: number;
  track?: number;
  flight?: string;
}

export async function fetchLiveTraffic(): Promise<LiveAircraft[]> {
  const url = `${WORKER_URL}/?lat=${CENTER.lat}&lon=${CENTER.lon}&dist=${CENTER.distNm}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`live traffic feed returned ${res.status}`);

  const data: { ac?: AdsbAircraft[] } = await res.json();
  return (data.ac ?? [])
    .filter(
      (a): a is Required<AdsbAircraft> =>
        typeof a.lat === "number" && typeof a.lon === "number" && typeof a.track === "number"
    )
    .map((a) => ({ lat: a.lat, lon: a.lon, track: a.track, flight: (a.flight ?? "").trim() }));
}

export function liveTrafficGeoJSON(
  aircraft: LiveAircraft[]
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: aircraft.map((a) => ({
      type: "Feature",
      properties: { track: a.track, flight: a.flight },
      geometry: { type: "Point", coordinates: [a.lon, a.lat] },
    })),
  };
}

/** Draws a small triangular plane icon to raw pixel data, for map.addImage. */
export function createPlaneImage(size: number, color: string): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.05);
  ctx.lineTo(size * 0.85, size * 0.9);
  ctx.lineTo(size * 0.5, size * 0.7);
  ctx.lineTo(size * 0.15, size * 0.9);
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}
