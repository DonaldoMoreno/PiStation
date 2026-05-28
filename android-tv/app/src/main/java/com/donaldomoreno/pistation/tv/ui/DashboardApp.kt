@file:OptIn(ExperimentalLayoutApi::class)

package com.donaldomoreno.pistation.tv.ui

import androidx.compose.animation.Crossfade
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.donaldomoreno.pistation.tv.model.Almanac
import com.donaldomoreno.pistation.tv.model.CurrentConditions
import com.donaldomoreno.pistation.tv.model.DashboardData
import com.donaldomoreno.pistation.tv.model.DashboardScreenType
import com.donaldomoreno.pistation.tv.model.Observation
import com.donaldomoreno.pistation.tv.model.TrafficRoute
import com.donaldomoreno.pistation.tv.ui.components.RouteMap
import com.donaldomoreno.pistation.tv.ui.components.TvPillButton
import com.donaldomoreno.pistation.tv.ui.theme.PiStationTheme
import kotlinx.coroutines.delay
import java.time.LocalTime
import java.time.format.DateTimeFormatter

@Composable
fun DashboardApp(factory: DashboardViewModelFactory) {
    val viewModel: DashboardViewModel = viewModel(factory = factory)
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    PiStationTheme(darkTheme = !state.settings.isLightTheme) {
        Surface {
            DashboardScreen(
                state = state,
                onSelectCity = viewModel::selectCity,
                onSelectScreen = viewModel::selectScreen,
                onPrevious = viewModel::goToPreviousScreen,
                onNext = viewModel::goToNextScreen,
                onTogglePause = viewModel::toggleRotationPaused,
                onToggleTheme = viewModel::toggleLightTheme,
                onToggleAudio = viewModel::toggleAudio,
                onRefresh = viewModel::refreshNow,
            )
        }
    }
}

@Composable
private fun DashboardScreen(
    state: DashboardUiState,
    onSelectCity: (String) -> Unit,
    onSelectScreen: (DashboardScreenType) -> Unit,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onTogglePause: () -> Unit,
    onToggleTheme: () -> Unit,
    onToggleAudio: () -> Unit,
    onRefresh: () -> Unit,
) {
    val clock by produceState(initialValue = "--:--:--") {
        val formatter = DateTimeFormatter.ofPattern("HH:mm:ss")
        while (true) {
            value = LocalTime.now().format(formatter)
            delay(1000)
        }
    }

    val dashboard = state.dashboard

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.linearGradient(
                    colors = listOf(
                        MaterialTheme.colorScheme.background,
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.30f),
                        MaterialTheme.colorScheme.secondary.copy(alpha = 0.22f),
                    )
                )
            )
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 32.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = "PiStation TV",
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.semantics { heading() },
                )
                Text(
                    text = "Native Android TV adaptation of the broadcast weather flow",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.82f),
                )
            }

            InfoPanel(title = clock, subtitle = if (state.isOffline) "Offline cache" else "Live mode")
        }

        SectionBlock(title = "Screens", subtitle = state.currentScreen.subtitle) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                DashboardScreenType.entries.forEach { screen ->
                    TvPillButton(
                        text = screen.label,
                        selected = screen == state.currentScreen,
                        onClick = { onSelectScreen(screen) },
                    )
                }
            }
        }

        SectionBlock(title = "Cities", subtitle = state.selectedCity.name) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                items(state.availableCities, key = { it.key }) { city ->
                    TvPillButton(
                        text = city.name,
                        selected = city.key == state.selectedCity.key,
                        onClick = { onSelectCity(city.key) },
                    )
                }
            }
        }

        SectionBlock(title = "Controls", subtitle = state.statusMessage) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                TvPillButton(text = "Previous", onClick = onPrevious)
                TvPillButton(text = "Next", onClick = onNext)
                TvPillButton(text = if (state.settings.isAutoRotatePaused) "Resume rotation" else "Pause rotation", onClick = onTogglePause)
                TvPillButton(text = if (state.settings.isLightTheme) "Dark theme" else "Light theme", onClick = onToggleTheme)
                TvPillButton(text = if (state.settings.isAudioEnabled) "Audio on" else "Audio off", onClick = onToggleAudio)
                TvPillButton(text = "Refresh", onClick = onRefresh)
            }
        }

        Crossfade(
            targetState = state.currentScreen,
            animationSpec = androidx.compose.animation.core.tween(500),
            label = "screen_transition",
        ) { screen ->
            when (screen) {
                DashboardScreenType.CURRENT -> CurrentConditionsScreen(dashboard)
                DashboardScreenType.OBSERVATIONS -> ObservationsScreen(dashboard?.observations.orEmpty())
                DashboardScreenType.ALMANAC -> AlmanacScreen(dashboard?.almanac)
                DashboardScreenType.TRAFFIC -> TrafficScreen(dashboard?.trafficRoutes.orEmpty())
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = if (state.isOffline) "Offline fallback active" else "Connected to Open-Meteo + OSRM",
                style = MaterialTheme.typography.titleMedium,
            )
            Text(
                text = "Updated ${state.lastUpdatedLabel} · ${if (state.settings.isAutoRotatePaused) "Rotation paused" else "15s auto-rotate"}",
                style = MaterialTheme.typography.titleMedium,
            )
        }
    }
}

