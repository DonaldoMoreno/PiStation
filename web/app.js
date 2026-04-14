const DEFAULT_CITY = "east-liberty";
const DEFAULT_ROTATE_SECONDS = 180;
const DEFAULT_ZOOM = 11;
const DEFAULT_MAP_LAT = 40.1757512;
const DEFAULT_MAP_LON = -83.4734908;

// Fixed route: Astemo Americas East Liberty → OSU Airport Columbus
const ROUTE_ORIGIN = { lat: 40.279223, lon: -83.54381,   label: "Astemo Americas" };
const ROUTE_DEST   = { lat: 40.0774611, lon: -83.0734688, label: "OSU Airport" };

const CITIES = [
  { key: "columbus", name: "Columbus", lat: 39.9612, lon: -82.9988 },
  { key: "east-liberty", name: "East Liberty", lat: 40.279304, lon: -83.543514 },
  { key: "dublin", name: "Dublin", lat: 40.0992, lon: -83.1141 },
  { key: "marysville", name: "Marysville", lat: 40.2364, lon: -83.3671 },
  { key: "springfield-oh", name: "Springfield", lat: 39.9242, lon: -83.8088 },
  { key: "dayton", name: "Dayton", lat: 39.7589, lon: -84.1916 },
  { key: "cincinnati", name: "Cincinnati", lat: 39.1031, lon: -84.5120 },
  { key: "toledo", name: "Toledo", lat: 41.6528, lon: -83.5379 },
  { key: "akron", name: "Akron", lat: 41.0814, lon: -81.5190 },
  { key: "buffalo", name: "Buffalo", lat: 42.8864, lon: -78.8784 },
  { key: "chicago", name: "Chicago", lat: 41.8781, lon: -87.6298 },
  { key: "cleveland", name: "Cleveland", lat: 41.4993, lon: -81.6944 },
  { key: "detroit", name: "Detroit", lat: 42.3314, lon: -83.0458 },
  { key: "indianapolis", name: "Indianapolis", lat: 39.7684, lon: -86.1581 },
  { key: "pittsburgh", name: "Pittsburgh", lat: 40.4406, lon: -79.9959 }
];

let mapInstance = null;
let mapMarker = null;
let routeLayer = null;
let selectedCityKey = DEFAULT_CITY;
let muteAudio = false;

function getConfig() {
  const params = new URLSearchParams(window.location.search);
  const city = params.get("city") || DEFAULT_CITY;
  const rotate = Number(params.get("rotate")) || DEFAULT_ROTATE_SECONDS;
  const latParam = Number(params.get("lat"));
  const lonParam = Number(params.get("lon"));
  const zoomParam = Number(params.get("zoom"));
  const enableTraffic = ["1", "true", "yes", "on"].includes((params.get("traffic") || "").toLowerCase());
  const liteParam = (params.get("lite") || "1").toLowerCase();
  const liteMode = !["0", "false", "no", "off"].includes(liteParam);
  const panelMode = (params.get("panels") || "single").toLowerCase();
  const panelRotate = Number(params.get("panelRotate")) || 30;
  const singlePanelMode = panelMode !== "grid";
  const mapLat = Number.isFinite(latParam) ? latParam : DEFAULT_MAP_LAT;
  const mapLon = Number.isFinite(lonParam) ? lonParam : DEFAULT_MAP_LON;
  const mapZoom = Number.isFinite(zoomParam) ? Math.max(6, Math.min(15, zoomParam)) : DEFAULT_ZOOM;
  return { city, rotate, mapLat, mapLon, mapZoom, enableTraffic, liteMode, singlePanelMode, panelRotate };
}

function getCityByKey(key) {
  return CITIES.find((city) => city.key === key) || CITIES[0];
}

