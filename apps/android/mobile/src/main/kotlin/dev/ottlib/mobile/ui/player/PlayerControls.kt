package dev.ottlib.mobile.ui.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AspectRatio
import androidx.compose.material.icons.filled.FastForward
import androidx.compose.material.icons.filled.FastRewind
import androidx.compose.material.icons.filled.Forward10
import androidx.compose.material.icons.filled.Forward30
import androidx.compose.material.icons.filled.Forward5
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PictureInPictureAlt
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay10
import androidx.compose.material.icons.filled.Replay30
import androidx.compose.material.icons.filled.Replay5
import androidx.compose.material.icons.filled.Subtitles
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.ottlib.core.player.SeekDirection
import dev.ottlib.core.presentation.formatPosition
import dev.ottlib.core.presentation.theme.OttlibColors

/** Everything the on-screen controls can do; the player screen wires these to the player and ViewModel. */
class PlayerActions(
    val onBack: () -> Unit,
    val onPlayPause: () -> Unit,
    val onSkip: (SeekDirection) -> Unit,
    val onSeekTo: (Long) -> Unit,
    val onScrubbing: (Boolean) -> Unit,
    val onTracks: () -> Unit,
    val onPicture: () -> Unit,
    /** Null when the device has no picture-in-picture. */
    val onPictureInPicture: (() -> Unit)?,
    val onPlayElsewhere: () -> Unit,
)

@Composable
fun PlayerTopBar(title: String, actions: PlayerActions, modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        ControlIcon(Icons.AutoMirrored.Filled.ArrowBack, "Back", actions.onBack)
        Text(
            title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = Color.White,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
        )
        ControlIcon(Icons.Filled.Subtitles, "Audio and subtitles", actions.onTracks)
        ControlIcon(Icons.Filled.AspectRatio, "Picture", actions.onPicture)
        actions.onPictureInPicture?.let { ControlIcon(Icons.Filled.PictureInPictureAlt, "Picture-in-picture", it) }
        MoreMenu(actions.onPlayElsewhere)
    }
}

@Composable
private fun MoreMenu(onPlayElsewhere: () -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        ControlIcon(Icons.Filled.MoreVert, "More") { open = true }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(text = { Text("Play in another app") }, onClick = {
                open = false
                onPlayElsewhere()
            })
        }
    }
}

@Composable
fun TransportControls(snapshot: PlaybackSnapshot, skipBackMs: Long, skipForwardMs: Long, actions: PlayerActions, modifier: Modifier = Modifier, large: Boolean = true) {
    val size = if (large) 56.dp else 44.dp
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(if (large) 40.dp else 24.dp), verticalAlignment = Alignment.CenterVertically) {
        ControlIcon(skipIcon(SeekDirection.Back, skipBackMs), "Back ${skipBackMs / 1_000} seconds", size = size * 0.75f) { actions.onSkip(SeekDirection.Back) }
        ControlIcon(if (snapshot.playWhenReady) Icons.Filled.Pause else Icons.Filled.PlayArrow, if (snapshot.playWhenReady) "Pause" else "Play", size = size, onClick = actions.onPlayPause)
        ControlIcon(skipIcon(SeekDirection.Forward, skipForwardMs), "Forward ${skipForwardMs / 1_000} seconds", size = size * 0.75f) { actions.onSkip(SeekDirection.Forward) }
    }
}

/** Position, a draggable seek bar and the duration. The bar previews the scrub position and seeks once on release. */
@Composable
fun SeekBar(snapshot: PlaybackSnapshot, actions: PlayerActions, modifier: Modifier = Modifier) {
    var scrub by remember { mutableStateOf<Float?>(null) }
    val duration = snapshot.durationMs
    val fraction = scrub ?: if (duration > 0) (snapshot.positionMs.toFloat() / duration).coerceIn(0f, 1f) else 0f
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        TimeLabel(formatPosition(scrub?.let { (it * duration).toLong() } ?: snapshot.positionMs))
        Slider(
            value = fraction,
            onValueChange = {
                if (scrub == null) actions.onScrubbing(true)
                scrub = it
            },
            onValueChangeFinished = {
                scrub?.let { actions.onSeekTo((it * duration).toLong()) }
                scrub = null
                actions.onScrubbing(false)
            },
            enabled = duration > 0,
            colors = SliderDefaults.colors(thumbColor = OttlibColors.Accent, activeTrackColor = OttlibColors.Accent, inactiveTrackColor = Color.White.copy(alpha = 0.3f)),
            modifier = Modifier.weight(1f),
        )
        TimeLabel(formatPosition(duration))
    }
}

@Composable
private fun TimeLabel(text: String) {
    Text(text, style = MaterialTheme.typography.labelLarge, color = Color.White)
}

@Composable
fun ControlIcon(icon: ImageVector, description: String, onClick: () -> Unit) = ControlIcon(icon, description, 24.dp, onClick)

@Composable
fun ControlIcon(icon: ImageVector, description: String, size: Dp, onClick: () -> Unit) {
    IconButton(onClick = onClick, modifier = Modifier.size(size + 24.dp)) {
        Icon(icon, contentDescription = description, tint = Color.White, modifier = Modifier.size(size))
    }
}

private fun skipIcon(direction: SeekDirection, stepMs: Long): ImageVector = when (direction) {
    SeekDirection.Back -> when (stepMs) {
        5_000L -> Icons.Filled.Replay5
        10_000L -> Icons.Filled.Replay10
        30_000L -> Icons.Filled.Replay30
        else -> Icons.Filled.FastRewind
    }
    SeekDirection.Forward -> when (stepMs) {
        5_000L -> Icons.Filled.Forward5
        10_000L -> Icons.Filled.Forward10
        30_000L -> Icons.Filled.Forward30
        else -> Icons.Filled.FastForward
    }
}
