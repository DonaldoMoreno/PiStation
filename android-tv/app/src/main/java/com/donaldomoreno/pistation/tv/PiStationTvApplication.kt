package com.donaldomoreno.pistation.tv

import android.app.Application
import com.donaldomoreno.pistation.tv.di.AppContainer
import org.osmdroid.config.Configuration

class PiStationTvApplication : Application() {
    lateinit var appContainer: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        Configuration.getInstance().load(this, getSharedPreferences("osmdroid", MODE_PRIVATE))
        Configuration.getInstance().userAgentValue = packageName
        appContainer = AppContainer(this)
    }
}
