package com.donaldomoreno.pistation.tv.data.network

import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface OsrmApi {
    @GET("route/v1/driving/{coordinates}")
    suspend fun getRoute(
        @Path(value = "coordinates", encoded = true) coordinates: String,
        @Query("overview") overview: String = "full",
        @Query("geometries") geometries: String = "geojson",
    ): OsrmRouteResponse
}
