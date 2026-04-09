"use client";

import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";

type Props = {
  cityName: string;
  lat: number;
  lon: number;
  cloudOpacity: number;
  cloudKey?: string;
};

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView([lat, lon], 9, { animate: true, duration: 1.2 });
  }, [lat, lon, map]);

  return null;
}

export default function CityWeatherMap({ cityName, lat, lon, cloudOpacity, cloudKey }: Props) {
  const cloudsUrl = cloudKey
    ? `https://tile.openweathermap.org/map/clouds/{z}/{x}/{y}.png?appid=${cloudKey}`
    : "";

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-sky-200/25">
      <MapContainer center={[lat, lon]} zoom={9} scrollWheelZoom={false} zoomControl={false} className="h-full w-full">
        <Recenter lat={lat} lon={lon} />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {cloudsUrl ? <TileLayer url={cloudsUrl} opacity={cloudOpacity} /> : null}
        <Marker position={[lat, lon]} icon={markerIcon} />
      </MapContainer>

      <div className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
        {cityName} Weather Map
      </div>

      {!cloudKey ? (
        <div className="absolute bottom-3 left-3 rounded-lg bg-amber-500/85 px-3 py-2 text-xs text-black">
          Add NEXT_PUBLIC_OPENWEATHER_API_KEY to enable live cloud tiles.
        </div>
      ) : null}
    </div>
  );
}
