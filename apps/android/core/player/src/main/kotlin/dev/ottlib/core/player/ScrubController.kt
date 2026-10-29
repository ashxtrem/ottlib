package dev.ottlib.core.player

import android.os.Handler
import android.os.Looper
import android.os.SystemClock

/** What [ScrubController] needs from the player; [ExoScrubTarget] is the real one. */
interface ScrubTarget {
    /** On: fast, approximate seeks for live scrubbing. Off: the player's previous seek parameters are back. */
    fun fastSeeking(enabled: Boolean)
    fun seekTo(positionMs: Long)
}

/** Runs [action] after [delayMs]; the returned function cancels it. */
fun interface ScrubScheduler {
    fun schedule(delayMs: Long, action: () -> Unit): () -> Unit
}

/**
 * Scrubbing "via time" for a drag (phone seek bar) or a held key (TV remote): [begin], [scrubTo] on every change,
 * [end] on release.
 *
 * - No frames ([frameUrl] answers null: the source offers none): the real video moves. Seeks use fast seeking and
 *   come at most once per [intervalMs]; the last position asked for is applied when the interval is up.
 * - Frames ([frameUrl] answers a URL, on direct play and on a server session alike): nothing seeks until [end]
 *   (on a server session every seek would restart the transcode). [onFrame] gets a preview frame URL instead, at most
 *   once per [intervalMs] and only when the 2 s step changes. The screen keeps the last frame shown until the next one lands.
 * - [end] turns fast seeking off (restoring the default seek parameters), clears the frame and seeks exactly once.
 */
class ScrubController(
    private val target: ScrubTarget,
    private val frameUrl: (positionMs: Long) -> String?,
    private val onFrame: (String?) -> Unit,
    private val clock: () -> Long = SystemClock::uptimeMillis,
    private val scheduler: ScrubScheduler = mainThreadScheduler(),
    private val intervalMs: Long = INTERVAL_MS,
) {
    private var active = false
    private var fast = false
    private var lastAppliedAt: Long? = null
    private var pendingMs: Long? = null
    private var lastFrame: String? = null
    private var cancelTrailing: (() -> Unit)? = null

    val scrubbing: Boolean get() = active

    fun begin() {
        if (active) return
        active = true
        lastAppliedAt = null
        lastFrame = null
    }

    fun scrubTo(positionMs: Long) {
        if (!active) begin()
        pendingMs = positionMs
        val now = clock()
        val since = lastAppliedAt?.let { now - it }
        if (since == null || since >= intervalMs) return applyPending()
        if (cancelTrailing == null) cancelTrailing = scheduler.schedule(intervalMs - since) {
            cancelTrailing = null
            if (active) applyPending()
        }
    }

    fun end(positionMs: Long) {
        cancelTrailing?.invoke()
        cancelTrailing = null
        pendingMs = null
        val wasActive = active
        active = false
        if (fast) {
            fast = false
            target.fastSeeking(false)
        }
        if (wasActive && lastFrame != null) onFrame(null)
        lastFrame = null
        target.seekTo(positionMs)
    }

    /** Drops a scrub without seeking (the screen is going away). */
    fun cancel() {
        cancelTrailing?.invoke()
        cancelTrailing = null
        pendingMs = null
        active = false
        if (fast) {
            fast = false
            target.fastSeeking(false)
        }
        lastFrame = null
    }

    private fun applyPending() {
        val position = pendingMs ?: return
        pendingMs = null
        lastAppliedAt = clock()
        val frame = frameUrl(position)
        if (frame != null) {
            if (frame != lastFrame) {
                lastFrame = frame
                onFrame(frame)
            }
            return
        }
        if (!fast) {
            fast = true
            target.fastSeeking(true)
        }
        target.seekTo(position)
    }

    companion object {
        const val INTERVAL_MS = 150L
        /** The server caches frames in 2 s steps; asking for the same steps lets the image cache hit too. */
        const val FRAME_STEP_MS = 2_000L
    }
}

/** The server-relative frame path for [positionMs] (rounded to the server's 2 s step) from the playback source's template. */
fun framePreviewPath(template: String, positionMs: Long): String {
    val step = ScrubController.FRAME_STEP_MS
    val rounded = (positionMs.coerceAtLeast(0) + step / 2) / step * step
    return "$template&t=$rounded"
}

private fun mainThreadScheduler(): ScrubScheduler {
    val handler = Handler(Looper.getMainLooper())
    return ScrubScheduler { delayMs, action ->
        val runnable = Runnable(action)
        handler.postDelayed(runnable, delayMs)
        ({ handler.removeCallbacks(runnable) })
    }
}
