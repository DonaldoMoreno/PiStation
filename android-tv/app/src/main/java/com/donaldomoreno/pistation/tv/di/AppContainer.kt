package com.donaldomoreno.pistation.tv.di

import android.content.Context
import androidx.room.Room
import com.donaldomoreno.pistation.tv.data.local.PiStationDatabase
import com.donaldomoreno.pistation.tv.data.network.OpenMeteoApi
import com.donaldomoreno.pistation.tv.data.network.OsrmApi
import com.donaldomoreno.pistation.tv.data.repository.DashboardRepository
import com.donaldomoreno.pistation.tv.data.repository.DefaultDashboardRepository
import com.donaldomoreno.pistation.tv.data.repository.DefaultSettingsRepository
import com.donaldomoreno.pistation.tv.data.repository.SettingsRepository
import com.donaldomoreno.pistation.tv.service.AudioFeedbackService
import com.donaldomoreno.pistation.tv.service.MoonPhaseService
import com.donaldomoreno.pistation.tv.service.ToneAudioFeedbackService
import com.donaldomoreno.pistation.tv.service.TrafficSimulationService
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.create
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory

class AppContainer(context: Context) {
    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        explicitNulls = false
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BASIC
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .build()

    private val jsonContentType = "application/json".toMediaType()

    private val dashboardDatabase = Room.databaseBuilder(
        context,
        PiStationDatabase::class.java,
        "pistation-tv.db"
    ).fallbackToDestructiveMigration().build()

    private val openMeteoRetrofit = Retrofit.Builder()
        .baseUrl("https://api.open-meteo.com/")
        .addConverterFactory(json.asConverterFactory(jsonContentType))
        .client(okHttpClient)
        .build()

    private val osrmRetrofit = Retrofit.Builder()
        .baseUrl("https://router.project-osrm.org/")
        .addConverterFactory(json.asConverterFactory(jsonContentType))
        .client(okHttpClient)
        .build()

    private val moonPhaseService = MoonPhaseService()
    private val trafficSimulationService = TrafficSimulationService()

    private val openMeteoApi: OpenMeteoApi = openMeteoRetrofit.create()
    private val osrmApi: OsrmApi = osrmRetrofit.create()

    val dashboardRepository: DashboardRepository = DefaultDashboardRepository(
        dashboardCacheDao = dashboardDatabase.dashboardCacheDao(),
        openMeteoApi = openMeteoApi,
        osrmApi = osrmApi,
        moonPhaseService = moonPhaseService,
        trafficSimulationService = trafficSimulationService,
        json = json,
    )

    val settingsRepository: SettingsRepository = DefaultSettingsRepository(context)

    val audioFeedbackService: AudioFeedbackService = ToneAudioFeedbackService()
}
