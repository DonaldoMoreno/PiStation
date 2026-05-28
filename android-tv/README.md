# PiStation Android TV

Proyecto Android TV nativo en Kotlin que adapta el flujo principal de PiStation a una experiencia pensada para DPAD y pantallas 16:9.

## Qué replica del proyecto original

- Rotación automática entre 4 pantallas principales.
- Selector de ciudad y actualización periódica de datos.
- Condiciones actuales, observaciones regionales, almanaque solar/lunar y mapa de tráfico/rutas.
- Estados offline con caché local y recuperación cuando regresa la red.
- Controles equivalentes para pausa de rotación, cambio de tema, audio de transición y refresco manual.

## Adaptaciones específicas para TV

- Se reemplazó la automatización Selenium del modo `weather.com/retro + Google Maps` por una navegación nativa entre pantallas; en Android TV controlar sitios externos no es una estrategia robusta.
- La UI usa targets grandes, jerarquía visual amplia y controles pensados para foco DPAD.
- El mapa usa `osmdroid` para evitar dependencias de API keys y mantener un stack nativo.
- La persistencia usa Room + DataStore para soportar caché y preferencias locales.

## Arquitectura

- **UI**: Jetpack Compose con una pantalla principal de dashboard y componentes reutilizables.
- **Business logic**: `DashboardViewModel`, servicios de moon phase, simulación de tráfico y formateo.
- **Repositories**: `DashboardRepository` y `SettingsRepository`.
- **Networking**: Retrofit + OkHttp contra Open-Meteo y OSRM.
- **Persistencia**: Room para caché de dashboard y DataStore para preferencias.

## Estructura

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

## Compatibilidad mínima

- **Android TV 8.0 (API 26)**
- Compilación objetivo: **Android SDK 34**
- JDK recomendado: **17**

## Build y ejecución

```bash
cd android-tv
./gradlew assembleDebug
```

APK resultante:

```text
android-tv/app/build/outputs/apk/debug/app-debug.apk
```

## Decisiones arquitectónicas

1. **MVVM** para desacoplar UI de reglas de negocio.
2. **Flow** como contrato principal entre repositorios, caché y view model.
3. **Refresh resiliente**: primero se expone caché local y luego se intenta refrescar red.
4. **Simulación de tráfico**: se preserva la idea del subproyecto `broadcast-weather` usando OSRM + factor de congestión calculado localmente.
5. **Persistencia compacta**: el dashboard se guarda como payload serializado para simplificar el arranque offline.

## Diferencias / limitaciones respecto al repositorio original

- El modo Selenium no se porta literalmente; se adapta a una experiencia nativa de TV.
- El mapa de tráfico usa rutas OSRM y un factor de congestión simulado, no un iframe de Waze.
- No existe segunda pantalla táctil; la implementación se concentra en el flujo principal de TV.
- Las ciudades visibles en el selector se reducen a las del flujo principal del dashboard moderno para mantener navegación remota manejable.

## TODOs pendientes

- Integrar tests instrumentados y snapshots visuales para TV.
- Añadir un modo de configuración protegido para editar ciudades, tiempos y endpoints.
- Reemplazar iconografía de texto por assets meteorológicos dedicados.
- Soportar una segunda experiencia complementaria para pantallas auxiliares si el hardware lo requiere.
- Añadir telemetry/logging remoto opcional para despliegues kiosk.
