const DEFAULT_CITY = "columbus";
const DEFAULT_ROTATE_SECONDS = 15
const DEFAULT_ZOOM = 13;

const CITIES = [
  { key: "columbus", name: "Columbus", lat: 39.9612, lon: -82.9988 },
  { key: "buffalo", name: "Buffalo", lat: 42.8864, lon: -78.8784 },
  { key: "chicago", name: "Chicago", lat: 41.8781, lon: -87.6298 },
  { key: "cleveland", name: "Cleveland", lat: 41.4993, lon: -81.6944 },
  { key: "detroit", name: "Detroit", lat: 42.3314, lon: -83.0458 },
  { key: "indianapolis", name: "Indianapolis", lat: 39.7684, lon: -86.1581 },
  { key: "pittsburgh", name: "Pittsburgh", lat: 40.4406, lon: -79.9959 }
];

let mapInstance = null;
let mapMarker = null;
let selectedCityKey = DEFAULT_CITY;
let muteAudio = false;

function getConfig() {
  const params = new URLSearchParams(window.location.search);
  const city = params.get("city") || DEFAULT_CITY;
  const rotate = Number(params.get("rotate")) || DEFAULT_ROTATE_SECONDS;
  return { city, rotate };
}

function getCityByKey(key) {
  return CITIES.find((city) => city.key === key) || CITIES[0];
}

function updateClock() {
  const el = document.getElementById("clock");
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString([], { hour12: false });
}

function weatherCodeToText(code) {
  const map = {
    0: "Soleado",
    1: "Mayormente soleado",
    2: "Parcialmente nublado",
    3: "Nublado",
    45: "Niebla",
    48: "Niebla densa",
    51: "Llovizna ligera",
    53: "Llovizna",
    55: "Llovizna intensa",
    61: "Lluvia ligera",
    63: "Lluvia",
    65: "Lluvia fuerte",
    71: "Nieve ligera",
    73: "Nieve",
    75: "Nieve intensa",
    80: "Chubascos",
    81: "Chubascos moderados",
    82: "Chubascos intensos",
    95: "Tormenta"
  };
  return map[code] || "Sin dato";
}

function windDirectionLabel(degrees) {
  if (!Number.isFinite(degrees)) return "--";
  const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
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
  if (age < 3.7) return "Luna nueva";
  if (age < 7.4) return "Creciente";
  if (age < 11.1) return "Primer cuarto";
  if (age < 14.8) return "Gibosa creciente";
  if (age < 18.5) return "Luna llena";
  if (age < 22.1) return "Gibosa menguante";
  if (age < 25.8) return "Ultimo cuarto";
  return "Menguante";
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
    { label: "Ultimo cuarto", age: 22.148 },
    { label: "Luna nueva", age: 0 },
    { label: "Primer cuarto", age: 7.3826 },
    { label: "Luna llena", age: 14.765 }
  ];

  const items = targets.map((phase) => {
    const dt = nextPhaseDate(phase.age, now);
    return `<li><span class="moon-name">${phase.label}</span><strong>${dt.toLocaleDateString()}</strong></li>`;
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
  setStatus(`Actualizando condiciones de ${city.name}...`);

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
    updatedEl.textContent = `Actualizado: ${new Date().toLocaleTimeString([], { hour12: false })}`;

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
    setStatus(`Conectado en tiempo real. Ciudad activa: ${city.name}.`);
  } catch (err) {
    setStatus(`Error de datos en ${city.name}: ${String(err).slice(0, 55)}`, true);
  }
}

async function loadObservations() {
  const body = document.getElementById("observationsBody");
  if (!body) return;

  const targets = CITIES.filter((city) => city.key !== selectedCityKey).slice(0, 6);

  try {
    const rows = await Promise.all(
      targets.map(async (city) => {
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
      })
    );

    body.innerHTML = rows.join("");
  } catch (_err) {
    body.innerHTML = "<tr><td colspan=\"5\">No se pudieron cargar observaciones regionales.</td></tr>";
  }
}

function updateMap(lat, lon) {
  const mapEl = document.getElementById("mapFrame");
  if (!mapEl) return;

  if (typeof window.L === "undefined") {
    mapEl.textContent = "Mapa no disponible";
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
    if (mapMarker) mapMarker.setLatLng([lat, lon]);
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
    const city = getCityByKey(selectedCityKey);
    updateMap(city.lat, city.lon);
    await loadCurrentConditions(city);
    await loadObservations();
  });

  themeToggle.addEventListener("click", () => {
    const light = document.body.classList.toggle("light");
    themeToggle.textContent = light ? "Modo Oscuro" : "Modo Claro";
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

function init() {
  const { city, rotate } = getConfig();
  const rotateSeconds = Math.max(rotate, 30);
  selectedCityKey = getCityByKey(city).key;

  setupControls(selectedCityKey);
  updateClock();
  window.setInterval(updateClock, 1000);

  const selected = getCityByKey(selectedCityKey);
  updateMap(selected.lat, selected.lon);
  refreshData();

  window.setInterval(refreshData, rotateSeconds * 1000);
  startMapTrafficRotation(30);
}

init();
