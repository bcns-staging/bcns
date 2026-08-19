import countryData from "flag-icons/country.json";

export interface Country {
  // Lowercase ISO 3166-1 alpha-2 -- matches flag-icons' "fi-{code}" CSS class.
  code: string;
  // Uppercase display name, matching this site's all-caps HUD text convention.
  name: string;
}

interface RawCountry {
  code: string;
  name: string;
  iso: boolean;
}

// flag-icons' country.json also includes non-country entries (Europe,
// United Nations, individual UK home nations, etc.) alongside real
// countries/territories -- iso === true is exactly the "iso: false" flag
// filtered out, leaving the country and territory list.
export const COUNTRIES: Country[] = (countryData as RawCountry[])
  .filter((c) => c.iso)
  .map((c) => ({ code: c.code, name: c.name.toUpperCase() }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const COUNTRY_CODE_BY_NAME: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.name, c.code])
);
