export interface Beacon {
  name: string;
  description: string;
  lng: number;
  lat: number;
}

// Seven real-world points, one per inhabited continent-ish spread —
// literal "beacons" on the globe.
export const BEACONS: Beacon[] = [
  { name: "New York", description: "North America", lng: -74.006, lat: 40.7128 },
  { name: "London", description: "Europe", lng: -0.1278, lat: 51.5074 },
  { name: "Dubai", description: "Middle East", lng: 55.2708, lat: 25.2048 },
  { name: "Tokyo", description: "East Asia", lng: 139.6503, lat: 35.6762 },
  { name: "Sydney", description: "Oceania", lng: 151.2093, lat: -33.8688 },
  { name: "Cape Town", description: "Africa", lng: 18.4241, lat: -33.9249 },
  { name: "Rio de Janeiro", description: "South America", lng: -43.1729, lat: -22.9068 },
];

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Interpolates `steps` points along the great-circle path between two coordinates. */
function greatCircle(a: Beacon, b: Beacon, steps = 64): [number, number][] {
  const lat1 = toRad(a.lat);
  const lon1 = toRad(a.lng);
  const lat2 = toRad(b.lat);
  const lon2 = toRad(b.lng);

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
      )
    );

  if (d === 0) return [[a.lng, a.lat]];

  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const A = Math.sin((1 - t) * d) / Math.sin(d);
    const B = Math.sin(t * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lon = Math.atan2(y, x);
    points.push([toDeg(lon), toDeg(lat)]);
  }
  return points;
}

/** Great-circle arcs connecting the beacons in a loop, as a GeoJSON FeatureCollection. */
export function beaconArcs(): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = BEACONS.map((beacon, i) => {
    const next = BEACONS[(i + 1) % BEACONS.length];
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: greatCircle(beacon, next),
      },
    };
  });
  return { type: "FeatureCollection", features };
}
