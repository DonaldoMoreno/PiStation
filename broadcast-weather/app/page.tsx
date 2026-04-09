"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ROTATE_MS = 15000;
const WEATHER_REFRESH_MS = 5 * 60 * 1000;

const TrafficRouteMap = dynamic(() => import("@/components/TrafficRouteMap"), { ssr: false });

type City = {
  key: string;
  name: string;
  lat: number;
  lon: number;
};

type CurrentWeather = {
  temperature: string;
  condition: string;
  icon: string;
  humidity: string;
  wind: string;
  pressure: string;
  visibility: string;
  dewPoint: string;
  heatIndex: string;
};

type ObservationRow = {
  city: string;
  temp: string;
  condition: string;
  windDir: string;
  windSpeed: string;
};

type Almanac = {
  solarDays: Array<{ day: string; sunrise: string; sunset: string }>;
  moonNow: string;
  phases: Array<{ label: string; date: string }>;
};

const cities: City[] = [
  { key: "east-liberty-oh287", name: "East Liberty", lat: 40.2801573, lon: -83.5452151 },
  { key: "columbus", name: "Columbus", lat: 39.9612, lon: -82.9988 },
  { key: "buffalo", name: "Buffalo", lat: 42.8864, lon: -78.8784 },
  { key: "chicago", name: "Chicago", lat: 41.8781, lon: -87.6298 },
  { key: "cleveland", name: "Cleveland", lat: 41.4993, lon: -81.6944 },
  { key: "detroit", name: "Detroit", lat: 42.3314, lon: -83.0458 },
  { key: "indianapolis", name: "Indianapolis", lat: 39.7684, lon: -86.1581 },
  { key: "pittsburgh", name: "Pittsburgh", lat: 40.4406, lon: -79.9959 }
];

function weatherCodeToText(code: number | undefined) {
  const mapping: Record<number, string> = {
    0: "Sunny",
    1: "Mostly Sunny",
    2: "Partly Cloudy",
    3: "Cloudy",
    45: "Fog",
    48: "Dense Fog",
    51: "Light Drizzle",
    53: "Drizzle",
    55: "Heavy Drizzle",
    61: "Light Rain",
    63: "Rain",
    65: "Heavy Rain",
    71: "Light Snow",
    73: "Snow",
    75: "Heavy Snow",
    80: "Showers",
    81: "Rain Showers",
    82: "Heavy Showers",
    95: "Thunderstorm"
  };

  return mapping[code ?? -1] ?? "Unknown";
}

function iconForCode(code: number | undefined) {
  if (code === 0 || code === 1) return "☀";
  if ([2, 3, 45, 48].includes(code ?? -1)) return "☁";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code ?? -1)) return "☂";
  if (code === 95) return "⚡";
  return "◌";
}

