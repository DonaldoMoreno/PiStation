package com.donaldomoreno.pistation.tv.data.repository

import android.content.Context
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.donaldomoreno.pistation.tv.model.CityCatalog
import com.donaldomoreno.pistation.tv.model.UserSettings
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.io.File

interface SettingsRepository {
    val settingsFlow: Flow<UserSettings>

    suspend fun setSelectedCity(key: String)
    suspend fun setLightTheme(enabled: Boolean)
    suspend fun setAudioEnabled(enabled: Boolean)
    suspend fun setAutoRotatePaused(paused: Boolean)
}

class DefaultSettingsRepository(context: Context) : SettingsRepository {
    private val dataStore = PreferenceDataStoreFactory.create(
        produceFile = { File(context.filesDir, "tv-settings.preferences_pb") }
    )

    override val settingsFlow: Flow<UserSettings> = dataStore.data.map { preferences ->
        UserSettings(
            selectedCityKey = preferences[SELECTED_CITY_KEY] ?: CityCatalog.defaultCity.key,
            isLightTheme = preferences[LIGHT_THEME_KEY] ?: false,
            isAudioEnabled = preferences[AUDIO_ENABLED_KEY] ?: true,
            isAutoRotatePaused = preferences[AUTO_ROTATE_PAUSED_KEY] ?: false,
        )
    }

    override suspend fun setSelectedCity(key: String) {
        dataStore.edit { it[SELECTED_CITY_KEY] = key }
    }

    override suspend fun setLightTheme(enabled: Boolean) {
        dataStore.edit { it[LIGHT_THEME_KEY] = enabled }
    }

    override suspend fun setAudioEnabled(enabled: Boolean) {
        dataStore.edit { it[AUDIO_ENABLED_KEY] = enabled }
    }

    override suspend fun setAutoRotatePaused(paused: Boolean) {
        dataStore.edit { it[AUTO_ROTATE_PAUSED_KEY] = paused }
    }

    private companion object {
        val SELECTED_CITY_KEY = stringPreferencesKey("selected_city")
        val LIGHT_THEME_KEY = booleanPreferencesKey("light_theme")
        val AUDIO_ENABLED_KEY = booleanPreferencesKey("audio_enabled")
        val AUTO_ROTATE_PAUSED_KEY = booleanPreferencesKey("auto_rotate_paused")
    }
}
