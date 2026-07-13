import { useEffect, useRef, useState, type FormEvent } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BEACONS, beaconArcs } from "./beacons";
import { flightLine, flightPosition } from "./flightPath";

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const ACCENT = "#ffb703";
const SPEEDS = [1, 2, 4, 8] as const;
const BASE_FLIGHT_DURATION_MS = 25000;

const PLANE_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2 L19 21 L12 17 L5 21 Z" /></svg>';

function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const match = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export default function GlobeMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [0, 20],
      zoom: 1.5,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    let rafId: number;

    map.on("style.load", () => {
      map.setProjection({ type: "globe" });

      map.addSource("beacon-arcs", { type: "geojson", data: beaconArcs() });
      map.addLayer({
        id: "beacon-arcs",
        type: "line",
        source: "beacon-arcs",
        paint: {
          "line-color": ACCENT,
          "line-width": 1.5,
          "line-opacity": 0.55,
        },
      });

      for (const beacon of BEACONS) {
        const el = document.createElement("div");
        el.className = "beacon-marker";
        el.innerHTML = '<span class="beacon-dot"></span>';

        const popup = new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(
          `<strong>${beacon.name}</strong><br/>${beacon.description}`
        );

        new maplibregl.Marker({ element: el })
          .setLngLat([beacon.lng, beacon.lat])
          .setPopup(popup)
          .addTo(map);
      }

      // Flight tracker: NY -> SF, animated along the great-circle route.
      map.addSource("flight-path", { type: "geojson", data: flightLine() });
      map.addLayer({
        id: "flight-path",
        type: "line",
        source: "flight-path",
        paint: {
          "line-color": "#8fd3ff",
          "line-width": 1.5,
          "line-dasharray": [1, 1.5],
          "line-opacity": 0.6,
        },
      });

      const planeEl = document.createElement("div");
      planeEl.className = "plane-marker";
      planeEl.innerHTML = PLANE_ICON;

      const planeMarker = new maplibregl.Marker({ element: planeEl, rotationAlignment: "map" })
        .setLngLat([flightPosition(0).lng, flightPosition(0).lat])
        .addTo(map);

      let progress = 0;
      let lastTime: number | null = null;

      const tick = (timestamp: number) => {
        if (lastTime === null) lastTime = timestamp;
        const dt = timestamp - lastTime;
        lastTime = timestamp;

        if (playingRef.current) {
          progress += (dt * speedRef.current) / BASE_FLIGHT_DURATION_MS;
          if (progress > 1) progress -= 1;
        }

        const pos = flightPosition(progress);
        planeMarker.setLngLat([pos.lng, pos.lat]);
        planeMarker.setRotation(pos.heading);

        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(rafId);
      map.remove();
      mapRef.current = null;
    };
  }, []);

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
    <div className="globe-wrap">
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

      <div className="flight-controls">
        <button
          type="button"
          className="flight-btn"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause flight" : "Play flight"}
        >
          {playing ? "Pause" : "Play"}
        </button>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={`flight-btn${speed === s ? " active" : ""}`}
            onClick={() => setSpeed(s)}
          >
            {s}x
          </button>
        ))}
      </div>

      <div ref={containerRef} className="globe-canvas" />
    </div>
  );
}
