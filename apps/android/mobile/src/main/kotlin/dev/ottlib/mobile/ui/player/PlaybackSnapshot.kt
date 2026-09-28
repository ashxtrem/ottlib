package dev.ottlib.mobile.ui.player

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.State
import androidx.compose.runtime.produceState
import androidx.media3.common.C
import androidx.media3.common.Player
import kotlinx.coroutines.delay

/** What the controls draw. Refreshed on player events, and a few times a second for the position. */
@Immutable
data class PlaybackSnapshot(val playWhenReady: Boolean, val isPlaying: Boolean, val positionMs: Long, val durationMs: Long, val bufferedMs: Long)

@Composable
fun rememberPlaybackSnapshot(player: Player): State<PlaybackSnapshot> = produceState(player.snapshot(), player) {
    val listener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) {
            value = player.snapshot()
        }
    }
    player.addListener(listener)
    try {
        while (true) {
            value = player.snapshot()
            delay(POSITION_REFRESH_MS)
        }
    } finally {
        player.removeListener(listener)
    }
}

private fun Player.snapshot() = PlaybackSnapshot(
    playWhenReady = playWhenReady,
    isPlaying = isPlaying,
    positionMs = currentPosition.coerceAtLeast(0),
    durationMs = duration.takeIf { it != C.TIME_UNSET && it > 0 } ?: 0,
    bufferedMs = bufferedPosition,
)

fun Player.togglePlayPause() {
    if (playWhenReady) {
        pause()
    } else {
        if (playbackState == Player.STATE_ENDED) seekTo(0)
        if (playbackState == Player.STATE_IDLE) prepare()
        play()
    }
}

private const val POSITION_REFRESH_MS = 250L
