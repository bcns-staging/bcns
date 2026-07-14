import { useEffect, useRef, useState, type FormEvent } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { localTimeAt } from "./localTime";
import { IconButtonControl } from "./IconButtonControl";
import { terminatorBands } from "./dayNight";
import { fetchPlaceInfo } from "./placeInfo";
import { fetchSeaName } from "./seaName";

const LAYERS_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12,16L19.36,10.27L21,9L12,2L3,9L4.63,10.27M12,18.54L4.62,12.81L3,14.07L12,21.07L21,14.07L19.37,12.8L12,18.54Z" /></svg>';
const SEARCH_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M15.5,14H14.71L14.43,13.73C15.41,12.59 16,11.11 16,9.5A6.5,6.5 0 0,0 9.5,3A6.5,6.5 0 0,0 3,9.5A6.5,6.5 0 0,0 9.5,16C11.11,16 12.59,15.41 13.73,14.43L14,14.71V15.5L19,20.49L20.49,19L15.5,14M9.5,14C7,14 5,12 5,9.5C5,7 7,5 9.5,5C12,5 14,7 14,9.5C14,12 12,14 9.5,14Z" /></svg>';

const DRAG_CLOSE_THRESHOLD_PX = 80;
const DAY_NIGHT_UPDATE_MS = 60000;
const SPIN_SECONDS_PER_REVOLUTION = 120; // one full turn every 2 minutes
const SPIN_MAX_ZOOM = 5; // stop auto-spin once zoomed in this far, spin gesture stops making sense

// Dark first - it's the default style on load (index 0 = initial map style).
const MAP_STYLES = [
  { id: "dark", name: "Dark", url: "https://tiles.openfreemap.org/styles/dark" },
  { id: "liberty", name: "Liberty", url: "https://tiles.openfreemap.org/styles/liberty" },
  { id: "positron", name: "Positron (light)", url: "https://tiles.openfreemap.org/styles/positron" },
  { id: "bright", name: "Bright", url: "https://tiles.openfreemap.org/styles/bright" },
  { id: "fiord", name: "Fiord", url: "https://tiles.openfreemap.org/styles/fiord" },
] as const;

