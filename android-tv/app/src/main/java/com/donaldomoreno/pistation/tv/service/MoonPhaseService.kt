package com.donaldomoreno.pistation.tv.service

import com.donaldomoreno.pistation.tv.domain.format.formatMonthDay
import com.donaldomoreno.pistation.tv.model.Almanac
import com.donaldomoreno.pistation.tv.model.MoonPhase
import kotlin.math.roundToLong

class MoonPhaseService {
    private val synodicMonth = 29.53058867
    private val referenceEpochMillis = 947183640000L

    fun buildAlmanac(
        sunriseToday: String,
        sunsetToday: String,
        sunriseTomorrow: String,
        sunsetTomorrow: String,
        weekdayToday: String,
        weekdayTomorrow: String,
        nowEpochMillis: Long,
    ): Almanac {
        val age = moonAge(nowEpochMillis)
        return Almanac(
            solarDays = listOf(
                com.donaldomoreno.pistation.tv.model.SolarDay(weekdayToday, sunriseToday, sunsetToday),
                com.donaldomoreno.pistation.tv.model.SolarDay(weekdayTomorrow, sunriseTomorrow, sunsetTomorrow),
            ),
            currentMoonPhase = moonPhaseName(age),
            phases = listOf(
                MoonPhase("Last", formatMonthDay(nextPhaseEpoch(22.148, nowEpochMillis))),
                MoonPhase("New", formatMonthDay(nextPhaseEpoch(0.0, nowEpochMillis))),
                MoonPhase("First", formatMonthDay(nextPhaseEpoch(7.3826, nowEpochMillis))),
                MoonPhase("Full", formatMonthDay(nextPhaseEpoch(14.765, nowEpochMillis))),
            ),
        )
    }

    private fun moonAge(epochMillis: Long): Double {
        val age = ((epochMillis - referenceEpochMillis) / 86400000.0) % synodicMonth
        return if (age < 0) age + synodicMonth else age
    }

    private fun nextPhaseEpoch(targetAge: Double, nowEpochMillis: Long): Long {
        val currentAge = moonAge(nowEpochMillis)
        val delta = (targetAge - currentAge + synodicMonth) % synodicMonth
        return nowEpochMillis + (delta * 86400000.0).roundToLong()
    }

    private fun moonPhaseName(age: Double): String = when {
        age < 3.7 -> "New Moon"
        age < 7.4 -> "Waxing Crescent"
        age < 11.1 -> "First Quarter"
        age < 14.8 -> "Waxing Gibbous"
        age < 18.5 -> "Full Moon"
        age < 22.1 -> "Waning Gibbous"
        age < 25.8 -> "Last Quarter"
        else -> "Waning Crescent"
    }
}
