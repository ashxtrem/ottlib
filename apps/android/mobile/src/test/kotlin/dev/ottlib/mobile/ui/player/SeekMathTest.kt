package dev.ottlib.mobile.ui.player

import org.junit.Assert.assertEquals
import org.junit.Test

class SeekMathTest {
    @Test
    fun fullSwipeMovesTheFullSwipeDistance() {
        assertEquals(SeekMath.FULL_SWIPE_MS, SeekMath.swipeOffsetMs(1f))
        assertEquals(-SeekMath.FULL_SWIPE_MS, SeekMath.swipeOffsetMs(-1f))
    }

    @Test
    fun swipeOffsetsAreWholeSeconds() {
        assertEquals(18_000L, SeekMath.swipeOffsetMs(0.1f))
        assertEquals(0L, SeekMath.swipeOffsetMs(0.002f))
    }

    @Test
    fun targetStaysInsideTheTitle() {
        assertEquals(0L, SeekMath.target(positionMs = 5_000, offsetMs = -30_000, durationMs = 100_000))
        assertEquals(99_000L, SeekMath.target(positionMs = 90_000, offsetMs = 30_000, durationMs = 100_000))
        assertEquals(40_000L, SeekMath.target(positionMs = 10_000, offsetMs = 30_000, durationMs = 100_000))
    }

    @Test
    fun unknownDurationOnlyClampsAtZero() {
        assertEquals(1_000_000L, SeekMath.target(positionMs = 970_000, offsetMs = 30_000, durationMs = null))
        assertEquals(0L, SeekMath.target(positionMs = 1_000, offsetMs = -10_000, durationMs = 0))
    }
}
