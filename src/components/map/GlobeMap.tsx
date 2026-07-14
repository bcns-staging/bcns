import { useEffect, useRef, useState, type FormEvent } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BEACONS, beaconArcs } from "./beacons";
import { flightLine, flightPosition } from "./flightPath";
import { createPlaneImage, fetchLiveTraffic, liveTrafficGeoJSON } from "./liveTraffic";

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const ACCENT = "#ffb703";
const SPEEDS = [1, 2, 4, 8] as const;
const BASE_FLIGHT_DURATION_MS = 25000;
const LIVE_POLL_MS = 8000;

type LiveStatus = "off" | "loading" | "ok" | "error";

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

  const [liveOn, setLiveOn] = useState(false);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("off");
  const liveOnRef = useRef(liveOn);
  useEffect(() => {
    liveOnRef.current = liveOn;
  }, [liveOn]);

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
    let liveTimeoutId: number;

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

      // Live traffic: real aircraft near NYC via our Worker proxy. Opt-in
      // (polling costs a free third-party API's quota), and degrades
      // gracefully — a failed/rate-limited poll just leaves the last known
      // positions in place and tries again next interval, never breaking
      // the simulated flight above.
      map.addImage("live-plane-icon", createPlaneImage(24, "#ff6b6b"));
      map.addSource("live-traffic", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "live-traffic",
        type: "symbol",
        source: "live-traffic",
        layout: {
          "icon-image": "live-plane-icon",
          "icon-rotate": ["get", "track"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-size": 0.7,
        },
      });

      const pollLive = async () => {
        if (liveOnRef.current) {
          setLiveStatus("loading");
          try {
            const aircraft = await fetchLiveTraffic();
            (map.getSource("live-traffic") as maplibregl.GeoJSONSource).setData(
              liveTrafficGeoJSON(aircraft)
            );
            setLiveStatus("ok");
          } catch {
            setLiveStatus("error");
          }
        }
        liveTimeoutId = window.setTimeout(pollLive, LIVE_POLL_MS);
      };
      pollLive();
    });

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(liveTimeoutId);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const toggleLive = () => {
    setLiveOn((on) => {
      const next = !on;
      if (!next) {
        const source = mapRef.current?.getSource("live-traffic") as
          | maplibregl.GeoJSONSource
          | undefined;
        source?.setData({ type: "FeatureCollection", features: [] });
        setLiveStatus("off");
      }
      return next;
    });
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

      <div className="live-controls">
        <button
          type="button"
          className={`flight-btn${liveOn ? " active" : ""}`}
          onClick={toggleLive}
        >
          {liveOn ? "Live traffic: on" : "Live traffic: off"}
        </button>
        {liveOn && (
          <span className="live-status">
            {liveStatus === "loading" && "fetching…"}
            {liveStatus === "ok" && "● live (NYC area)"}
            {liveStatus === "error" && "unavailable, retrying…"}
          </span>
        )}
      </div>

      <div ref={containerRef} className="globe-canvas" />
    </div>
  );
}
