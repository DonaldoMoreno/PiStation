package com.donaldomoreno.pistation.tv.domain.format

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

private val timeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
private val updatedFormatter = DateTimeFormatter.ofPattern("HH:mm", Locale.US)

fun weatherCodeToText(code: Int?): String = when (code) {
    0 -> "Sunny"
    1 -> "Mostly Sunny"
    2 -> "Partly Cloudy"
    3 -> "Cloudy"
    45 -> "Fog"
    48 -> "Dense Fog"
    51 -> "Light Drizzle"
    53 -> "Drizzle"
    55 -> "Heavy Drizzle"
    61 -> "Light Rain"
    63 -> "Rain"
    65 -> "Heavy Rain"
    71 -> "Light Snow"
    73 -> "Snow"
    75 -> "Heavy Snow"
    80 -> "Showers"
    81 -> "Rain Showers"
    82 -> "Heavy Showers"
    95 -> "Thunderstorm"
    else -> "Unavailable"
}

fun weatherIcon(code: Int?): String = when (code) {
    0, 1 -> "☀"
    2, 3, 45, 48 -> "☁"
    51, 53, 55, 61, 63, 65, 80, 81, 82 -> "☂"
    95 -> "⚡"
    else -> "◌"
}

fun formatTemperatureF(value: Double?): String = if (value == null) "--°F" else "${value.roundToInt()}°F"

fun formatPercent(value: Double?): String = if (value == null) "--%" else "${value.roundToInt()}%"

fun formatPressure(value: Double?): String = if (value == null) "-- hPa" else "${value.roundToInt()} hPa"

fun formatVisibilityKm(value: Double?): String = if (value == null) "-- km" else String.format(Locale.US, "%.1f km", value / 1000.0)

fun toWindDirection(value: Double?): String {
    if (value == null) return "--"
    val dirs = listOf("N", "NE", "E", "SE", "S", "SW", "W", "NW")
    val index = ((value / 45.0).roundToInt() % dirs.size + dirs.size) % dirs.size
    return dirs[index]
}

fun formatWind(speed: Double?, direction: Double?): String {
    if (speed == null || direction == null) return "--"
    return "${toWindDirection(direction)} ${speed.roundToInt()} mph"
}

fun formatTime(iso: String?): String {
    if (iso.isNullOrBlank()) return "--:--"
    return runCatching {
        Instant.parse(iso).atZone(ZoneId.systemDefault()).format(timeFormatter)
    }.getOrElse {
        "--:--"
    }
}

fun formatWeekday(iso: String?): String {
    if (iso.isNullOrBlank()) return "--"
    return runCatching {
        Instant.parse(iso).atZone(ZoneId.systemDefault()).dayOfWeek.getDisplayName(TextStyle.FULL, Locale.US)
    }.getOrDefault("--")
}

fun formatMonthDay(epochMillis: Long): String = Instant.ofEpochMilli(epochMillis)
    .atZone(ZoneId.systemDefault())
    .format(DateTimeFormatter.ofPattern("MMM d", Locale.US))

fun formatLastUpdated(epochMillis: Long): String = if (epochMillis <= 0L) {
    "--:--"
} else {
    Instant.ofEpochMilli(epochMillis).atZone(ZoneId.systemDefault()).format(updatedFormatter)
}

fun roundToSingleDecimal(value: Double): Double = (value * 10.0).roundToInt() / 10.0

fun haversineDistanceKm(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
    val earthRadiusKm = 6371.0
    val dLat = Math.toRadians(lat2 - lat1)
    val dLon = Math.toRadians(lon2 - lon1)
    val originLat = Math.toRadians(lat1)
    val destLat = Math.toRadians(lat2)
    val a = sin(dLat / 2) * sin(dLat / 2) +
        sin(dLon / 2) * sin(dLon / 2) * cos(originLat) * cos(destLat)
    val c = 2 * kotlin.math.atan2(sqrt(a), sqrt(1 - a))
    return earthRadiusKm * c
}
