package com.donaldomoreno.pistation.tv.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.donaldomoreno.pistation.tv.data.repository.DashboardRepository
import com.donaldomoreno.pistation.tv.data.repository.SettingsRepository
import com.donaldomoreno.pistation.tv.domain.DashboardConfig
import com.donaldomoreno.pistation.tv.domain.format.formatLastUpdated
import com.donaldomoreno.pistation.tv.model.City
import com.donaldomoreno.pistation.tv.model.CityCatalog
import com.donaldomoreno.pistation.tv.model.DashboardData
import com.donaldomoreno.pistation.tv.model.DashboardScreenType
import com.donaldomoreno.pistation.tv.model.UserSettings
import com.donaldomoreno.pistation.tv.service.AudioFeedbackService
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class DashboardUiState(
    val isLoading: Boolean = true,
    val selectedCity: City = CityCatalog.defaultCity,
    val settings: UserSettings = UserSettings(),
    val dashboard: DashboardData? = null,
    val currentScreen: DashboardScreenType = DashboardScreenType.CURRENT,
    val statusMessage: String = "Loading PiStation TV...",
    val isOffline: Boolean = false,
    val lastUpdatedLabel: String = "--:--",
    val availableCities: List<City> = CityCatalog.availableCities,
)

class DashboardViewModel(
    private val dashboardRepository: DashboardRepository,
    private val settingsRepository: SettingsRepository,
    private val audioFeedbackService: AudioFeedbackService,
) : ViewModel() {
    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    private var activeCityKey: String? = null
    private var rotationJob: Job? = null
    private var refreshLoopJob: Job? = null
    private var refreshRequestJob: Job? = null

    init {
        observeSettings()
        observeDashboardCache()
        startRefreshLoop()
    }

    private fun observeSettings() {
        viewModelScope.launch {
            settingsRepository.settingsFlow.collect { settings ->
                val city = CityCatalog.byKey(settings.selectedCityKey)
                _uiState.update {
                    it.copy(
                        settings = settings,
                        selectedCity = city,
                    )
                }
                restartRotation(settings.isAutoRotatePaused)
                if (activeCityKey != city.key) {
                    activeCityKey = city.key
                    refreshDashboard(manual = false)
                }
            }
        }
    }

    private fun observeDashboardCache() {
        viewModelScope.launch {
            dashboardRepository.observeDashboard().collect { dashboard ->
                _uiState.update {
                    it.copy(
                        dashboard = dashboard,
                        isLoading = dashboard == null && it.isLoading,
                        lastUpdatedLabel = dashboard?.lastUpdatedEpochMillis?.let(::formatLastUpdated) ?: it.lastUpdatedLabel,
                    )
                }
            }
        }
    }

    private fun startRefreshLoop() {
        refreshLoopJob?.cancel()
        refreshLoopJob = viewModelScope.launch {
            while (true) {
                delay(DashboardConfig.REFRESH_INTERVAL_MS)
                refreshDashboard(manual = false)
            }
        }
    }

    private fun restartRotation(paused: Boolean) {
        rotationJob?.cancel()
        if (paused) return
        rotationJob = viewModelScope.launch {
            while (true) {
                delay(DashboardConfig.ROTATE_INTERVAL_MS)
                advanceScreen(autoTriggered = true)
            }
        }
    }

    fun selectCity(cityKey: String) {
        if (cityKey == _uiState.value.settings.selectedCityKey) {
            restartRotation(_uiState.value.settings.isAutoRotatePaused)
            return
        }
        viewModelScope.launch {
            settingsRepository.setSelectedCity(cityKey)
        }
    }

    fun selectScreen(screen: DashboardScreenType) {
        _uiState.update { it.copy(currentScreen = screen) }
        restartRotation(_uiState.value.settings.isAutoRotatePaused)
    }

    fun goToPreviousScreen() {
        val screens = DashboardScreenType.entries
        val currentIndex = screens.indexOf(_uiState.value.currentScreen)
        val nextIndex = if (currentIndex <= 0) screens.lastIndex else currentIndex - 1
        selectScreen(screens[nextIndex])
    }

    fun goToNextScreen() {
        advanceScreen(autoTriggered = false)
    }

    fun refreshNow() {
        refreshDashboard(manual = true)
        restartRotation(_uiState.value.settings.isAutoRotatePaused)
    }

    fun toggleRotationPaused() {
        val paused = !_uiState.value.settings.isAutoRotatePaused
        viewModelScope.launch {
            settingsRepository.setAutoRotatePaused(paused)
        }
    }

    fun toggleLightTheme() {
        viewModelScope.launch {
            settingsRepository.setLightTheme(!_uiState.value.settings.isLightTheme)
        }
    }

    fun toggleAudio() {
        viewModelScope.launch {
            settingsRepository.setAudioEnabled(!_uiState.value.settings.isAudioEnabled)
        }
    }

    private fun refreshDashboard(manual: Boolean) {
        val city = _uiState.value.selectedCity
        refreshRequestJob?.cancel()
        refreshRequestJob = viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isLoading = it.dashboard == null,
                    statusMessage = if (manual) "Refreshing ${city.name}..." else it.statusMessage,
                )
            }
            val result = dashboardRepository.refreshDashboard(city)
            _uiState.update {
                it.copy(
                    isLoading = false,
                    statusMessage = if (result.success) result.message else "Offline fallback active: ${result.message}",
                    isOffline = !result.success,
                    lastUpdatedLabel = result.updatedAtEpochMillis?.let(::formatLastUpdated) ?: it.lastUpdatedLabel,
                )
            }
        }
    }

    private fun advanceScreen(autoTriggered: Boolean) {
        val screens = DashboardScreenType.entries
        val currentIndex = screens.indexOf(_uiState.value.currentScreen)
        val nextScreen = screens[(currentIndex + 1) % screens.size]
        _uiState.update { it.copy(currentScreen = nextScreen) }
        if (autoTriggered) {
            audioFeedbackService.playTransition(_uiState.value.settings.isAudioEnabled)
        }
        restartRotation(_uiState.value.settings.isAutoRotatePaused)
    }

    override fun onCleared() {
        super.onCleared()
        rotationJob?.cancel()
        refreshLoopJob?.cancel()
        refreshRequestJob?.cancel()
        audioFeedbackService.release()
    }
}