@Composable
private fun CurrentConditionsScreen(dashboard: DashboardData?) {
    val current = dashboard?.currentConditions ?: CurrentConditions()
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.86f)),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(28.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(dashboard?.selectedCity?.name ?: "--", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    Text(current.temperature, style = MaterialTheme.typography.displayLarge, fontWeight = FontWeight.ExtraBold)
                    Text(current.condition, style = MaterialTheme.typography.headlineSmall)
                }
                Text(
                    text = current.icon,
                    style = MaterialTheme.typography.displayLarge,
                    modifier = Modifier.graphicsLayer(scaleX = 1.35f, scaleY = 1.35f),
                )
            }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            MetricCard("Humidity", current.humidity)
            MetricCard("Wind", current.wind)
            MetricCard("Pressure", current.pressure)
            MetricCard("Visibility", current.visibility)
            MetricCard("Dew point", current.dewPoint)
            MetricCard("Heat index", current.heatIndex)
        }
    }
}

@Composable
private fun ObservationsScreen(observations: List<Observation>) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        observations.ifEmpty {
            listOf(Observation("No data", "--", "Unavailable", "--", "--"))
        }.forEach { row ->
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.84f)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 20.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(row.city, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.width(220.dp))
                    Text(row.temperature, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.width(120.dp))
                    Text(row.condition, style = MaterialTheme.typography.titleLarge, modifier = Modifier.width(220.dp))
                    Text(row.windDirection, style = MaterialTheme.typography.titleLarge, modifier = Modifier.width(90.dp))
                    Text(row.windSpeed, style = MaterialTheme.typography.titleLarge, modifier = Modifier.width(120.dp))
                }
            }
        }
    }
}

@Composable
private fun AlmanacScreen(almanac: Almanac?) {
    val data = almanac ?: Almanac()
    Row(horizontalArrangement = Arrangement.spacedBy(20.dp), modifier = Modifier.fillMaxWidth()) {
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.86f)),
            modifier = Modifier.weight(0.42f),
        ) {
            Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                Text("Sunrise / Sunset", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                data.solarDays.forEach { solar ->
                    InfoPanel(title = solar.day, subtitle = "Sunrise ${solar.sunrise} · Sunset ${solar.sunset}")
                }
                InfoPanel(title = data.currentMoonPhase, subtitle = "Current moon phase")
            }
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.86f)),
            modifier = Modifier.weight(0.58f),
        ) {
            Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("Upcoming moon phases", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                data.phases.forEach { phase ->
                    InfoPanel(title = phase.label, subtitle = phase.date)
                }
            }
        }
    }
}

@Composable
private fun TrafficScreen(routes: List<TrafficRoute>) {
    Row(horizontalArrangement = Arrangement.spacedBy(20.dp), modifier = Modifier.fillMaxWidth()) {
        Box(modifier = Modifier.weight(0.64f).height(520.dp)) {
            RouteMap(routes = routes, modifier = Modifier.fillMaxSize())
        }
        Column(modifier = Modifier.weight(0.36f), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            routes.forEach { route ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.86f)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(route.label, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Text("${route.adjustedMinutes} min · ${route.distanceKm} km", style = MaterialTheme.typography.headlineSmall)
                        Text("Base ${route.baseMinutes} min · ${route.status.displayName}", color = Color(route.colorInt))
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionBlock(title: String, subtitle: String, content: @Composable () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.78f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(subtitle, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f))
            content()
        }
    }
}

@Composable
private fun InfoPanel(title: String, subtitle: String) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.14f)),
    ) {
        Column(modifier = Modifier.padding(horizontal = 18.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(subtitle, style = MaterialTheme.typography.bodyLarge)
        }
    }
}

@Composable
private fun MetricCard(label: String, value: String) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.86f)),
        modifier = Modifier.width(240.dp),
    ) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(label, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.82f))
            Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        }
    }
}