function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const match = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export default function GlobeMap() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dayNightOn, setDayNightOn] = useState(false);
  const [mapStyleId, setMapStyleId] = useState<(typeof MAP_STYLES)[number]["id"]>("dark");
  const dayNightOnRef = useRef(dayNightOn);
  useEffect(() => {
    dayNightOnRef.current = dayNightOn;
  }, [dayNightOn]);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLES[0].url,
      center: [0, 20],
      zoom: 1.5,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    // Fullscreens the whole wrapper (map + search bar), not just the canvas,
    // so the search bar is still usable while fullscreen.
    map.addControl(
      new maplibregl.FullscreenControl({ container: wrapRef.current ?? undefined }),
      "top-right"
    );
    map.addControl(
      new IconButtonControl(LAYERS_ICON, "Layers", () => {
        setSearchOpen(false);
        setLayersOpen((open) => !open);
      }),
      "top-right"
    );
    map.addControl(
      new IconButtonControl(SEARCH_ICON, "Search", () => {
        setLayersOpen(false);
        setSearchOpen((open) => !open);
      }),
      "top-right"
    );

    // Slow ambient auto-rotation, stopped for good the moment the user
    // interacts (click or manually spinning it via drag).
    let spinEnabled = true;
    const spinGlobe = () => {
      if (!spinEnabled || map.getZoom() >= SPIN_MAX_ZOOM) return;
      const center = map.getCenter();
      center.lng -= 360 / SPIN_SECONDS_PER_REVOLUTION;
      map.easeTo({ center, duration: 1000, easing: (n) => n });
    };
    map.on("moveend", spinGlobe);
    spinGlobe();

    // Runs on initial load AND again after every setStyle() call (switching
    // base style), since setStyle replaces the whole style - our custom
    // source/layer need re-adding each time, restoring whatever the current
    // toggle state is rather than always defaulting off.
    map.on("style.load", () => {
      map.setProjection({ type: "globe" });

      map.addSource("day-night", { type: "geojson", data: terminatorBands() });
      // Inserted before the first label/symbol layer (recomputed per style,
      // since each base style names its layers differently) so it paints
      // under place-name text instead of dimming it too.
      const firstSymbolId = map.getStyle()?.layers?.find((l) => l.type === "symbol")?.id;
      // Many nested twilight-depth bands as features in one layer, each with
      // its own low opacity (set per-feature in terminatorBands) - stacked
      // largest-to-smallest so they overlap into a soft gradient toward full
      // night instead of one hard edge.
      map.addLayer(
        {
          id: "day-night",
          type: "fill",
          source: "day-night",
          layout: { visibility: dayNightOnRef.current ? "visible" : "none" },
          // Pure black rather than a tinted navy: alpha-blending a colored
          // overlay onto the light/warm base styles (Bright, Liberty) shifts
          // the result toward a muddy brown instead of reading as "night".
          // Black darkens any base color cleanly without a hue shift.
          paint: { "fill-color": "#000000", "fill-opacity": ["get", "opacity"] },
        },
        firstSymbolId
      );
    });

    const dayNightIntervalId = window.setInterval(() => {
      const source = map.getSource("day-night") as maplibregl.GeoJSONSource | undefined;
      source?.setData(terminatorBands());
    }, DAY_NIGHT_UPDATE_MS);

    let timePopup: maplibregl.Popup | null = null;
    let clickId = 0;
    map.on("click", async (e) => {
      spinEnabled = false;
      timePopup?.remove();
      timePopup = null;
      const thisClick = ++clickId;
      const { lng, lat } = e.lngLat;
      const { time, date, timeZone, utcOffset } = localTimeAt(lat, lng);

      const place = await fetchPlaceInfo(lat, lng).catch(() => null);
      let location = place ? [place.city, place.state, place.countryCode].filter(Boolean).join(", ") : "";

      // No address (Nominatim doesn't index open water) - try the ocean/sea
      // instead, so clicking water isn't just silent on the location line.
      if (!location) {
        location = (await fetchSeaName(lat, lng).catch(() => null)) ?? "";
      }

      // A newer click happened while these lookups were in flight - drop it,
      // the later click's own popup already took over.
      if (thisClick !== clickId) return;
      const html = `
        <div class="place-popup">
          ${location ? `<div class="place-popup-location">${location}</div>` : ""}
          <div class="place-popup-time">${time}</div>
          <div class="place-popup-date">${date}</div>
          <div class="place-popup-tz">${timeZone}${utcOffset ? ` &middot; ${utcOffset}` : ""}</div>
        </div>
      `;

      timePopup = new maplibregl.Popup({ offset: 12 }).setLngLat([lng, lat]).setHTML(html).addTo(map);
    });

    // Auto-close the time popup once the map has been dragged a good
    // distance, rather than leaving it pinned somewhere no longer relevant.
    let dragStartCenter: maplibregl.LngLat | null = null;
    map.on("dragstart", () => {
      spinEnabled = false;
      dragStartCenter = map.getCenter();
    });
    map.on("drag", () => {
      if (!dragStartCenter || !timePopup) return;
      const startPx = map.project(dragStartCenter);
      const centerPx = map.project(map.getCenter());
      const dx = startPx.x - centerPx.x;
      const dy = startPx.y - centerPx.y;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_CLOSE_THRESHOLD_PX) {
        timePopup.remove();
        timePopup = null;
      }
    });

    return () => {
      window.clearInterval(dayNightIntervalId);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    map.setLayoutProperty("day-night", "visibility", dayNightOn ? "visible" : "none");
  }, [dayNightOn]);

  const handleStyleChange = (id: (typeof MAP_STYLES)[number]["id"]) => {
    const style = MAP_STYLES.find((s) => s.id === id);
    if (!style) return;
    setMapStyleId(id);
    mapRef.current?.setStyle(style.url);
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const coords = parseCoordinates(query);
    if (!coords) {
      setError("Enter coordinates as \"lat, lng\", e.g. 35.6762, 139.6503");
      return;
    }
    setError(null);
    mapRef.current?.flyTo({
      center: [coords.lng, coords.lat],
      zoom: 5,
      duration: 2000,
    });
  };

  return (
    <div className="globe-wrap" ref={wrapRef}>
      {searchOpen && (
        <div className="layers-panel">
          <div className="layers-panel-header">
            <span>Search coordinates</span>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
            >
              &times;
            </button>
          </div>
          <form className="search-form" onSubmit={handleSearch}>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Latitude, longitude (e.g. 48.8566, 2.3522)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <button type="submit">Go</button>
            {error && <p className="search-error">{error}</p>}
          </form>
        </div>
      )}

      {layersOpen && (
        <div className="layers-panel">
          <div className="layers-panel-header">
            <span>Layers</span>
            <button
              type="button"
              onClick={() => setLayersOpen(false)}
              aria-label="Close layers panel"
            >
              &times;
            </button>
          </div>

          <p className="layers-section-label">Base style</p>
          {MAP_STYLES.map((style) => (
            <label className="layers-item" key={style.id}>
              <input
                type="radio"
                name="map-style"
                checked={mapStyleId === style.id}
                onChange={() => handleStyleChange(style.id)}
              />
              {style.name}
            </label>
          ))}

          <p className="layers-section-label">Overlays</p>
          <label className="layers-item">
            <input
              type="checkbox"
              checked={dayNightOn}
              onChange={(e) => setDayNightOn(e.target.checked)}
            />
            Day / night terminator
          </label>
        </div>
      )}

      <div ref={containerRef} className="globe-canvas" />
    </div>
  );
}
