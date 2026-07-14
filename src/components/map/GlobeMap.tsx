import { useEffect, useRef, useState, type FormEvent } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { localTimeAt } from "./localTime";
import { LayersControl } from "./LayersControl";
import { terminatorBands } from "./dayNight";

const DRAG_CLOSE_THRESHOLD_PX = 80;
const DAY_NIGHT_UPDATE_MS = 60000;

// Liberty first - it's the default style on load (index 0 = initial map style).
const MAP_STYLES = [
  { id: "liberty", name: "Liberty", url: "https://tiles.openfreemap.org/styles/liberty" },
  { id: "dark", name: "Dark", url: "https://tiles.openfreemap.org/styles/dark" },
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
  const [dayNightOn, setDayNightOn] = useState(false);
  const [mapStyleId, setMapStyleId] = useState<(typeof MAP_STYLES)[number]["id"]>("liberty");
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
    map.addControl(new LayersControl(() => setLayersOpen((open) => !open)), "top-right");

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
    map.on("click", (e) => {
      timePopup?.remove();
      const { lng, lat } = e.lngLat;
      const { time, date, timeZone } = localTimeAt(lat, lng);
      timePopup = new maplibregl.Popup({ offset: 12 })
        .setLngLat([lng, lat])
        .setHTML(
          `<strong>${time}</strong><br/>${date}<br/><span class="time-offset">${timeZone}</span>`
        )
        .addTo(map);
    });

    // Auto-close the time popup once the map has been dragged a good
    // distance, rather than leaving it pinned somewhere no longer relevant.
    let dragStartCenter: maplibregl.LngLat | null = null;
    map.on("dragstart", () => {
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
      <form className="globe-search" onSubmit={handleSearch}>
        <input
          type="text"
          inputMode="decimal"
          placeholder="Latitude, longitude (e.g. 48.8566, 2.3522)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit">Go</button>
      </form>
      {error && <p className="globe-error">{error}</p>}

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
