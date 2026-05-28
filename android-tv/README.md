# PiStation Android TV

Native Kotlin Android TV project that adapts the main PiStation flow into a DPAD-first 16:9 television experience.

## What it preserves from the original repository

- Auto-rotation across 4 main screens.
- City selection and periodic live data refresh.
- Current conditions, regional observations, solar/lunar almanac, and route/traffic views.
- Offline fallback with local cache and reconnection refresh.
- Equivalent controls for rotation pause, theme switch, transition audio, and manual refresh.

## TV-specific adaptations

- The Selenium `weather.com/retro + Google Maps` mode was replaced by native TV navigation; automating third-party websites is not a robust Android TV strategy.
- The UI uses large focus targets, strong hierarchy, and remote-friendly grouping for DPAD navigation.
- The map uses `osmdroid` to stay native and avoid API-key requirements.
- Persistence uses Room + DataStore to support offline cache and local preferences.

## Architecture

- **UI**: Jetpack Compose dashboard screen with reusable TV controls.
- **Business logic**: `DashboardViewModel`, moon phase service, traffic simulation service, and formatting utilities.
- **Repositories**: `DashboardRepository` and `SettingsRepository`.
- **Networking**: Retrofit + OkHttp against Open-Meteo and OSRM.
- **Persistence**: Room for cached dashboard payloads and DataStore for user settings.

## Structure

```text
android-tv/
├── app/
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/donaldomoreno/pistation/tv/
│       │   ├── data/
│       │   ├── domain/
│       │   ├── model/
│       │   ├── service/
│       │   ├── ui/
│       │   ├── MainActivity.kt
│       │   └── PiStationTvApplication.kt
│       └── res/
├── gradle/
├── gradlew
└── settings.gradle.kts
```

## Minimum compatibility

- **Android TV 8.0 (API 26)**
- Target compile level: **Android SDK 34**
- Recommended JDK: **17**

## Build and run

```bash
cd android-tv
./gradlew assembleDebug
```

Expected APK:

```text
android-tv/app/build/outputs/apk/debug/app-debug.apk
```

## Architecture decisions

1. **MVVM** keeps the TV UI separate from business rules.
2. **Flow** is the main contract between repositories, cache, and view model.
3. **Resilient refresh** exposes local cache first, then attempts a network refresh.
4. **Traffic simulation** preserves the `broadcast-weather` idea with OSRM routing plus a local congestion factor.
5. **Compact persistence** stores the dashboard payload as serialized data for simpler offline startup.

## Differences and limitations

- Selenium mode is not ported literally; it is adapted into a native TV flow.
- The traffic view uses OSRM routes plus a simulated congestion layer instead of a Waze iframe.
- There is no secondary touch display implementation; this project focuses on the primary TV flow.
- The city selector is intentionally limited to the core broadcast dashboard cities to keep remote navigation manageable.

## TODOs

- Add TV-focused instrumented tests and visual regression coverage.
- Add a protected configuration mode for cities, timings, and endpoints.
- Replace text weather icons with dedicated weather assets.
- Add optional secondary-screen support if the hardware setup requires it.
- Add optional remote telemetry/log aggregation for kiosk deployments.
