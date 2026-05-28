package com.donaldomoreno.pistation.tv.ui.components

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.unit.dp
import com.donaldomoreno.pistation.tv.model.TrafficRoute
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline

@Composable
fun RouteMap(
    routes: List<TrafficRoute>,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current

    AndroidView(
        modifier = modifier
            .border(2.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.35f), RoundedCornerShape(24.dp))
            .fillMaxSize(),
        factory = {
            MapView(context).apply {
                setTileSource(TileSourceFactory.MAPNIK)
                setMultiTouchControls(false)
                controller.setZoom(9.3)
            }
        },
        update = { mapView ->
            mapView.overlays.clear()
            val primary = routes.firstOrNull()
            val points = primary?.points?.map { GeoPoint(it.latitude, it.longitude) }.orEmpty()

            if (points.isNotEmpty()) {
                val polyline = Polyline().apply {
                    setPoints(points)
                    color = android.graphics.Color.parseColor(primary?.colorHex ?: "#1F8BC8")
                    width = 10f
                }
                mapView.overlays += polyline

                val startMarker = Marker(mapView).apply {
                    position = points.first()
                    title = "${primary?.label ?: "Start"} origin"
                    setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                }
                val endMarker = Marker(mapView).apply {
                    position = points.last()
                    title = primary?.label ?: "Destination"
                    setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                }
                mapView.overlays += startMarker
                mapView.overlays += endMarker
                val midPoint = points[points.size / 2]
                mapView.controller.setCenter(midPoint)
            } else {
                mapView.controller.setCenter(GeoPoint(40.19, -83.33))
            }
            mapView.invalidate()
        },
    )
}
