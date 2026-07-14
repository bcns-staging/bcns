export interface PlaceInfo {
  city: string | null;
  state: string | null;
  countryCode: string | null;
}

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  province?: string;
  region?: string;
  state_district?: string;
  country_code?: string;
}

/**
 * Reverse-geocodes via Nominatim (OpenStreetMap) - has proper CORS support
 * and this is a one-shot call per click (not continuous polling), well
 * within their usage policy (max 1 req/sec). Different countries use
 * different admin-level field names (state/province/region), so several
 * are tried in order.
 */
export async function fetchPlaceInfo(lat: number, lng: number): Promise<PlaceInfo | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1&accept-language=en&zoom=10`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data: { address?: NominatimAddress } = await res.json();
  const address = data.address;
  if (!address) return null;

  const city = address.city ?? address.town ?? address.village ?? address.municipality ?? address.county ?? null;
  const state = address.state ?? address.province ?? address.region ?? address.state_district ?? null;
  const countryCode = address.country_code ? address.country_code.toUpperCase() : null;

  return { city, state, countryCode };
}