function formatTime(iso: string | undefined) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatTime12h(iso: string | undefined) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatWeekday(iso: string | undefined) {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

function formatMonthDay(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toWindDirection(deg: number | undefined) {
  if (!Number.isFinite(deg)) return "--";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round((deg as number) / 45) % 8;
  return dirs[index];
}

function moonAge(date: Date) {
  const ref = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const synodic = 29.53058867;
  const age = ((date.getTime() - ref.getTime()) / 86400000) % synodic;
  return age < 0 ? age + synodic : age;
}

function moonName(age: number) {
  if (age < 3.7) return "New Moon";
  if (age < 7.4) return "Waxing Crescent";
  if (age < 11.1) return "First Quarter";
  if (age < 14.8) return "Waxing Gibbous";
  if (age < 18.5) return "Full Moon";
  if (age < 22.1) return "Waning Gibbous";
  if (age < 25.8) return "Last Quarter";
  return "Waning Crescent";
}

function nextPhase(targetAge: number, fromDate: Date) {
  const synodic = 29.53058867;
  const currentAge = moonAge(fromDate);
  const delta = (targetAge - currentAge + synodic) % synodic;
  return new Date(fromDate.getTime() + delta * 86400000);
}

function useTransitionTone(muted: boolean) {
  return useCallback(() => {
    if (muted) return;
    const AC = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;

    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 830;
    gain.gain.value = 0.018;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }, [muted]);
}

export default function Page() {
  const [cityKey, setCityKey] = useState("east-liberty-oh287");
  const [screen, setScreen] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isLight, setIsLight] = useState(false);
  const [muted, setMuted] = useState(false);
  const [clock, setClock] = useState("--:--:--");
  const [current, setCurrent] = useState<CurrentWeather>({
    temperature: "--°",
    condition: "Loading",
    icon: "◌",
    humidity: "--%",
    wind: "--",
    pressure: "-- hPa",
    visibility: "-- km",
    dewPoint: "--°",
    heatIndex: "--°"
  });
  const [observations, setObservations] = useState<ObservationRow[]>([]);
  const [almanac, setAlmanac] = useState<Almanac>({
    solarDays: [
      { day: "--", sunrise: "--:--", sunset: "--:--" },
      { day: "--", sunrise: "--:--", sunset: "--:--" }
    ],
    moonNow: "--",
    phases: []
  });

  const rotateTimerRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const transitionTone = useTransitionTone(muted);

  const city = useMemo(() => cities.find((c) => c.key === cityKey) ?? cities[0], [cityKey]);

  const loadCurrent = useCallback(async () => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m,wind_direction_10m,pressure_msl,visibility,dew_point_2m,apparent_temperature&daily=sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const now = data.current;

    setCurrent({
      temperature: Number.isFinite(now?.temperature_2m) ? `${Math.round(now.temperature_2m)}°F` : "--°F",
      condition: weatherCodeToText(now?.weather_code),
      icon: iconForCode(now?.weather_code),
      humidity: Number.isFinite(now?.relative_humidity_2m) ? `${Math.round(now.relative_humidity_2m)}%` : "--%",
      wind:
        Number.isFinite(now?.wind_speed_10m) && Number.isFinite(now?.wind_direction_10m)
          ? `${toWindDirection(now.wind_direction_10m)} ${Math.round(now.wind_speed_10m)} mph`
          : "--",
      pressure: Number.isFinite(now?.pressure_msl) ? `${Math.round(now.pressure_msl)} hPa` : "-- hPa",
      visibility: Number.isFinite(now?.visibility) ? `${(now.visibility / 1000).toFixed(1)} km` : "-- km",
      dewPoint: Number.isFinite(now?.dew_point_2m) ? `${Math.round(now.dew_point_2m)}°F` : "--°F",
      heatIndex: Number.isFinite(now?.apparent_temperature) ? `${Math.round(now.apparent_temperature)}°F` : "--°F"
    });

    const nowDate = new Date();
    const moon = moonAge(nowDate);
    setAlmanac({
      solarDays: [
        {
          day: formatWeekday(data?.daily?.sunrise?.[0]),
          sunrise: formatTime12h(data?.daily?.sunrise?.[0]),
          sunset: formatTime12h(data?.daily?.sunset?.[0])
        },
        {
          day: formatWeekday(data?.daily?.sunrise?.[1]),
          sunrise: formatTime12h(data?.daily?.sunrise?.[1]),
          sunset: formatTime12h(data?.daily?.sunset?.[1])
        }
      ],
      moonNow: moonName(moon),
      phases: [
        { label: "Last", date: formatMonthDay(nextPhase(22.148, nowDate)) },
        { label: "New", date: formatMonthDay(nextPhase(0, nowDate)) },
        { label: "First", date: formatMonthDay(nextPhase(7.3826, nowDate)) },
        { label: "Full", date: formatMonthDay(nextPhase(14.765, nowDate)) }
      ]
    });
  }, [city.lat, city.lon]);

  const loadObservations = useCallback(async () => {
    const selected = cities.filter((c) => c.key !== city.key).slice(0, 6);
    const rows = await Promise.all(
      selected.map(async (target) => {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${target.lat}&longitude=${target.lon}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          return {
            city: target.name,
            temp: "--",
            condition: "Unavailable",
            windDir: "--",
            windSpeed: "--"
          };
        }

        const data = await res.json();
        const cur = data.current;
        return {
          city: target.name,
          temp: Number.isFinite(cur?.temperature_2m) ? `${Math.round(cur.temperature_2m)}°F` : "--",
          condition: weatherCodeToText(cur?.weather_code),
          windDir: toWindDirection(cur?.wind_direction_10m),
          windSpeed: Number.isFinite(cur?.wind_speed_10m) ? `${Math.round(cur.wind_speed_10m)} mph` : "--"
        };
      })
    );
    setObservations(rows);
  }, [city.key]);

  const refreshData = useCallback(async () => {
    await Promise.all([loadCurrent(), loadObservations()]);
  }, [loadCurrent, loadObservations]);

  const resetRotateTimer = useCallback(() => {
    if (rotateTimerRef.current) {
      window.clearTimeout(rotateTimerRef.current);
    }
    if (!paused) {
      rotateTimerRef.current = window.setTimeout(async () => {
        await refreshData();
        setScreen((prev) => (prev + 1) % 4);
        transitionTone();
      }, ROTATE_MS);
    }
  }, [paused, refreshData, transitionTone]);

  useEffect(() => {
    document.body.classList.toggle("light", isLight);
  }, [isLight]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setClock(new Date().toLocaleTimeString([], { hour12: false }));
    }, 1000);
    setClock(new Date().toLocaleTimeString([], { hour12: false }));
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    refreshData();

    if (refreshTimerRef.current) {
      window.clearInterval(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setInterval(refreshData, WEATHER_REFRESH_MS);

    return () => {
      if (refreshTimerRef.current) {
        window.clearInterval(refreshTimerRef.current);
      }
    };
  }, [refreshData]);

  useEffect(() => {
    resetRotateTimer();
    return () => {
      if (rotateTimerRef.current) window.clearTimeout(rotateTimerRef.current);
    };
  }, [screen, paused, resetRotateTimer]);

  const manualNav = (target: number) => {
    setScreen((target + 4) % 4);
    resetRotateTimer();
  };

  const pauseByInteraction = useCallback(() => {
    setPaused(true);
    if (rotateTimerRef.current) {
      window.clearTimeout(rotateTimerRef.current);
    }
  }, []);

  const togglePause = () => {
    setPaused((prev) => !prev);
    resetRotateTimer();
  };

  const goFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen();
  };

  const screenVariants = {
    initial: { opacity: 0, x: 42 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -42 }
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden p-4 text-[1.05rem] lg:text-[1.18rem]">
      <div className="scanline" />

      <header className="panel relative z-10 mb-4 rounded-2xl p-5 lg:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.16em] text-amber-200 lg:text-base">Broadcast Weather Center</p>
            <h1 className="text-4xl font-extrabold uppercase tracking-wide lg:text-5xl">PiStation Weather Channel View</h1>
          </div>
          <div className="rounded-xl bg-white/15 px-5 py-4 font-mono text-4xl font-bold lg:text-6xl">{clock}</div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <select
            className="rounded-lg border border-sky-200/30 bg-black/25 px-4 py-3 text-base lg:text-lg"
            value={city.key}
            onChange={(e) => {
              pauseByInteraction();
              setCityKey(e.target.value);
              resetRotateTimer();
            }}
          >
            {cities.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="rounded-lg border border-sky-200/30 bg-black/25 px-4 py-3 text-base lg:text-lg" onClick={togglePause}>
            {paused ? "Resume Rotation" : "Pause Rotation"}
          </button>
          <button
            className="rounded-lg border border-sky-200/30 bg-black/25 px-4 py-3 text-base lg:text-lg"
            onClick={() => {
              pauseByInteraction();
              manualNav(screen - 1);
            }}
          >
            Prev
          </button>
          <button
            className="rounded-lg border border-sky-200/30 bg-black/25 px-4 py-3 text-base lg:text-lg"
            onClick={() => {
              pauseByInteraction();
              manualNav(screen + 1);
            }}
          >
            Next
          </button>
          <button
            className="rounded-lg border border-sky-200/30 bg-black/25 px-4 py-3 text-base lg:text-lg"
            onClick={() => {
              pauseByInteraction();
              setIsLight((v) => !v);
            }}
          >
            {isLight ? "Dark Mode" : "Light Mode"}
          </button>
          <button
            className="rounded-lg border border-sky-200/30 bg-black/25 px-4 py-3 text-base lg:text-lg"
            onClick={() => {
              pauseByInteraction();
              setMuted((v) => !v);
            }}
          >
            {muted ? "Unmute" : "Mute"}
          </button>
          <button
            className="rounded-lg border border-sky-200/30 bg-black/25 px-4 py-3 text-base lg:text-lg"
            onClick={() => {
              pauseByInteraction();
              goFullscreen();
            }}
          >
            Fullscreen
          </button>
          <button
            className="rounded-lg border border-sky-200/30 bg-black/25 px-4 py-3 text-base lg:text-lg"
            onClick={() => {
              pauseByInteraction();
              refreshData();
              setScreen(0);
              resetRotateTimer();
            }}
          >
            Reset Timer
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.section
          key={screen}
          variants={screenVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.58, ease: "easeInOut" }}
          className="panel relative z-10 h-[calc(100vh-230px)] rounded-3xl p-6 lg:p-8"
        >
          {screen === 0 ? (
            <div className="h-full rounded-2xl bg-gradient-to-b from-orange-300/35 via-fuchsia-400/20 to-slate-700/45 p-5">
              <div className="grid h-full grid-cols-12 gap-4">
                <div className="col-span-12 flex flex-col justify-between rounded-2xl bg-black/20 p-5 lg:col-span-7">
                  <div>
                    <p className="text-base uppercase tracking-[0.15em] text-sky-200 lg:text-lg">Current Conditions</p>
                    <h2 className="mt-1 text-3xl font-bold uppercase lg:text-4xl">{city.name}</h2>
                    <div className="mt-2 text-8xl font-extrabold leading-none lg:text-[10rem]">{current.temperature}</div>
                    <p className="mt-3 text-2xl font-semibold lg:text-3xl">{current.condition}</p>
                  </div>
                </div>
                <div className="col-span-12 rounded-2xl bg-black/20 p-5 lg:col-span-5">
                  <div className="text-8xl leading-none lg:text-[10rem]">{current.icon}</div>
                  <p className="mt-4 text-sm uppercase tracking-wider text-sky-200 lg:text-base">Updated every 5 minutes</p>
                </div>
                <div className="col-span-12 grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {[
                    ["Humidity", current.humidity],
                    ["Wind", current.wind],
                    ["Pressure", current.pressure],
                    ["Visibility", current.visibility],
                    ["Dew Point", current.dewPoint],
                    ["Heat Index", current.heatIndex]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-black/20 p-4">
                      <p className="text-sm uppercase tracking-wider text-sky-200 lg:text-base">{label}</p>
                      <p className="mt-1 font-mono text-2xl font-semibold lg:text-3xl">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {screen === 1 ? (
            <div className="h-full rounded-2xl bg-gradient-to-b from-orange-300/35 via-fuchsia-400/20 to-slate-700/45 p-5">
              <div className="flex h-full flex-col">
                <p className="text-base uppercase tracking-[0.15em] text-sky-200 lg:text-lg">Latest Observations</p>
                <h2 className="mt-1 text-3xl font-bold uppercase lg:text-4xl">Regional City Board</h2>
                <div className="mt-4 overflow-auto rounded-2xl border border-sky-200/20 bg-black/20 p-3">
                  <table className="w-full min-w-[780px] border-collapse">
                    <thead>
                      <tr className="text-left text-sm uppercase tracking-[0.14em] text-sky-200 lg:text-base">
                        <th className="border-b border-sky-100/20 p-3">City</th>
                        <th className="border-b border-sky-100/20 p-3">Temp</th>
                        <th className="border-b border-sky-100/20 p-3">Condition</th>
                        <th className="border-b border-sky-100/20 p-3">Wind Dir</th>
                        <th className="border-b border-sky-100/20 p-3">Wind Speed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {observations.map((row) => (
                        <tr key={row.city}>
                          <td className="border-b border-sky-100/15 p-3 text-lg lg:text-xl">{row.city}</td>
                          <td className="border-b border-sky-100/15 p-3 text-lg font-semibold lg:text-xl">{row.temp}</td>
                          <td className="border-b border-sky-100/15 p-3 text-lg lg:text-xl">{row.condition}</td>
                          <td className="border-b border-sky-100/15 p-3 text-lg lg:text-xl">{row.windDir}</td>
                          <td className="border-b border-sky-100/15 p-3 text-lg lg:text-xl">{row.windSpeed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {screen === 2 ? (
            <div className="h-full rounded-2xl bg-gradient-to-b from-orange-300/35 via-fuchsia-400/20 to-slate-700/45 p-5">
              <p className="text-base uppercase tracking-[0.15em] text-amber-200 lg:text-lg">Almanac</p>
              <div className="mt-3 grid gap-4 lg:grid-cols-[280px_1fr]">
                <div className="rounded-xl bg-black/30 p-4">
                  <p className="text-xl font-extrabold uppercase text-yellow-100">Sunrise / Sunset</p>
                  <div className="mt-4 space-y-4">
                    {almanac.solarDays.map((day) => (
                      <div key={day.day} className="rounded-lg bg-black/25 p-3">
                        <p className="text-2xl font-bold text-yellow-200">{day.day}</p>
                        <div className="mt-2 grid grid-cols-[110px_1fr] gap-1 text-xl">
                          <span className="font-semibold text-slate-100">Sunrise:</span>
                          <span className="font-mono text-white">{day.sunrise}</span>
                          <span className="font-semibold text-slate-100">Sunset:</span>
                          <span className="font-mono text-white">{day.sunset}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-700/70 p-4">
                  <p className="text-4xl font-extrabold text-yellow-200">Moon Data:</p>
                  <div className="mt-5 grid grid-cols-2 gap-6 md:grid-cols-4">
                    {almanac.phases.map((phase) => {
                      const isLast = phase.label === "Last";
                      const isNew = phase.label === "New";
                      const isFirst = phase.label === "First";
                      const isFull = phase.label === "Full";

                      return (
                        <div key={phase.label} className="text-center">
                          <p className="text-4xl font-bold text-white">{phase.label}</p>
                          <div className="mx-auto mt-3 h-24 w-24 rounded-full border-2 border-black bg-black shadow-[0_0_0_2px_rgba(255,255,255,0.2)] lg:h-28 lg:w-28">
                            {isLast ? <div className="h-full w-1/2 rounded-l-full bg-white" /> : null}
                            {isFirst ? <div className="ml-auto h-full w-1/2 rounded-r-full bg-white" /> : null}
                            {isFull ? <div className="h-full w-full rounded-full bg-white" /> : null}
                            {isNew ? <div className="h-full w-full rounded-full bg-black" /> : null}
                          </div>
                          <p className="mt-2 text-4xl font-bold text-white">{phase.date}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {screen === 3 ? (
            <div className="h-full rounded-2xl bg-gradient-to-b from-orange-300/35 via-fuchsia-400/20 to-slate-700/45 p-5">
              <div className="flex h-full flex-col">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-base uppercase tracking-[0.15em] text-sky-200 lg:text-lg">Traffic Map + Travel Times</p>
                    <h2 className="text-3xl font-bold uppercase lg:text-4xl">Columbus Metro Traffic Simulation</h2>
                  </div>
                  <div className="rounded-xl bg-black/20 px-4 py-3 text-base lg:text-xl">OSM + OSRM • Open Source</div>
                </div>
                <div className="min-h-0 flex-1">
                  <TrafficRouteMap onInteract={pauseByInteraction} />
                </div>
              </div>
            </div>
          ) : null}
        </motion.section>
      </AnimatePresence>

      <footer className="panel relative z-10 mt-4 flex items-center justify-between rounded-xl px-4 py-3 text-sm uppercase tracking-[0.14em] text-sky-100 lg:text-base">
        <span>
          Screen {screen + 1} / 4 {paused ? "| Rotation Paused" : "| Auto-Rotate 15s"}
        </span>
        <span>Fade + Slide Transition</span>
      </footer>
    </main>
  );
}
