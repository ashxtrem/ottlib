package dev.ottlib.tv.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.sync.SyncState
import dev.ottlib.core.presentation.theme.OttlibColors

/**
 * Asks the server to look for new (and removed) files in its library folders, so a title added on the PC shows up
 * here without opening the web app. Metadata is not refreshed. The result appears as a toast (see SyncOutcomeToasts).
 */
@Composable
fun LibrarySyncButton(modifier: Modifier = Modifier) {
    val sync = appContainer().librarySync
    val state by sync.state.collectAsStateWithLifecycle()
    val syncing = state is SyncState.Running
    Surface(
        // Stays clickable while syncing (a press is ignored) so focus is never taken away from the button.
        onClick = sync::start,
        modifier = modifier,
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(50)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = OttlibColors.SurfaceRaised,
            contentColor = OttlibColors.Foreground,
            focusedContainerColor = OttlibColors.Foreground,
            focusedContentColor = OttlibColors.Canvas,
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.05f),
    ) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Filled.Refresh, contentDescription = null, modifier = Modifier.size(20.dp).spinning(syncing))
            Text(if (syncing) "Syncing…" else "Sync", style = MaterialTheme.typography.labelLarge)
        }
    }
}

/** Turns the icon round and round while [spinning]; costs nothing when idle. */
@Composable
private fun Modifier.spinning(spinning: Boolean): Modifier {
    if (!spinning) return this
    val angle by rememberInfiniteTransition(label = "sync").animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(durationMillis = 1_000, easing = LinearEasing), RepeatMode.Restart),
        label = "sync-angle",
    )
    return rotate(angle)
}
