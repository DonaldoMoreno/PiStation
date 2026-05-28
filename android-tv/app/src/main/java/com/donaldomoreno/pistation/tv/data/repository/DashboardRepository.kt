package com.donaldomoreno.pistation.tv.data.repository

import com.donaldomoreno.pistation.tv.data.local.DashboardCacheDao
import com.donaldomoreno.pistation.tv.data.local.DashboardCacheEntity
import com.donaldomoreno.pistation.tv.data.network.ForecastResponse
import com.donaldomoreno.pistation.tv.data.network.OpenMeteoApi
import com.donaldomoreno.pistation.tv.data.network.OsrmApi
import com.donaldomoreno.pistation.tv.domain.format.formatPercent
import com.donaldomoreno.pistation.tv.domain.format.formatPressure
import com.donaldomoreno.pistation.tv.domain.format.formatTemperatureF
import com.donaldomoreno.pistation.tv.domain.format.formatTime
import com.donaldomoreno.pistation.tv.domain.format.formatVisibilityKm
import com.donaldomoreno.pistation.tv.domain.format.formatWeekday
import com.donaldomoreno.pistation.tv.domain.format.formatWind
import com.donaldomoreno.pistation.tv.domain.format.haversineDistanceKm
import com.donaldomoreno.pistation.tv.domain.format.roundToSingleDecimal
import com.donaldomoreno.pistation.tv.domain.format.toWindDirection
import com.donaldomoreno.pistation.tv.domain.format.weatherCodeToText
import com.donaldomoreno.pistation.tv.domain.format.weatherIcon
import com.donaldomoreno.pistation.tv.model.Almanac
import com.donaldomoreno.pistation.tv.model.City
import com.donaldomoreno.pistation.tv.model.CityCatalog
import com.donaldomoreno.pistation.tv.model.CurrentConditions
import com.donaldomoreno.pistation.tv.model.DashboardData
import com.donaldomoreno.pistation.tv.model.Observation
import com.donaldomoreno.pistation.tv.model.RoutePoint
import com.donaldomoreno.pistation.tv.model.TrafficRoute
import com.donaldomoreno.pistation.tv.service.MoonPhaseService
import com.donaldomoreno.pistation.tv.service.TrafficSimulationService
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json
import kotlin.math.roundToInt

interface DashboardRepository {
    fun observeDashboard(): Flow<DashboardData?>
    suspend fun refreshDashboard(city: City): RefreshResult
}

data class RefreshResult(
    val success: Boolean,
    val message: String,
    val updatedAtEpochMillis: Long? = null,
)

