package dev.ottlib.tv.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import dev.ottlib.tv.ui.theme.OttlibColors

enum class TopDestination(val label: String, val icon: ImageVector) {
    Home("Home", Icons.Filled.Home),
    Library("Library", Icons.AutoMirrored.Filled.List),
    Search("Search", Icons.Filled.Search),
    Settings("Settings", Icons.Filled.Settings),
}

@Composable
fun TopNavigation(current: TopDestination, onNavigate: (TopDestination) -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier.fillMaxWidth().padding(start = ScreenPadding, end = ScreenPadding, top = 24.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text("Ottlib", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = OttlibColors.Accent)
        Spacer(Modifier.width(24.dp))
        TopDestination.entries.forEach { destination ->
            val selected = destination == current
            Surface(
                onClick = { if (!selected) onNavigate(destination) },
                shape = ClickableSurfaceDefaults.shape(androidx.compose.foundation.shape.RoundedCornerShape(50)),
                colors = ClickableSurfaceDefaults.colors(
                    containerColor = if (selected) OttlibColors.SurfaceRaised else OttlibColors.Canvas.copy(alpha = 0f),
                    contentColor = if (selected) OttlibColors.Foreground else OttlibColors.Muted,
                    focusedContainerColor = OttlibColors.Foreground,
                    focusedContentColor = OttlibColors.Canvas,
                ),
                scale = ClickableSurfaceDefaults.scale(focusedScale = 1.05f),
            ) {
                Row(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(destination.icon, contentDescription = null, modifier = Modifier.size(20.dp))
                    Text(destination.label, style = MaterialTheme.typography.labelLarge)
                }
            }
        }
    }
}
