package dev.ottlib.tv.ui.player

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.KeyEvent
import androidx.media3.common.C
import androidx.media3.common.Player
import dev.ottlib.core.player.SeekAccumulator
import dev.ottlib.core.player.SeekDirection
import dev.ottlib.tv.ui.components.formatOffset
import dev.ottlib.tv.ui.components.formatPosition
import kotlin.math.max

/** Transient on-screen feedback for remote shortcuts; [id] makes repeated identical hints restart their timer. */
data class SeekHint(val text: String, val id: Long = System.nanoTime())

/**
 * Feeds remote seek keys into a [SeekAccumulator] and performs the single seek it settles on, so a burst of taps
 * or a long hold costs one re-buffer instead of one per press. Shows "+1:20 → 42:10" while input is pending.
 */
class RemoteSeeker(private val player: Player, private val accumulator: SeekAccumulator, private val onHint: (SeekHint) -> Unit) {
    private val handler = Handler(Looper.getMainLooper())
    private val commitWhenSettled = Runnable { if (accumulator.readyToCommit(SystemClock.uptimeMillis())) commit() }

    fun onKey(direction: SeekDirection, event: KeyEvent) {
        when {
            event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0 -> accumulator.press(direction, event.eventTime)
            event.action == KeyEvent.ACTION_DOWN -> accumulator.hold(direction, event.downTime, event.eventTime)
            event.action == KeyEvent.ACTION_UP -> if (accumulator.release(event.eventTime)) return commit()
        }
        showPending()
        handler.removeCallbacks(commitWhenSettled)
        handler.postDelayed(commitWhenSettled, accumulator.tapWindowMs + SETTLE_MARGIN_MS)
    }

    fun release() = handler.removeCallbacksAndMessages(null)

    private fun commit() {
        handler.removeCallbacks(commitWhenSettled)
        val offset = accumulator.take()
        if (offset == 0L) return
        val target = target(offset)
        player.seekTo(target)
        onHint(hint(offset, target))
    }

    private fun showPending() {
        val offset = accumulator.pendingOffsetMs
        if (offset != 0L) onHint(hint(offset, target(offset)))
    }

    private fun hint(offset: Long, target: Long) = SeekHint("${formatOffset(offset)}  →  ${formatPosition(target)}")

    /** Clamped to the title; stops a second short of the end so a forward seek doesn't immediately finish the movie. */
    private fun target(offset: Long): Long {
        val position = player.currentPosition + offset
        val duration = player.duration.takeIf { it != C.TIME_UNSET && it > 0 } ?: return max(0, position)
        return position.coerceIn(0, max(0, duration - 1_000))
    }

    private companion object {
        const val SETTLE_MARGIN_MS = 10L
    }
}
