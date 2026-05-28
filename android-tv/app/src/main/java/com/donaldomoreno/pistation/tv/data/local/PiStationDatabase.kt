package com.donaldomoreno.pistation.tv.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [DashboardCacheEntity::class],
    version = 1,
    exportSchema = false,
)
abstract class PiStationDatabase : RoomDatabase() {
    abstract fun dashboardCacheDao(): DashboardCacheDao
}
