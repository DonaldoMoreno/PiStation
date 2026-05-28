package com.donaldomoreno.pistation.tv.data.local

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface DashboardCacheDao {
    @Query("SELECT * FROM dashboard_cache WHERE id = 0")
    fun observeCache(): Flow<DashboardCacheEntity?>

    @Upsert
    suspend fun upsert(entity: DashboardCacheEntity)
}
