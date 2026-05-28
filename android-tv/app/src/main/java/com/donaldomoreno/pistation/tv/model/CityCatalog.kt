package com.donaldomoreno.pistation.tv.model

object CityCatalog {
    val availableCities = listOf(
        City("east-liberty", "East Liberty", 40.2801573, -83.5452151),
        City("columbus", "Columbus", 39.9612, -82.9988),
        City("dublin", "Dublin", 40.0992, -83.1141),
        City("buffalo", "Buffalo", 42.8864, -78.8784),
        City("chicago", "Chicago", 41.8781, -87.6298),
        City("cleveland", "Cleveland", 41.4993, -81.6944),
        City("detroit", "Detroit", 42.3314, -83.0458),
        City("indianapolis", "Indianapolis", 39.7684, -86.1581),
        City("pittsburgh", "Pittsburgh", 40.4406, -79.9959),
    )

    val defaultCity: City = availableCities.first()

    fun byKey(key: String): City = availableCities.firstOrNull { it.key == key } ?: defaultCity

    data class RouteEndpoint(
        val key: String,
        val name: String,
        val lat: Double,
        val lon: Double,
    )

    val routeOrigin = RouteEndpoint("origin", "East Liberty", 40.2801573, -83.5452151)

    val routeDestinations = listOf(
        RouteEndpoint("dublin", "Dublin", 40.0992, -83.1141),
        RouteEndpoint("hilliard", "Hilliard", 40.0334, -83.1582),
        RouteEndpoint("downtown", "Downtown Columbus", 39.9612, -82.9988),
    )
}
