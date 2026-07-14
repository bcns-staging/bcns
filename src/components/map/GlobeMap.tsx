import { useEffect, useRef, useState, type FormEvent } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BEACONS } from "./beacons";

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

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

    map.on("style.load", () => {
      map.setProjection({ type: "globe" });

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
    });

    return () => {
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

      <div ref={containerRef} className="globe-canvas" />
    </div>
  );
}
