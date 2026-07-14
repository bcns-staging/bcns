import tzlookup from "@photostructure/tz-lookup";

/**
 * Accurate local time for a coordinate, using real timezone-boundary data
 * (bundled, no network call) rather than a longitude-only approximation.
 */
export function localTimeAt(lat: number, lng: number, at: Date = new Date()) {
  const timeZone = tzlookup(lat, lng);

  const time = at.toLocaleTimeString("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = at.toLocaleDateString("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return { time, date, timeZone };
}
