package dev.ottlib.mobile.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.sync.SyncState

/**
 * A top-bar button that asks the server to look for new (and removed) files in its library folders, so a title added
 * on the PC shows up here without opening the web app. Metadata is not refreshed. The result appears as a toast (see
 * SyncOutcomeToasts).
 */
@Composable
fun LibrarySyncAction() {
    val sync = appContainer().librarySync
    val state by sync.state.collectAsStateWithLifecycle()
    val syncing = state is SyncState.Running
    IconButton(onClick = sync::start) {
        Icon(Icons.Filled.Sync, contentDescription = if (syncing) "Syncing library" else "Sync library", modifier = Modifier.spinning(syncing))
    }
}

/** Turns the icon round and round while [spinning]; costs nothing when idle. */
@Composable
private fun Modifier.spinning(spinning: Boolean): Modifier {
    if (!spinning) return this
    val angle by rememberInfiniteTransition(label = "sync").animateFloat(
        initialValue = 360f,
        targetValue = 0f, // Sync's arrows run anticlockwise
        animationSpec = infiniteRepeatable(tween(durationMillis = 1_000, easing = LinearEasing), RepeatMode.Restart),
        label = "sync-angle",
    )
    return rotate(angle)
}
