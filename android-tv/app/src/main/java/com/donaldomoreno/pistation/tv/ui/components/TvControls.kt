package com.donaldomoreno.pistation.tv.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.focusable
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun TvPillButton(
    text: String,
    selected: Boolean = false,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    var isFocused by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(if (isFocused) 1.06f else 1f, label = "tv_scale")
    val backgroundColor by animateColorAsState(
        targetValue = when {
            selected -> MaterialTheme.colorScheme.primary
            isFocused -> MaterialTheme.colorScheme.secondary.copy(alpha = 0.88f)
            else -> MaterialTheme.colorScheme.surface.copy(alpha = 0.82f)
        },
        label = "tv_background",
    )
    val contentColor by animateColorAsState(
        targetValue = if (selected || isFocused) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
        label = "tv_content",
    )

    Box(
        modifier = modifier
            .scale(scale)
            .onFocusChanged { isFocused = it.hasFocus }
            .border(
                border = BorderStroke(2.dp, if (isFocused) MaterialTheme.colorScheme.secondary else Color.Transparent),
                shape = RoundedCornerShape(16.dp),
            )
            .background(backgroundColor, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick, role = Role.Button)
            .focusable()
            .semantics {
                contentDescription = text
                role = Role.Button
            }
            .padding(horizontal = 18.dp, vertical = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            color = contentColor,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
    }
}
