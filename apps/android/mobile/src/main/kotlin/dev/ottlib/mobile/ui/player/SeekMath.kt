package dev.ottlib.mobile.ui.player

import kotlin.math.max
import kotlin.math.roundToLong

/** Seek arithmetic for touch input. Pure, so the rules are unit-tested. */
object SeekMath {
    /** A swipe across the whole width of the video moves this far; shorter swipes scale linearly. */
    const val FULL_SWIPE_MS = 180_000L

    /** Offset for a horizontal swipe of [fractionOfWidth] (negative = leftwards), in whole seconds. */
    fun swipeOffsetMs(fractionOfWidth: Float): Long = (fractionOfWidth * FULL_SWIPE_MS / 1_000).roundToLong() * 1_000

    /** Clamped to the title; stops a second short of the end so a forward seek doesn't immediately finish the movie. */
    fun target(positionMs: Long, offsetMs: Long, durationMs: Long?): Long {
        val target = positionMs + offsetMs
        if (durationMs == null || durationMs <= 0) return max(0, target)
        return target.coerceIn(0, max(0, durationMs - 1_000))
    }
}
