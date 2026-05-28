package com.donaldomoreno.pistation.tv.model

import android.graphics.Color
import kotlinx.serialization.Serializable

@Serializable
data class City(
    val key: String,
    val name: String,
    val lat: Double,
    val lon: Double,
)

@Serializable
data class CurrentConditions(
    val temperature: String = "--°F",
    val condition: String = "Unavailable",
    val icon: String = "◌",
    val humidity: String = "--%",
    val wind: String = "--",
    val pressure: String = "-- hPa",
    val visibility: String = "-- km",
    val dewPoint: String = "--°F",
    val heatIndex: String = "--°F",
)

@Serializable
data class Observation(
    val city: String,
    val temperature: String,
    val condition: String,
    val windDirection: String,
    val windSpeed: String,
)

@Serializable
data class SolarDay(
    val day: String,
    val sunrise: String,
    val sunset: String,
)

@Serializable
data class MoonPhase(
    val label: String,
    val date: String,
)

@Serializable
data class Almanac(
    val solarDays: List<SolarDay> = emptyList(),
    val currentMoonPhase: String = "--",
    val phases: List<MoonPhase> = emptyList(),
)

@Serializable
enum class RouteTrafficStatus {
    FLOW,
    MODERATE,
    HEAVY;

    val displayName: String
        get() = when (this) {
            FLOW -> "Flow"
            MODERATE -> "Moderate"
            HEAVY -> "Heavy"
        }
}

@Serializable
data class RoutePoint(
    val latitude: Double,
    val longitude: Double,
)

@Serializable
data class TrafficRoute(
    val id: String,
    val label: String,
    val distanceKm: Double,
    val baseMinutes: Double,
    val adjustedMinutes: Int,
    val status: RouteTrafficStatus,
    val colorHex: String,
    val points: List<RoutePoint>,
) {
    val colorInt: Int
        get() = Color.parseColor(colorHex)
}

@Serializable
data class DashboardData(
    val selectedCity: City,
    val currentConditions: CurrentConditions,
    val observations: List<Observation>,
    val almanac: Almanac,
    val trafficRoutes: List<TrafficRoute>,
    val lastUpdatedEpochMillis: Long,
)

enum class DashboardScreenType(
    val label: String,
    val subtitle: String,
) {
    CURRENT("Current", "Current conditions"),
    OBSERVATIONS("Observations", "Regional observations"),
    ALMANAC("Almanac", "Sun and moon"),
    TRAFFIC("Traffic", "Map and travel times"),
}

data class UserSettings(
    val selectedCityKey: String = CityCatalog.defaultCity.key,
    val isLightTheme: Boolean = false,
    val isAudioEnabled: Boolean = true,
    val isAutoRotatePaused: Boolean = false,
)
