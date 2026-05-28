package com.donaldomoreno.pistation.tv.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val PiStationDarkColors = darkColorScheme(
    primary = androidx.compose.ui.graphics.Color(0xFF1F8BC8),
    onPrimary = androidx.compose.ui.graphics.Color.White,
    secondary = androidx.compose.ui.graphics.Color(0xFFF58A39),
    background = androidx.compose.ui.graphics.Color(0xFF061534),
    surface = androidx.compose.ui.graphics.Color(0xFF102553),
    onSurface = androidx.compose.ui.graphics.Color(0xFFF0F6FF),
)

private val PiStationLightColors = lightColorScheme(
    primary = androidx.compose.ui.graphics.Color(0xFF1F8BC8),
    onPrimary = androidx.compose.ui.graphics.Color.White,
    secondary = androidx.compose.ui.graphics.Color(0xFFF58A39),
    background = androidx.compose.ui.graphics.Color(0xFFDCEEFF),
    surface = androidx.compose.ui.graphics.Color(0xFFF5FAFF),
    onSurface = androidx.compose.ui.graphics.Color(0xFF0D1B44),
)

@Composable
fun PiStationTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) PiStationDarkColors else PiStationLightColors,
        content = content,
    )
}
