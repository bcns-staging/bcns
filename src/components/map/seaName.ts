interface GazetteerRecord {
  placeType?: string;
  preferredGazetteerName?: string;
}

// Preference order: broad, universally-recognized names first. IHO Sea Area
// is the internationally standardized definition of named seas; "Sea" and
// "General Sea Area" are looser classifications used as a fallback.
const PREFERRED_PLACE_TYPES = ["Ocean", "IHO Sea Area", "Sea", "General Sea Area"];

/**
 * Reverse-geocodes a water coordinate to an ocean/sea name via the Marine
 * Regions Gazetteer (marineregions.org) - CORS-enabled, no key required.
 * Only meaningful to call once Nominatim has already come back empty
 * (i.e. the point isn't on land).
 */
export async function fetchSeaName(lat: number, lng: number): Promise<string | null> {
  const url = `https://www.marineregions.org/rest/getGazetteerRecordsByLatLong.json/${lat}/${lng}/`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const records: GazetteerRecord[] = await res.json();
  if (!Array.isArray(records)) return null;

  for (const placeType of PREFERRED_PLACE_TYPES) {
    const matches = records.filter(
      (r): r is Required<GazetteerRecord> => r.placeType === placeType && !!r.preferredGazetteerName
    );
    if (matches.length === 0) continue;
    // Multiple sub-basins can match at once (e.g. "Mediterranean Sea -
    // Eastern Basin" alongside "Mediterranean Sea") - the shortest name is
    // usually the broader, more recognizable one.
    matches.sort((a, b) => a.preferredGazetteerName.length - b.preferredGazetteerName.length);
    return matches[0].preferredGazetteerName;
  }
  return null;
}