function updateClock() {
  const el = document.getElementById("clock");
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function weatherCodeToText(code) {
  const map = {
    0: "Sunny",
    1: "Mostly sunny",
    2: "Partly cloudy",
    3: "Cloudy",
    45: "Fog",
    48: "Dense fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Showers",
    81: "Moderate showers",
    82: "Heavy showers",
    95: "Thunderstorm"
  };
  return map[code] || "No data";
}

function windDirectionLabel(degrees) {
  if (!Number.isFinite(degrees)) return "--";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(((degrees % 360) / 45)) % 8;
  return dirs[idx];
}

function weatherIconForCode(code) {
  if (code === 0 || code === 1) {
    return { icon: "☀", className: "sunny" };
  }
  if ([2, 3, 45, 48].includes(code)) {
    return { icon: "☁", className: "cloudy" };
  }
  if ([61, 63, 65, 80, 81, 82, 51, 53, 55].includes(code)) {
    return { icon: "☂", className: "rainy" };
  }
  if (code === 95) {
    return { icon: "⚡", className: "storm" };
  }
  return { icon: "◌", className: "cloudy" };
}

function formatShortTime(iso) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "--:--";
  return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function phaseAge(date) {
  const newMoonRef = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const synodicMonth = 29.53058867;
  const age = ((date - newMoonRef) / 86400000) % synodicMonth;
  return age < 0 ? age + synodicMonth : age;
}

function moonPhaseName(age) {
  if (age < 3.7) return "New Moon";
  if (age < 7.4) return "Waxing Crescent";
  if (age < 11.1) return "First Quarter";
  if (age < 14.8) return "Waxing Gibbous";
  if (age < 18.5) return "Full Moon";
  if (age < 22.1) return "Waning Gibbous";
  if (age < 25.8) return "Last Quarter";
  return "Waning Crescent";
}

function nextPhaseDate(targetAge, fromDate) {
  const synodicMonth = 29.53058867;
  const currentAge = phaseAge(fromDate);
  const delta = (targetAge - currentAge + synodicMonth) % synodicMonth;
  const date = new Date(fromDate.getTime() + delta * 86400000);
  return date;
}

function updateMoonVisual(age) {
  const disc = document.querySelector(".moon-disc");
  if (!disc) return;
  const waxing = age <= 14.765;
  const ratio = Math.abs((age - 14.765) / 14.765);
  const shadow = Math.round(100 * ratio);
  disc.style.background = waxing
    ? `linear-gradient(90deg, #0f2247 ${shadow}%, rgba(255,255,255,0.9) ${shadow}%)`
    : `linear-gradient(90deg, rgba(255,255,255,0.9) ${shadow}%, #0f2247 ${shadow}%)`;
}

function renderMoonPhases(now) {
  const phaseList = document.getElementById("moonPhases");
  if (!phaseList) return;

  const targets = [
    { label: "Last Quarter", age: 22.148, icon: "🌗" },
    { label: "New Moon", age: 0, icon: "🌑" },
    { label: "First Quarter", age: 7.3826, icon: "🌓" },
    { label: "Full Moon", age: 14.765, icon: "🌕" }
  ];

  const entries = targets
    .map((phase) => ({
      ...phase,
      date: nextPhaseDate(phase.age, now)
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const items = entries.map((phase) => {
    const formattedDate = phase.date.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
    return `<li><span class="moon-icon" aria-hidden="true">${phase.icon}</span><span class="moon-name">${phase.label}</span><strong class="moon-date">${formattedDate}</strong></li>`;
  });

  phaseList.innerHTML = items.join("");
  updateMoonVisual(phaseAge(now));
}

function setStatus(text, isError = false) {
  const status = document.getElementById("statusInfo");
  if (!status) return;
  status.textContent = text;
  status.classList.toggle("status-ok", !isError);
}

async function loadCurrentConditions(city) {
  const tempEl = document.getElementById("temp");
  const summaryEl = document.getElementById("summary");
  const cityEl = document.getElementById("selectedCity");
  const locationEl = document.getElementById("location");
  const updatedEl = document.getElementById("updated");
  const humidityEl = document.getElementById("humidity");
  const dewPointEl = document.getElementById("dewPoint");
  const visibilityEl = document.getElementById("visibility");
  const pressureEl = document.getElementById("pressure");
  const heatIndexEl = document.getElementById("heatIndex");
  const windEl = document.getElementById("wind");
  const sunriseEl = document.getElementById("sunrise");
  const sunsetEl = document.getElementById("sunset");
  const iconEl = document.getElementById("weatherIcon");

  cityEl.textContent = city.name;
  locationEl.textContent = `Lat ${city.lat.toFixed(4)}, Lon ${city.lon.toFixed(4)}`;
  setStatus(`Updating conditions for ${city.name}...`);

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,weather_code,relative_humidity_2m,dew_point_2m,visibility,pressure_msl,apparent_temperature,wind_speed_10m,wind_direction_10m&daily=sunrise,sunset&timezone=auto`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const current = data?.current || {};

    const temp = Math.round(current.temperature_2m);
    const humidity = Math.round(current.relative_humidity_2m);
    const dewPoint = Math.round(current.dew_point_2m);
    const visibilityKm = Number.isFinite(current.visibility) ? current.visibility / 1000 : NaN;
    const pressure = Math.round(current.pressure_msl);
    const heatIndex = Math.round(current.apparent_temperature);
    const windSpeed = Math.round(current.wind_speed_10m);
    const windDirection = windDirectionLabel(current.wind_direction_10m);
    const code = current.weather_code;

    tempEl.textContent = Number.isFinite(temp) ? `${temp}°` : "--°";
    summaryEl.textContent = weatherCodeToText(code);
    updatedEl.textContent = `Updated: ${new Date().toLocaleTimeString([], { hour12: false })}`;

    humidityEl.textContent = Number.isFinite(humidity) ? `${humidity}%` : "--%";
    dewPointEl.textContent = Number.isFinite(dewPoint) ? `${dewPoint}°` : "--°";
    visibilityEl.textContent = Number.isFinite(visibilityKm) ? `${visibilityKm.toFixed(1)} km` : "-- km";
    pressureEl.textContent = Number.isFinite(pressure) ? `${pressure} hPa` : "-- hPa";
    heatIndexEl.textContent = Number.isFinite(heatIndex) ? `${heatIndex}°` : "--°";
    windEl.textContent = Number.isFinite(windSpeed) ? `${windDirection} ${windSpeed} km/h` : "--";

    sunriseEl.textContent = formatShortTime(data?.daily?.sunrise?.[0]);
    sunsetEl.textContent = formatShortTime(data?.daily?.sunset?.[0]);

    const icon = weatherIconForCode(code);
    iconEl.textContent = icon.icon;
    iconEl.className = `weather-icon ${icon.className}`;

    renderMoonPhases(new Date());
    setStatus(`Live data connected. Active city: ${city.name}.`);
  } catch (err) {
    setStatus(`Data error in ${city.name}: ${String(err).slice(0, 55)}`, true);
  }
}

async function loadObservations() {
  const body = document.getElementById("observationsBody");
  if (!body) return;

  const targets = CITIES.filter((city) => city.key !== selectedCityKey).slice(0, 6);

  const rows = await Promise.all(
    targets.map(async (city) => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("no-data");
        const data = await res.json();
        const current = data?.current || {};

        const temp = Math.round(current.temperature_2m);
        const weather = weatherCodeToText(current.weather_code);
        const dir = windDirectionLabel(current.wind_direction_10m);
        const speed = Math.round(current.wind_speed_10m);

        return `
          <tr>
            <td>${city.name}</td>
            <td>${Number.isFinite(temp) ? `${temp}°` : "--"}</td>
            <td>${weather}</td>
            <td>${dir}</td>
            <td>${Number.isFinite(speed) ? `${speed} km/h` : "--"}</td>
          </tr>`;
      } catch (_err) {
        return `
          <tr>
            <td>${city.name}</td>
            <td>--</td>
            <td>No data</td>
            <td>--</td>
            <td>--</td>
          </tr>`;
      }
    })
  );

  body.innerHTML = rows.join("");
}

function updateMap(lat, lon, zoom = DEFAULT_ZOOM) {
  const mapEl = document.getElementById("mapFrame");
  if (!mapEl) return;

  if (typeof window.L === "undefined") {
    mapEl.textContent = "Map unavailable";
    return;
  }

  if (!mapInstance) {
    mapInstance = window.L.map("mapFrame", {
      zoomControl: false,
      attributionControl: true
    }).setView([lat, lon], zoom);

    window.L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      subdomains: "abcd",
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
    }).addTo(mapInstance);
  } else {
    mapInstance.setView([lat, lon], zoom);
  }

  window.setTimeout(() => mapInstance.invalidateSize(), 220);
}

async function loadRoute() {
  if (!mapInstance) return;

  if (routeLayer) {
    mapInstance.removeLayer(routeLayer);
    routeLayer = null;
  }

  const startIcon = window.L.divIcon({
    className: "",
    html: '<div class="route-pin route-pin--start"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
  const endIcon = window.L.divIcon({
    className: "",
    html: '<div class="route-pin route-pin--end"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  routeLayer = window.L.layerGroup();

  window.L.marker([ROUTE_ORIGIN.lat, ROUTE_ORIGIN.lon], { icon: startIcon })
    .bindTooltip(ROUTE_ORIGIN.label, { permanent: true, direction: "top", className: "route-tooltip" })
    .addTo(routeLayer);

  window.L.marker([ROUTE_DEST.lat, ROUTE_DEST.lon], { icon: endIcon })
    .bindTooltip(ROUTE_DEST.label, { permanent: true, direction: "bottom", className: "route-tooltip" })
    .addTo(routeLayer);

  routeLayer.addTo(mapInstance);

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${ROUTE_ORIGIN.lon},${ROUTE_ORIGIN.lat};${ROUTE_DEST.lon},${ROUTE_DEST.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const route = data.routes[0];
    const coords = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);

    window.L.polyline(coords, {
      color: "#1a73e8",
      weight: 7,
      opacity: 0.88,
      lineJoin: "round",
      lineCap: "round"
    }).addTo(routeLayer);

    const bounds = window.L.latLngBounds(coords);
    mapInstance.fitBounds(bounds, { padding: [48, 48] });

    // Update route legend
    const durationMin = Math.round(route.duration / 60);
    const distanceMiles = (route.distance / 1609.344).toFixed(1);
    const legend = document.getElementById("routeLegend");
    if (legend) {
      legend.innerHTML = `
        <span class="route-legend-icon">&#x1F697;</span>
        <span class="route-legend-time">${durationMin} min</span>
        <span class="route-legend-sep">&bull;</span>
        <span class="route-legend-dist">${distanceMiles} mi</span>`;
      legend.classList.add("route-legend--loaded");
    }
  } catch (err) {
    // Route unavailable; markers still shown
    mapInstance.setView([DEFAULT_MAP_LAT, DEFAULT_MAP_LON], DEFAULT_ZOOM);
    console.warn("Route fetch failed:", err);
  }

  window.setTimeout(() => mapInstance.invalidateSize(), 220);
}

function playTransitionTone() {
  if (muteAudio) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  const ctx = new AC();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.value = 860;
  gain.gain.value = 0.02;

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
}

function startMapTrafficRotation(seconds) {
  const baseMap = document.getElementById("mapFrame");
  const traffic = document.getElementById("trafficFrame");
  const label = document.getElementById("mapModeLabel");
  if (!baseMap || !traffic || !label) return;

  const trafficSrc = traffic.getAttribute("data-src");
  if (trafficSrc && !traffic.getAttribute("src")) {
    traffic.setAttribute("src", trafficSrc);
  }

  let showTraffic = false;
  const applyMode = () => {
    baseMap.classList.toggle("visible", !showTraffic);
    traffic.classList.toggle("visible", showTraffic);
    label.textContent = showTraffic ? "TRAFFIC" : "BASE MAP";
    playTransitionTone();
  };

  applyMode();
  window.setInterval(() => {
    showTraffic = !showTraffic;
    applyMode();
  }, seconds * 1000);
}

function setupControls(initialCityKey) {
  const citySelect = document.getElementById("citySelect");
  const themeToggle = document.getElementById("themeToggle");
  const audioToggle = document.getElementById("audioToggle");
  if (!citySelect || !themeToggle || !audioToggle) return;

  citySelect.innerHTML = CITIES.map((city) => `<option value="${city.key}">${city.name}</option>`).join("");
  citySelect.value = initialCityKey;

  citySelect.addEventListener("change", async (event) => {
    selectedCityKey = event.target.value;
    await loadCurrentConditions(getCityByKey(selectedCityKey));
    await loadObservations();
  });

  themeToggle.addEventListener("click", () => {
    const light = document.body.classList.toggle("light");
    themeToggle.textContent = light ? "Dark Mode" : "Light Mode";
    themeToggle.setAttribute("aria-pressed", String(light));
  });

  audioToggle.addEventListener("click", () => {
    muteAudio = !muteAudio;
    audioToggle.textContent = muteAudio ? "Audio: OFF" : "Audio: ON";
    audioToggle.setAttribute("aria-pressed", String(muteAudio));
  });
}

async function refreshData() {
  const city = getCityByKey(selectedCityKey);
  await loadCurrentConditions(city);
  await loadObservations();
}

function startPanelRotation(seconds, mapLat, mapLon, mapZoom) {
  const panels = Array.from(document.querySelectorAll(".grid-windows > article"));
  if (panels.length === 0) return;

  let activeIndex = 0;
  const intervalSeconds = Math.max(seconds, 10);

  const setActivePanel = (index) => {
    panels.forEach((panel, idx) => {
      panel.classList.toggle("panel-active", idx === index);
    });

    const hasMap = panels[index]?.querySelector("#mapFrame");
    if (hasMap) {
      if (!mapInstance) {
        // First time the map panel is visible: initialize Leaflet now
        window.setTimeout(() => {
          updateMap(mapLat, mapLon, mapZoom);
          loadRoute();
        }, 80);
      } else {
        window.setTimeout(() => mapInstance.invalidateSize(), 180);
      }
    }
  };

  setActivePanel(activeIndex);
  window.setInterval(() => {
    activeIndex = (activeIndex + 1) % panels.length;
    setActivePanel(activeIndex);
  }, intervalSeconds * 1000);
}

function init() {
  const { city, rotate, mapLat, mapLon, mapZoom, enableTraffic, liteMode, singlePanelMode, panelRotate } = getConfig();
  const rotateSeconds = Math.max(rotate, 120);
  selectedCityKey = getCityByKey(city).key;

  document.body.classList.toggle("panel-single", singlePanelMode);
  document.body.classList.toggle("lite", liteMode);

  setupControls(selectedCityKey);
  updateClock();
  window.setInterval(updateClock, 30000);

  if (!singlePanelMode) {
    // Grid mode: map container is always visible, safe to init now
    updateMap(mapLat, mapLon, mapZoom);
    loadRoute();
  }

  refreshData();

  window.setInterval(refreshData, rotateSeconds * 1000);
  if (singlePanelMode) {
    startPanelRotation(panelRotate, mapLat, mapLon, mapZoom);
  }

  if (enableTraffic) {
    startMapTrafficRotation(30);
  }
}

init();
