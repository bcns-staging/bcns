import { bearing, greatCircle, type LngLat } from "./geo";

export const NEW_YORK: LngLat = { lng: -74.006, lat: 40.7128 };
export const SAN_FRANCISCO: LngLat = { lng: -122.4194, lat: 37.7749 };

const STEPS = 300;

/** Points along the NY -> SF great-circle route, precomputed once. */
export const FLIGHT_PATH: [number, number][] = greatCircle(NEW_YORK, SAN_FRANCISCO, STEPS);

export function flightLine(): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: FLIGHT_PATH },
  };
}

/** Position and heading along the route at progress `t` (0..1). */
export function flightPosition(t: number): { lng: number; lat: number; heading: number } {
  const clamped = Math.min(Math.max(t, 0), 1);
  const index = Math.min(Math.floor(clamped * (FLIGHT_PATH.length - 1)), FLIGHT_PATH.length - 2);
  const [lng, lat] = FLIGHT_PATH[index];
  const [nextLng, nextLat] = FLIGHT_PATH[index + 1];
  const heading = bearing({ lng, lat }, { lng: nextLng, lat: nextLat });
  return { lng, lat, heading };
}
