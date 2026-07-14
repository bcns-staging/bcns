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

  // "GMT+9" / "GMT-4:30" style offset, e.g. as a quick-glance complement to
  // the IANA zone name (which most people don't have memorized).
  const offsetPart = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName");
  const utcOffset = offsetPart ? offsetPart.value.replace("GMT", "UTC") : "";

  return { time, date, timeZone, utcOffset };
}
