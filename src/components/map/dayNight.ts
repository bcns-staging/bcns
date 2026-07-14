const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

// The terminator is subdivided into this many nested bands, from the
// horizon (0°) down to astronomical twilight (-18° sun altitude), each
// drawn at a low opacity so they overlap into a smooth gradient rather
// than a few visibly "stepped" bands.
const BAND_COUNT = 24;
const MAX_DEPRESSION_DEG = 18;
// 0.7 crushed light base styles (Positron/Bright/Liberty) into a gray
// indistinguishable from the dark style; 0.4 still reads as clearly
// "night" without erasing the chosen style's own daytime look.
const MAX_TOTAL_OPACITY = 0.4;
// Solved so BAND_COUNT overlapping layers of this opacity compound
// (via alpha blending) to roughly MAX_TOTAL_OPACITY at full night.
const BAND_OPACITY = 1 - Math.pow(1 - MAX_TOTAL_OPACITY, 1 / BAND_COUNT);

interface SunPosition {
  gst: number; // Greenwich sidereal time, degrees
  rightAscension: number; // degrees
  declination: number; // degrees
}

function sunPositionAt(at: Date): SunPosition {
  const julianDay = at.getTime() / 86400000 + 2440587.5;
  const n = julianDay - 2451545.0; // days since J2000.0

  const gst = (280.46061837 + 360.98564736629 * n) % 360;

  const meanLongitude = (280.46 + 0.9856474 * n) % 360;
  const meanAnomaly = (357.528 + 0.9856003 * n) % 360;
  const gRad = meanAnomaly * D2R;
  const eclipticLongitude =
    meanLongitude + 1.915 * Math.sin(gRad) + 0.02 * Math.sin(2 * gRad);

  const obliquity = 23.439 - 0.0000004 * n;

  const lambdaRad = eclipticLongitude * D2R;
  const obliquityRad = obliquity * D2R;
  const rightAscension =
    Math.atan2(Math.cos(obliquityRad) * Math.sin(lambdaRad), Math.cos(lambdaRad)) * R2D;
  const declination = Math.asin(Math.sin(obliquityRad) * Math.sin(lambdaRad)) * R2D;

  return { gst, rightAscension, declination };
}

/** Latitude at which the sun sits at `altitudeDeg` (0 = horizon, negative = below), for a given hour angle/declination. */
function latitudeAtAltitude(hourAngleDeg: number, declinationDeg: number, altitudeDeg: number): number {
  const ha = hourAngleDeg * D2R;
  const delta = declinationDeg * D2R;
  const A = Math.sin(delta);
  const B = Math.cos(delta) * Math.cos(ha);
  const C = Math.sin(altitudeDeg * D2R);
  const R = Math.sqrt(A * A + B * B);

  const ratio = C / R;
  if (ratio > 1 || ratio < -1) return declinationDeg > 0 ? -90 : 90; // polar day/night at this longitude

  const phi = Math.atan2(B, A);
  let lat = (Math.asin(ratio) - phi) * R2D;
  if (lat > 90) lat -= 180;
  if (lat < -90) lat += 180;
  return lat;
}

function bandPolygon(sun: SunPosition, altitudeDeg: number): [number, number][][] {
  const points: [number, number][] = [];
  for (let lng = -180; lng <= 180; lng += 2) {
    const hourAngle = sun.gst + lng - sun.rightAscension;
    const lat = latitudeAtAltitude(hourAngle, sun.declination, altitudeDeg);
    points.push([lng, lat]);
  }
  const darkPole = sun.declination > 0 ? -90 : 90;
  return [[...points, [180, darkPole], [-180, darkPole], points[0]]];
}

/** Nested night-side bands from horizon to astronomical twilight, as one FeatureCollection with a per-feature opacity property. */
export function terminatorBands(
  at: Date = new Date()
): GeoJSON.FeatureCollection<GeoJSON.Polygon, { opacity: number }> {
  const sun = sunPositionAt(at);
  const features: GeoJSON.Feature<GeoJSON.Polygon, { opacity: number }>[] = [];

  for (let i = 0; i < BAND_COUNT; i++) {
    const altitude = -(i * MAX_DEPRESSION_DEG) / (BAND_COUNT - 1);
    features.push({
      type: "Feature",
      properties: { opacity: BAND_OPACITY },
      geometry: { type: "Polygon", coordinates: bandPolygon(sun, altitude) },
    });
  }

  return { type: "FeatureCollection", features };
}
