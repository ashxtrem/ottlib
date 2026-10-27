package dev.ottlib.tv.ui.player

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.KeyEvent
import androidx.media3.common.C
import androidx.media3.common.Player
import dev.ottlib.core.player.ScrubController
import dev.ottlib.core.player.SeekAccumulator
import dev.ottlib.core.player.SeekDirection
import dev.ottlib.core.presentation.formatOffset
import dev.ottlib.core.presentation.formatPosition
import kotlin.math.max

/** Transient on-screen feedback for remote shortcuts; [id] makes repeated identical hints restart their timer. */
data class SeekHint(val text: String, val id: Long = System.nanoTime())

/**
 * Feeds remote seek keys into a [SeekAccumulator] and settles on one exact seek, so a burst of taps or a long hold
 * costs one re-buffer instead of one per press. Shows "+1:20 → 42:10" while input is pending; meanwhile [scrub]
 * moves the picture (direct play) or fetches preview frames (server session) on every change.
 */
class RemoteSeeker(
    private val player: Player,
    private val accumulator: SeekAccumulator,
    private val scrub: ScrubController,
    private val onHint: (SeekHint) -> Unit,
    /** True when a scrub starts, false when it ends or is dropped. */
    private val onScrubbing: (Boolean) -> Unit = {},
) {
    private val handler = Handler(Looper.getMainLooper())
    private val commitWhenSettled = Runnable { if (accumulator.readyToCommit(SystemClock.uptimeMillis())) commit() }
    /** The position before the scrub started; live seeks move the player, so offsets count from here. */
    private var base = 0L

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

    fun release() {
        handler.removeCallbacksAndMessages(null)
        scrub.cancel()
        onScrubbing(false)
    }

    /** The screen left the foreground: settle a half-finished scrub where it is, so the player isn't left scrubbing. */
    fun stopScrubbing() {
        handler.removeCallbacks(commitWhenSettled)
        if (!scrub.scrubbing) return
        scrub.end(target(accumulator.take()))
        onScrubbing(false)
    }

    private fun commit() {
        handler.removeCallbacks(commitWhenSettled)
        val offset = accumulator.take()
        val target = target(offset)
        if (scrub.scrubbing) scrub.end(target) else if (offset != 0L) player.seekTo(target)
        onScrubbing(false)
        if (offset != 0L) onHint(hint(offset, target))
    }

    private fun showPending() {
        val offset = accumulator.pendingOffsetMs
        if (offset == 0L) return
        if (!scrub.scrubbing) {
            base = player.currentPosition
            scrub.begin()
            onScrubbing(true)
        }
        val target = target(offset)
        scrub.scrubTo(target)
        onHint(hint(offset, target))
    }

    private fun hint(offset: Long, target: Long) = SeekHint("${formatOffset(offset)}  →  ${formatPosition(target)}")

    /** Clamped to the title; stops a second short of the end so a forward seek doesn't immediately finish the movie. */
    private fun target(offset: Long): Long {
        val position = (if (scrub.scrubbing) base else player.currentPosition) + offset
        val duration = player.duration.takeIf { it != C.TIME_UNSET && it > 0 } ?: return max(0, position)
        return position.coerceIn(0, max(0, duration - 1_000))
    }

    private companion object {
        const val SETTLE_MARGIN_MS = 10L
    }
}
