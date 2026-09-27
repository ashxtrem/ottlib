package dev.ottlib.core.player

import kotlin.math.max
import kotlin.math.sign

enum class SeekDirection(internal val sign: Int) { Back(-1), Forward(1) }

/**
 * Turns remote-control presses into as few seeks as possible. Pure logic (times are the `uptimeMillis` values
 * carried by key events), so the timing rules are unit-testable.
 *
 * - A tap adds one step. Taps within [tapWindowMs] of each other add up; the seek happens once input settles.
 * - Holding the key adds steps every [HOLD_INTERVAL_MS], timed by how long it has been held (remotes send key
 *   repeats ~20×/s, which would otherwise be far too fast). Steps grow to 30s after 1s and 60s after 3s. The seek
 *   happens on release.
 * - Pressing the other direction while a seek is pending starts over from that direction.
 */
class SeekAccumulator(
    private val backStepMs: Long,
    private val forwardStepMs: Long,
    val tapWindowMs: Long = 400,
) {
    private var offsetMs = 0L
    private var lastInputAt = 0L
    private var holdStartedAt: Long? = null
    private var nextHoldStepAt = 0L

    /** Signed offset from the current position that would be applied now. */
    val pendingOffsetMs: Long get() = offsetMs

    /** First key-down of a press. */
    fun press(direction: SeekDirection, now: Long) {
        if (offsetMs != 0L && offsetMs.sign != direction.sign) offsetMs = 0
        offsetMs += direction.sign * step(direction)
        lastInputAt = now
        holdStartedAt = null
    }

    /** A key-repeat while the key is held; [downTime] is when the key went down. */
    fun hold(direction: SeekDirection, downTime: Long, now: Long) {
        lastInputAt = now
        if (now - downTime < HOLD_DELAY_MS) return
        if (holdStartedAt == null) {
            holdStartedAt = downTime
            nextHoldStepAt = now
        }
        while (now >= nextHoldStepAt) {
            offsetMs += direction.sign * holdStep(direction, heldMs = nextHoldStepAt - downTime)
            nextHoldStepAt += HOLD_INTERVAL_MS
        }
    }

    /** Key-up. Returns true when it ends a hold, meaning the seek should happen now. */
    fun release(now: Long): Boolean {
        lastInputAt = now
        val wasHolding = holdStartedAt != null
        holdStartedAt = null
        return wasHolding && offsetMs != 0L
    }

    /** True once taps have settled for [tapWindowMs] (never during a hold). */
    fun readyToCommit(now: Long): Boolean = offsetMs != 0L && holdStartedAt == null && now - lastInputAt >= tapWindowMs

    /** Returns the pending offset and clears it. */
    fun take(): Long = offsetMs.also {
        offsetMs = 0
        holdStartedAt = null
    }

    private fun step(direction: SeekDirection) = if (direction == SeekDirection.Back) backStepMs else forwardStepMs

    private fun holdStep(direction: SeekDirection, heldMs: Long): Long = when {
        heldMs < 1_000 -> step(direction)
        heldMs < 3_000 -> max(step(direction), 30_000)
        else -> max(step(direction), 60_000)
    }

    companion object {
        /** Slightly under Android's initial key-repeat delay, so the first repeat starts the hold. */
        const val HOLD_DELAY_MS = 400L
        const val HOLD_INTERVAL_MS = 250L
    }
}
