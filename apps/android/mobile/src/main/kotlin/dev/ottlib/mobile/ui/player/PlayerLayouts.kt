package dev.ottlib.mobile.ui.player

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import dev.ottlib.core.presentation.player.PlayerControls
import dev.ottlib.core.presentation.theme.OttlibColors

/**
 * Controls drawn over a flat screen. Empty areas pass touches through to the gesture layer underneath, so tapping
 * the video still hides the controls and double-tapping still skips.
 */
@Composable
fun OverlayControls(title: String, snapshot: PlaybackSnapshot, controls: PlayerControls, actions: PlayerActions) {
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Scrim, 0.25f to Color.Transparent, 0.7f to Color.Transparent, 1f to Scrim))) {
        Box(Modifier.fillMaxSize().safeDrawingPadding().padding(horizontal = 8.dp, vertical = 4.dp)) {
            PlayerTopBar(title, actions, Modifier.fillMaxWidth().align(Alignment.TopCenter))
            TransportControls(snapshot, controls.skipBackMs, controls.skipForwardMs, actions, Modifier.align(Alignment.Center))
            SeekBar(snapshot, actions, Modifier.fillMaxWidth().align(Alignment.BottomCenter).padding(horizontal = 12.dp, vertical = 8.dp))
        }
    }
}

/**
 * Flex mode (half-folded like a laptop): the video sits above the hinge and the controls stay visible below it,
 * like Samsung's own player.
 */
@Composable
fun TabletopControls(title: String, snapshot: PlaybackSnapshot, controls: PlayerControls, actions: PlayerActions, modifier: Modifier = Modifier) {
    Column(
        modifier.background(OttlibColors.Canvas).windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal)).padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.SpaceEvenly,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PlayerTopBar(title, actions, Modifier.fillMaxWidth())
        SeekBar(snapshot, actions, Modifier.fillMaxWidth())
        TransportControls(snapshot, controls.skipBackMs, controls.skipForwardMs, actions, large = false)
    }
}

private val Scrim = Color.Black.copy(alpha = 0.7f)
