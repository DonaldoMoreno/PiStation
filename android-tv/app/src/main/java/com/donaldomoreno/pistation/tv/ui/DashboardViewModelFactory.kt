package com.donaldomoreno.pistation.tv.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.donaldomoreno.pistation.tv.data.repository.DashboardRepository
import com.donaldomoreno.pistation.tv.data.repository.SettingsRepository
import com.donaldomoreno.pistation.tv.service.AudioFeedbackService

class DashboardViewModelFactory(
    private val dashboardRepository: DashboardRepository,
    private val settingsRepository: SettingsRepository,
    private val audioFeedbackService: AudioFeedbackService,
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(DashboardViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return DashboardViewModel(dashboardRepository, settingsRepository, audioFeedbackService) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
    }
}
