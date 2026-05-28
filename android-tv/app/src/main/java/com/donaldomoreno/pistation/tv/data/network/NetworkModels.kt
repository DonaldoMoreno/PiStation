package com.donaldomoreno.pistation.tv.data.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ForecastResponse(
    val current: CurrentWeatherResponse? = null,
    val daily: DailyWeatherResponse? = null,
)

@Serializable
data class CurrentWeatherResponse(
    @SerialName("temperature_2m") val temperature: Double? = null,
    @SerialName("weather_code") val weatherCode: Int? = null,
    @SerialName("relative_humidity_2m") val humidity: Double? = null,
    @SerialName("wind_speed_10m") val windSpeed: Double? = null,
    @SerialName("wind_direction_10m") val windDirection: Double? = null,
    @SerialName("pressure_msl") val pressure: Double? = null,
    val visibility: Double? = null,
    @SerialName("dew_point_2m") val dewPoint: Double? = null,
    @SerialName("apparent_temperature") val apparentTemperature: Double? = null,
)

@Serializable
data class DailyWeatherResponse(
    val sunrise: List<String> = emptyList(),
    val sunset: List<String> = emptyList(),
)

@Serializable
data class OsrmRouteResponse(
    val routes: List<OsrmRoute> = emptyList(),
)

@Serializable
data class OsrmRoute(
    val distance: Double = 0.0,
    val duration: Double = 0.0,
    val geometry: OsrmGeometry = OsrmGeometry(),
)

@Serializable
data class OsrmGeometry(
    val coordinates: List<List<Double>> = emptyList(),
)
