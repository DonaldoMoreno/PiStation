package com.donaldomoreno.pistation.tv.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "dashboard_cache")
data class DashboardCacheEntity(
    @PrimaryKey val id: Int = 0,
    val cityKey: String,
    val payloadJson: String,
    val updatedAt: Long,
)