class DefaultDashboardRepository(
    private val dashboardCacheDao: DashboardCacheDao,
    private val openMeteoApi: OpenMeteoApi,
    private val osrmApi: OsrmApi,
    private val moonPhaseService: MoonPhaseService,
    private val trafficSimulationService: TrafficSimulationService,
    private val json: Json,
) : DashboardRepository {

    override fun observeDashboard(): Flow<DashboardData?> = dashboardCacheDao.observeCache().map { entity ->
        entity?.payloadJson?.let { payload -> json.decodeFromString<DashboardData>(payload) }
    }

    override suspend fun refreshDashboard(city: City): RefreshResult = coroutineScope {
        val now = System.currentTimeMillis()
        try {
            val forecastDeferred = async {
                openMeteoApi.getForecast(
                    latitude = city.lat,
                    longitude = city.lon,
                    current = "temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m,wind_direction_10m,pressure_msl,visibility,dew_point_2m,apparent_temperature",
                    daily = "sunrise,sunset",
                )
            }
            val observationsDeferred = async { fetchObservations(city) }
            val routesDeferred = async { fetchTrafficRoutes(now) }

            val forecast = forecastDeferred.await()
            val currentConditions = forecast.toCurrentConditions()
            val almanac = forecast.toAlmanac(now)

            val dashboardData = DashboardData(
                selectedCity = city,
                currentConditions = currentConditions,
                observations = observationsDeferred.await(),
                almanac = almanac,
                trafficRoutes = routesDeferred.await(),
                lastUpdatedEpochMillis = now,
            )

            dashboardCacheDao.upsert(
                DashboardCacheEntity(
                    cityKey = city.key,
                    payloadJson = json.encodeToString(DashboardData.serializer(), dashboardData),
                    updatedAt = now,
                )
            )

            RefreshResult(true, "Live data updated for ${city.name}", now)
        } catch (error: Exception) {
            RefreshResult(false, error.message ?: "Network refresh failed")
        }
    }

    private suspend fun fetchObservations(selectedCity: City): List<Observation> = coroutineScope {
        CityCatalog.availableCities
            .filterNot { it.key == selectedCity.key }
            .take(6)
            .map { city ->
                async {
                    runCatching {
                        val response = openMeteoApi.getForecast(
                            latitude = city.lat,
                            longitude = city.lon,
                            current = "temperature_2m,weather_code,wind_speed_10m,wind_direction_10m",
                        )
                        val current = response.current
                        Observation(
                            city = city.name,
                            temperature = formatTemperatureF(current?.temperature),
                            condition = weatherCodeToText(current?.weatherCode),
                            windDirection = toWindDirection(current?.windDirection),
                            windSpeed = current?.windSpeed?.roundToInt()?.let { "$it mph" } ?: "--",
                        )
                    }.getOrElse {
                        Observation(
                            city = city.name,
                            temperature = "--",
                            condition = "Unavailable",
                            windDirection = "--",
                            windSpeed = "--",
                        )
                    }
                }
            }
            .awaitAll()
    }

    private suspend fun fetchTrafficRoutes(now: Long): List<TrafficRoute> = coroutineScope {
        CityCatalog.routeDestinations.map { destination ->
            async {
                runCatching {
                    val coordinates = "${CityCatalog.routeOrigin.lon},${CityCatalog.routeOrigin.lat};${destination.lon},${destination.lat}"
                    val route = osrmApi.getRoute(coordinates).routes.firstOrNull()
                    val points = route?.geometry?.coordinates
                        ?.mapNotNull { pair ->
                            val lon = pair.getOrNull(0)
                            val lat = pair.getOrNull(1)
                            if (lat != null && lon != null) RoutePoint(lat, lon) else null
                        }
                        .orEmpty()
                        .ifEmpty {
                            listOf(
                                RoutePoint(CityCatalog.routeOrigin.lat, CityCatalog.routeOrigin.lon),
                                RoutePoint(destination.lat, destination.lon),
                            )
                        }
                    val distanceKm = route?.distance?.div(1000.0)
                        ?: haversineDistanceKm(CityCatalog.routeOrigin.lat, CityCatalog.routeOrigin.lon, destination.lat, destination.lon)
                    val baseMinutes = route?.duration?.div(60.0) ?: (distanceKm / 80.0 * 60.0)
                    val simulation = trafficSimulationService.simulate(destination.key, baseMinutes, now)

                    TrafficRoute(
                        id = destination.key,
                        label = "${CityCatalog.routeOrigin.name} → ${destination.name}",
                        distanceKm = roundToSingleDecimal(distanceKm),
                        baseMinutes = roundToSingleDecimal(baseMinutes),
                        adjustedMinutes = simulation.adjustedMinutes,
                        status = simulation.status,
                        colorHex = simulation.colorHex,
                        points = points,
                    )
                }.getOrElse {
                    val distanceKm = haversineDistanceKm(CityCatalog.routeOrigin.lat, CityCatalog.routeOrigin.lon, destination.lat, destination.lon)
                    val baseMinutes = distanceKm / 80.0 * 60.0
                    val simulation = trafficSimulationService.simulate(destination.key, baseMinutes, now)
                    TrafficRoute(
                        id = destination.key,
                        label = "${CityCatalog.routeOrigin.name} → ${destination.name}",
                        distanceKm = roundToSingleDecimal(distanceKm),
                        baseMinutes = roundToSingleDecimal(baseMinutes),
                        adjustedMinutes = simulation.adjustedMinutes,
                        status = simulation.status,
                        colorHex = simulation.colorHex,
                        points = listOf(
                            RoutePoint(CityCatalog.routeOrigin.lat, CityCatalog.routeOrigin.lon),
                            RoutePoint(destination.lat, destination.lon),
                        ),
                    )
                }
            }
        }.awaitAll()
    }

    private fun ForecastResponse.toCurrentConditions(): CurrentConditions {
        val now = current
        return CurrentConditions(
            temperature = formatTemperatureF(now?.temperature),
            condition = weatherCodeToText(now?.weatherCode),
            icon = weatherIcon(now?.weatherCode),
            humidity = formatPercent(now?.humidity),
            wind = formatWind(now?.windSpeed, now?.windDirection),
            pressure = formatPressure(now?.pressure),
            visibility = formatVisibilityKm(now?.visibility),
            dewPoint = formatTemperatureF(now?.dewPoint),
            heatIndex = formatTemperatureF(now?.apparentTemperature),
        )
    }

    private fun ForecastResponse.toAlmanac(now: Long): Almanac = moonPhaseService.buildAlmanac(
        sunriseToday = formatTime(daily?.sunrise?.getOrNull(0)),
        sunsetToday = formatTime(daily?.sunset?.getOrNull(0)),
        sunriseTomorrow = formatTime(daily?.sunrise?.getOrNull(1)),
        sunsetTomorrow = formatTime(daily?.sunset?.getOrNull(1)),
        weekdayToday = formatWeekday(daily?.sunrise?.getOrNull(0)),
        weekdayTomorrow = formatWeekday(daily?.sunrise?.getOrNull(1)),
        nowEpochMillis = now,
    )
}
