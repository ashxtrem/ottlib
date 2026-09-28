package dev.ottlib.mobile.ui.player

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FastForward
import androidx.compose.material.icons.filled.FastRewind
import androidx.media3.common.C
import androidx.media3.common.Player
import dev.ottlib.core.player.SeekAccumulator
import dev.ottlib.core.player.SeekDirection
import dev.ottlib.core.presentation.formatOffset
import dev.ottlib.core.presentation.formatPosition

/**
 * Double-taps on the sides of the video and taps on the skip buttons add up (three taps = three steps) and are
 * applied as one seek once tapping stops, so a burst costs a single re-buffer. Same rules as the TV remote.
 */
class TouchSeeker(private val player: Player, backStepMs: Long, forwardStepMs: Long, private val onHint: (PlayerHint) -> Unit) {
    private val accumulator = SeekAccumulator(backStepMs, forwardStepMs, tapWindowMs = TAP_WINDOW_MS)
    private val handler = Handler(Looper.getMainLooper())
    private val commitWhenSettled = Runnable { if (accumulator.readyToCommit(SystemClock.uptimeMillis())) commit() }

    fun tap(direction: SeekDirection) {
        accumulator.press(direction, SystemClock.uptimeMillis())
        val offset = accumulator.pendingOffsetMs
        onHint(seekHint(offset, target(offset)))
        handler.removeCallbacks(commitWhenSettled)
        handler.postDelayed(commitWhenSettled, TAP_WINDOW_MS + SETTLE_MARGIN_MS)
    }

    fun release() = handler.removeCallbacksAndMessages(null)

    private fun commit() {
        val offset = accumulator.take()
        if (offset != 0L) player.seekTo(target(offset))
    }

    private fun target(offset: Long) = SeekMath.target(player.currentPosition, offset, player.duration.takeIf { it != C.TIME_UNSET })

    private companion object {
        /** Longer than a remote's: a double-tap takes ~300ms, and consecutive double-taps should still add up. */
        const val TAP_WINDOW_MS = 700L
        const val SETTLE_MARGIN_MS = 10L
    }
}

fun seekHint(offsetMs: Long, targetMs: Long) = PlayerHint(
    "${formatOffset(offsetMs)}  →  ${formatPosition(targetMs)}",
    if (offsetMs < 0) Icons.Filled.FastRewind else Icons.Filled.FastForward,
)
