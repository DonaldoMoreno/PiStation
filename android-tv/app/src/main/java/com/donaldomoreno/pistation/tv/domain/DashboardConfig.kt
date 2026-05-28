package com.donaldomoreno.pistation.tv.domain

/**
 * Centralized runtime values chosen to preserve the original PiStation timing and
 * layout behavior while keeping the Android TV port easy to tune later.
 */
object DashboardConfig {
    /** Matches the 15-second cadence used by the broadcast-weather screen rotation. */
    const val ROTATE_INTERVAL_MS = 15_000L

    /** Keeps parity with the original dashboard's 5-minute weather refresh cycle. */
    const val REFRESH_INTERVAL_MS = 5 * 60 * 1000L

    /** Six rows fit the TV observations layout without compromising DPAD readability. */
    const val MAX_OBSERVATIONS = 6

    /** Traffic stays stable for 3-minute windows to avoid noisy route time changes. */
    const val TRAFFIC_BUCKET_MS = 180000L
}
