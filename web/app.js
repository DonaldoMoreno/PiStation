const DEFAULT_LAT = 40.1365393;
const DEFAULT_LON = -83.1629969;
const DEFAULT_ROTATE_SECONDS = 30;
const DEFAULT_ZOOM = 11;

let mapInstance = null;
let mapMarker = null;

function getConfig() {
  const params = new URLSearchParams(window.location.search);
  const lat = Number(params.get("lat")) || DEFAULT_LAT;
  const lon = Number(params.get("lon")) || DEFAULT_LON;
  const rotate = Number(params.get("rotate")) || DEFAULT_ROTATE_SECONDS;
  return { lat, lon, rotate };
}

function updateClock() {
  const el = document.getElementById("clock");
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString([], { hour12: false });
}

function weatherCodeToText(code) {
  const map = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm"
  };
  return map[code] || "Unknown";
}

async function loadWeather(lat, lon) {
  const tempEl = document.getElementById("temp");
  const summaryEl = document.getElementById("summary");
  const locationEl = document.getElementById("location");
  const updatedEl = document.getElementById("updated");

  locationEl.textContent = `Lat ${lat.toFixed(4)}, Lon ${lon.toFixed(4)}`;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const temp = Math.round(data?.current?.temperature_2m);
    const code = data?.current?.weather_code;

    tempEl.textContent = Number.isFinite(temp) ? `${temp}°` : "--°";
    summaryEl.textContent = weatherCodeToText(code);
    updatedEl.textContent = `Updated: ${new Date().toLocaleTimeString([], { hour12: false })}`;
  } catch (err) {
    tempEl.textContent = "--°";
    summaryEl.textContent = "Weather unavailable";
    updatedEl.textContent = `Error: ${String(err).slice(0, 60)}`;
  }
}

function updateMap(lat, lon) {
  const mapEl = document.getElementById("mapFrame");
  if (!mapEl) return;

  if (typeof window.L === "undefined") {
    mapEl.textContent = "Map library unavailable";
    return;
  }

  if (!mapInstance) {
    mapInstance = window.L.map("mapFrame", {
      zoomControl: false,
      attributionControl: true
    }).setView([lat, lon], DEFAULT_ZOOM);

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(mapInstance);

    mapMarker = window.L.marker([lat, lon]).addTo(mapInstance);
  } else {
    mapInstance.setView([lat, lon], DEFAULT_ZOOM);
    if (mapMarker) {
      mapMarker.setLatLng([lat, lon]);
    }
  }

  // Ensure map tiles render correctly when panel becomes visible.
  window.setTimeout(() => mapInstance.invalidateSize(), 250);
}

function startRotation(seconds) {
  const panels = Array.from(document.querySelectorAll(".panel"));
  const info = document.getElementById("rotationInfo");
  if (panels.length < 2) return;

  let index = 0;
  const apply = () => {
    panels.forEach((panel, idx) => {
      panel.classList.toggle("active", idx === index);
    });
  };

  info.textContent = `Switching view every ${seconds}s`;
  apply();

  window.setInterval(() => {
    index = (index + 1) % panels.length;
    apply();
  }, seconds * 1000);
}

function init() {
  const { lat, lon, rotate } = getConfig();

  updateClock();
  window.setInterval(updateClock, 1000);

  updateMap(lat, lon);
  loadWeather(lat, lon);
  window.setInterval(() => loadWeather(lat, lon), 10 * 60 * 1000);

  startRotation(rotate);
}

init();
