package dev.ottlib.tv.ui.player

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.KeyEvent
import androidx.media3.common.C
import androidx.media3.common.Player
import dev.ottlib.core.player.SCRUB_IDLE_MS
import dev.ottlib.core.player.ScrubController
import dev.ottlib.core.player.ScrubSession
import dev.ottlib.core.player.SeekAccumulator
import dev.ottlib.core.player.SeekDirection
import dev.ottlib.core.presentation.formatOffset
import dev.ottlib.core.presentation.formatPosition
import kotlin.math.max

/** Transient on-screen feedback for remote shortcuts; [id] makes repeated identical hints restart their timer. */
data class SeekHint(val text: String, val id: Long = System.nanoTime())

/** An open scrub, for the scrub bar: the head and where playback was ([base]); [framesOn] false means times only. */
data class ScrubState(val head: Long, val base: Long, val durationMs: Long, val framesOn: Boolean)

/**
 * Remote seek keys, in two modes.
 *
 * - *Skip*: taps (or a burst of them) add up in a [SeekAccumulator] and settle on one exact seek, with a text [SeekHint].
 * - *Scrub*: a hold, or ←/→ on the focused timeline ([openFromTimeline]), pauses and opens a [ScrubSession]. Keys move
 *   its head and [scrub] fetches the frame for it; nothing seeks until [commit] (OK, or [SCRUB_IDLE_MS] with no key).
 *   [cancel] (Back) returns to the base. Both put the play state back.
 */
class RemoteSeeker(
    private val player: Player,
    private val accumulator: SeekAccumulator,
    private val scrub: ScrubController,
    /** True when the source offers preview frames; without them [scrub] moves the video live. */
    private val hasFrames: () -> Boolean,
    private val onHint: (SeekHint) -> Unit,
    /** The open scrub after every change; null once it closes. */
    private val onScrubState: (ScrubState?) -> Unit,
    /** True when a scrub opens (before it pauses), false when it closes. */
    private val onScrubbing: (Boolean) -> Unit = {},
    /** A scrub closed; [fromTimeline] is true when it was opened from the controller's timeline. */
    private val onClosed: (fromTimeline: Boolean) -> Unit = {},
) {
    private val handler = Handler(Looper.getMainLooper())
    private val commitWhenSettled = Runnable { if (accumulator.readyToCommit(SystemClock.uptimeMillis())) commitSkip() }
    private val commitWhenIdle = Runnable { checkIdle() }
    private val session = ScrubSession()
    private var wasPlaying = false
    private var fromTimeline = false

    val scrubOpen: Boolean get() = session.isOpen

    fun onKey(direction: SeekDirection, event: KeyEvent) {
        if (session.isOpen) return scrubKey(direction, event)
        when {
            event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0 -> accumulator.press(direction, event.eventTime)
            event.action == KeyEvent.ACTION_DOWN && event.eventTime - event.downTime >= SeekAccumulator.HOLD_DELAY_MS -> {
                openScrub(timeline = false)
                return scrubKey(direction, event)
            }
            event.action == KeyEvent.ACTION_DOWN -> accumulator.hold(direction, event.downTime, event.eventTime)
            event.action == KeyEvent.ACTION_UP -> if (accumulator.release(event.eventTime)) return commitSkip()
        }
        showPending()
        handler.removeCallbacks(commitWhenSettled)
        handler.postDelayed(commitWhenSettled, accumulator.tapWindowMs + SETTLE_MARGIN_MS)
    }

    /** ←/→ on the focused timeline: opens the scrub at once, this key being its first step. */
    fun openFromTimeline(direction: SeekDirection, event: KeyEvent) {
        if (!session.isOpen) openScrub(timeline = true)
        scrubKey(direction, event)
    }

    /** OK, or the idle timer: jump to the head and put the play state back. */
    fun commit() {
        if (!session.isOpen) return
        val head = session.commit()
        accumulator.take()
        scrub.end(head)
        close(resume = wasPlaying)
    }

    /** Back: drop the scrub; playback stays where it was ([resume] false leaves it paused, for the app going away). */
    fun cancel(resume: Boolean = true) {
        if (!session.isOpen) return
        val base = session.cancel()
        accumulator.take()
        scrub.cancel()
        if (!hasFrames()) player.seekTo(base) // without frames the video itself moved with the head
        close(resume = resume && wasPlaying)
    }

    /** The screen left the foreground: drop pending taps and cancel a scrub, leaving the player paused. */
    fun stop() {
        handler.removeCallbacks(commitWhenSettled)
        accumulator.take()
        cancel(resume = false)
    }

    fun release() {
        handler.removeCallbacksAndMessages(null)
        if (session.isOpen) session.cancel()
        scrub.cancel()
        onScrubbing(false)
    }

    private fun openScrub(timeline: Boolean) {
        handler.removeCallbacks(commitWhenSettled)
        fromTimeline = timeline
        wasPlaying = player.playWhenReady
        onScrubbing(true)
        player.pause()
        scrub.begin()
        session.open(player.currentPosition, duration())
        publish()
    }

    private fun scrubKey(direction: SeekDirection, event: KeyEvent) {
        when {
            event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0 -> accumulator.press(direction, event.eventTime)
            event.action == KeyEvent.ACTION_DOWN -> accumulator.hold(direction, event.downTime, event.eventTime)
            event.action == KeyEvent.ACTION_UP -> accumulator.release(event.eventTime)
        }
        session.holding = event.action == KeyEvent.ACTION_DOWN
        session.touched(event.eventTime)
        val offset = accumulator.drain()
        if (offset != 0L) {
            scrub.scrubTo(session.move(offset))
            publish()
        }
        handler.removeCallbacks(commitWhenIdle)
        handler.postDelayed(commitWhenIdle, SCRUB_IDLE_MS)
    }

    private fun checkIdle() {
        if (session.idleDue(SystemClock.uptimeMillis())) return commit()
        // Still held (or a key landed since): look again later; key-up re-arms the timer anyway.
        if (session.isOpen) handler.postDelayed(commitWhenIdle, SCRUB_IDLE_MS)
    }

    private fun close(resume: Boolean) {
        handler.removeCallbacks(commitWhenIdle)
        if (resume) player.play()
        onScrubbing(false)
        onScrubState(null)
        onClosed(fromTimeline)
    }

    private fun publish() = onScrubState(ScrubState(session.head, session.base, duration(), hasFrames()))

    private fun commitSkip() {
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

    private fun duration(): Long = player.duration.takeIf { it != C.TIME_UNSET && it > 0 } ?: 0L

    /** Clamped to the title; stops a second short of the end so a forward seek doesn't immediately finish the movie. */
    private fun target(offset: Long): Long {
        val position = player.currentPosition + offset
        val duration = duration().takeIf { it > 0 } ?: return max(0, position)
        return position.coerceIn(0, max(0, duration - 1_000))
    }

    private companion object {
        const val SETTLE_MARGIN_MS = 10L
    }
}
