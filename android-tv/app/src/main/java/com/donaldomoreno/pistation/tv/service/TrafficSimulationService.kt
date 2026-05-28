package com.donaldomoreno.pistation.tv.service

import com.donaldomoreno.pistation.tv.domain.DashboardConfig
import com.donaldomoreno.pistation.tv.model.RouteTrafficStatus
import kotlin.math.absoluteValue
import kotlin.math.roundToInt

class TrafficSimulationService {
    data class Simulation(
        val adjustedMinutes: Int,
        val status: RouteTrafficStatus,
        val colorHex: String,
    )

    fun simulate(routeId: String, baseMinutes: Double, nowEpochMillis: Long): Simulation {
        val bucket = nowEpochMillis / DashboardConfig.TRAFFIC_BUCKET_MS
        val raw = (routeId.hashCode().toLong() * 31L + bucket).absoluteValue
        val factor = 1.0 + ((raw % 61L) / 100.0)
        val adjusted = (baseMinutes * factor).roundToInt().coerceAtLeast(1)

        return when {
            factor <= 1.15 -> Simulation(adjusted, RouteTrafficStatus.FLOW, "#26D36B")
            factor <= 1.35 -> Simulation(adjusted, RouteTrafficStatus.MODERATE, "#F7D541")
            else -> Simulation(adjusted, RouteTrafficStatus.HEAVY, "#F24F4F")
        }
    }
}
