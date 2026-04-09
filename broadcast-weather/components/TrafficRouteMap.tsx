"use client";

import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import L from "leaflet";

type LatLng = [number, number];

type RouteBase = {
  id: string;
  label: string;
  points: LatLng[];
  distanceKm: number;
  baseMin: number;
};

type RouteTraffic = RouteBase & {
  factor: number;
  adjustedMin: number;
  status: "flow" | "moderate" | "heavy";
  color: string;
};

type Props = {
  onInteract?: () => void;
};

const TRAFFIC_REFRESH_MS = 3 * 60 * 1000;

const ORIGIN = { name: "East Liberty", lat: 40.2801573, lon: -83.5452151 };
const DESTINATIONS = [
  { key: "dublin", name: "Dublin", lat: 40.0992, lon: -83.1141 },
  { key: "hilliard", name: "Hilliard", lat: 40.0334, lon: -83.1582 },
  { key: "downtown", name: "Downtown Columbus", lat: 39.9612, lon: -82.9988 }
] as const;
const PRIMARY_ROUTE_KEY = "dublin";

let cachedRoutes: RouteBase[] | null = null;
let cachedTraffic: RouteTraffic[] | null = null;

const pinIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

function toTraffic(base: RouteBase[]): RouteTraffic[] {
  return base.map((route) => {
    const factor = Number((Math.random() * (1.6 - 1.0) + 1.0).toFixed(2));
    const adjustedMin = Math.round(route.baseMin * factor);

    if (factor <= 1.15) {
      return {
        ...route,
        factor,
        adjustedMin,
        status: "flow",
        color: "#26d36b"
      };
    }

    if (factor <= 1.35) {
      return {
        ...route,
        factor,
        adjustedMin,
        status: "moderate",
        color: "#f7d541"
      };
    }

    return {
      ...route,
      factor,
      adjustedMin,
      status: "heavy",
      color: "#f24f4f"
    };
  });
}

async function fetchRoute(origin: typeof ORIGIN, destination: (typeof DESTINATIONS)[number]): Promise<RouteBase | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return null;

    const coordinates = (route.geometry?.coordinates ?? []) as Array<[number, number]>;
    const points: LatLng[] = coordinates.map(([lon, lat]) => [lat, lon]);
    const distanceKm = route.distance / 1000;
    const baseMin = route.duration / 60;

    return {
      id: destination.key,
      label: `${origin.name} -> ${destination.name}`,
      points,
      distanceKm: Number(distanceKm.toFixed(1)),
      baseMin: Number(baseMin.toFixed(1))
    };
  } catch {
    return null;
  }
}

function InteractionEvents({ onInteract }: { onInteract?: () => void }) {
  useMapEvents({
    click: () => onInteract?.(),
    mousedown: () => onInteract?.(),
    dragstart: () => onInteract?.(),
    zoomstart: () => onInteract?.()
  });

  return null;
}

function KeepMapSized() {
  const map = useMap();

  useEffect(() => {
    const first = window.setTimeout(() => map.invalidateSize(), 120);
    const second = window.setTimeout(() => map.invalidateSize(), 700);

    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(map.getContainer());
    }

    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
  }, [map]);

  return null;
}

export default function TrafficRouteMap({ onInteract }: Props) {
  const [loading, setLoading] = useState(!cachedRoutes);
  const [routes, setRoutes] = useState<RouteTraffic[]>(cachedTraffic ?? []);
  const [error, setError] = useState("");
  const [useFallbackTiles, setUseFallbackTiles] = useState(false);
  const updatedAt = useMemo(() => new Date().toLocaleTimeString([], { hour12: false }), [routes]);

  const tileUrl = useFallbackTiles
    ? "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const tileAttribution = useFallbackTiles
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, HOT style'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  const primaryRoute = routes.find((route) => route.id === PRIMARY_ROUTE_KEY) ?? routes[0];

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");

      if (!cachedRoutes) {
        const result = await Promise.all(DESTINATIONS.map((destination) => fetchRoute(ORIGIN, destination)));
        cachedRoutes = result.filter((route): route is RouteBase => Boolean(route));
      }

      if (!active) return;

      if (!cachedRoutes || cachedRoutes.length === 0) {
        setError("Could not load OSRM routes.");
        setLoading(false);
        return;
      }

      const traffic = toTraffic(cachedRoutes);
      cachedTraffic = traffic;
      setRoutes(traffic);
      setLoading(false);
    };

    load();

    const intervalId = window.setInterval(() => {
      if (!cachedRoutes || cachedRoutes.length === 0) return;
      const traffic = toTraffic(cachedRoutes);
      cachedTraffic = traffic;
      setRoutes(traffic);
    }, TRAFFIC_REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="grid h-full w-full gap-3 lg:grid-cols-[1fr_360px]">
      <div className="relative h-full min-h-0 overflow-hidden rounded-2xl border border-sky-200/25">
        <MapContainer center={[40.19, -83.33]} zoom={10} scrollWheelZoom={false} zoomControl={false} className="h-full w-full">
          <InteractionEvents onInteract={onInteract} />
          <KeepMapSized />
          <TileLayer
            url={tileUrl}
            attribution={tileAttribution}
            referrerPolicy="strict-origin-when-cross-origin"
            eventHandlers={{
              tileerror: () => {
                if (!useFallbackTiles) {
                  setUseFallbackTiles(true);
                }
              }
            }}
          />

          <Marker position={[ORIGIN.lat, ORIGIN.lon]} icon={pinIcon} />

          {primaryRoute ? (
            <Polyline
              key={primaryRoute.id}
              positions={primaryRoute.points}
              pathOptions={{
                color: primaryRoute.color,
                weight: 8,
                opacity: 0.92,
                lineJoin: "round"
              }}
            />
          ) : null}
        </MapContainer>

        {loading ? (
          <div className="absolute left-3 top-3 rounded-lg bg-black/60 px-3 py-2 text-xs text-sky-100">Loading OSRM routes...</div>
        ) : null}

        {error ? <div className="absolute left-3 top-3 rounded-lg bg-red-500/80 px-3 py-2 text-xs text-white">{error}</div> : null}

        {useFallbackTiles ? (
          <div className="absolute left-3 bottom-3 rounded-lg bg-amber-500/85 px-3 py-2 text-xs text-black">
            Primary OSM tiles blocked by referer policy. Using OSM HOT fallback.
          </div>
        ) : null}
      </div>

      <aside className="h-full overflow-auto rounded-2xl border border-sky-200/20 bg-black/55 p-3 text-white backdrop-blur-sm">
        <p className="text-xs uppercase tracking-[0.15em] text-sky-200">Simulated Travel Times</p>
        <ul className="mt-2 space-y-2">
          {routes.map((route) => (
            <li key={`panel-${route.id}`} className="rounded-lg bg-white/5 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{route.label}</span>
                <span className="text-xl font-bold">{route.adjustedMin} min</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-sky-100">
                <span>{route.distanceKm} km</span>
                <span>Base {route.baseMin} min</span>
                <span className="font-bold" style={{ color: route.color }}>
                  {route.status.toUpperCase()}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-sky-200">Updated: {updatedAt} • refresh every 3 min</p>
      </aside>
    </div>
  );
}
