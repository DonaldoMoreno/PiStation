package com.donaldomoreno.pistation.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.donaldomoreno.pistation.tv.ui.DashboardApp
import com.donaldomoreno.pistation.tv.ui.DashboardViewModelFactory

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val appContainer = (application as PiStationTvApplication).appContainer
        val factory = DashboardViewModelFactory(appContainer.dashboardRepository, appContainer.settingsRepository, appContainer.audioFeedbackService)

        setContent {
            DashboardApp(factory = factory)
        }
    }
}
