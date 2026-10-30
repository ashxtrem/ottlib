package dev.ottlib.core.player

/**
 * A TV scrub in progress: the player keeps playing from [base] while the scrub head moves with the remote and the
 * screen shows the server's frame for the head. Pure logic (times are the `uptimeMillis` values carried by key
 * events), so it is unit-testable on the JVM. Step sizes stay in [SeekAccumulator]; the caller feeds its deltas into [move].
 *
 * - [open] starts at the playback position; [move] adds an offset to the head, kept inside the title
 *   (`0` to `duration - 1 s`, the same clamp as a plain seek).
 * - [touched] records the last key. [idleDue] turns true [SCRUB_IDLE_MS] after it, which is the cue to [commit].
 * - [holding] is set by the caller while a key is held down (a hold sends no new presses, but is not idle): [idleDue]
 *   is never true during it. It is cleared when the session closes.
 * - [commit] returns the head to seek to; [cancel] returns the base (Back). Both close the session.
 */
class ScrubSession {
    private var open = false
    private var duration = 0L
    private var lastKeyAt = 0L

    /** Where playback was when the scrub opened; what [cancel] returns. */
    var base = 0L
        private set

    /** The scrub position. */
    var head = 0L
        private set

    /** True while a key is held down; the caller keeps it current. [idleDue] is never true while it is set. */
    var holding = false

    val isOpen: Boolean get() = open

    /** Starts a scrub at [basePositionMs] in a title of [durationMs] (zero or less when unknown: only the lower bound applies). */
    fun open(basePositionMs: Long, durationMs: Long) {
        open = true
        duration = durationMs
        base = basePositionMs.coerceAtLeast(0)
        head = base
        holding = false
        lastKeyAt = 0L
    }

    /** Moves the head by [offsetMs] (negative goes back), clamped to the title; returns the new head. */
    fun move(offsetMs: Long): Long {
        head = clamp(head + offsetMs)
        return head
    }

    /** Records a key at [nowMs], restarting the idle countdown. */
    fun touched(nowMs: Long) {
        lastKeyAt = nowMs
    }

    /** True when the scrub is open, no key is held, and [SCRUB_IDLE_MS] have passed since the last key. */
    fun idleDue(nowMs: Long): Boolean = open && !holding && nowMs - lastKeyAt >= SCRUB_IDLE_MS

    /** Closes the session and returns the head, the position to seek to. */
    fun commit(): Long = head.also { close() }

    /** Closes the session and returns the base, the position playback never left. */
    fun cancel(): Long = base.also { close() }

    private fun close() {
        open = false
        holding = false
    }

    private fun clamp(position: Long): Long {
        if (duration <= 0) return position.coerceAtLeast(0)
        return position.coerceIn(0, maxOf(0, duration - 1_000))
    }
}

/** How long after the last ←/→ key a TV scrub jumps to the head on its own. */
const val SCRUB_IDLE_MS = 2_000L
