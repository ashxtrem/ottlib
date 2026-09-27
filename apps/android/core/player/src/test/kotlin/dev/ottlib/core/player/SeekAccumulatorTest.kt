package dev.ottlib.core.player

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SeekAccumulatorTest {
    private fun accumulator() = SeekAccumulator(backStepMs = 10_000, forwardStepMs = 10_000, tapWindowMs = 400)

    /** Simulates holding a key from [downAt] until [upAt], with key repeats every 50 ms after the initial delay. */
    private fun SeekAccumulator.holdKey(direction: SeekDirection, downAt: Long, upAt: Long): Boolean {
        press(direction, downAt)
        var t = downAt + 500
        while (t < upAt) {
            hold(direction, downAt, t)
            t += 50
        }
        return release(upAt)
    }

    @Test
    fun aTapAddsOneStepAndCommitsAfterTheTapWindow() {
        val seek = accumulator()
        seek.press(SeekDirection.Forward, now = 0)
        assertFalse(seek.release(now = 80))
        assertEquals(10_000, seek.pendingOffsetMs)
        assertFalse(seek.readyToCommit(now = 300))
        assertTrue(seek.readyToCommit(now = 480))
        assertEquals(10_000, seek.take())
        assertEquals(0, seek.pendingOffsetMs)
    }

    @Test
    fun quickTapsCoalesceIntoOneSeek() {
        val seek = accumulator()
        listOf(0L, 200L, 400L).forEach { t ->
            seek.press(SeekDirection.Forward, t)
            seek.release(t + 60)
        }
        assertFalse(seek.readyToCommit(now = 700))
        assertTrue(seek.readyToCommit(now = 860))
        assertEquals(30_000, seek.take())
    }

    @Test
    fun reversingDirectionStartsOver() {
        val seek = accumulator()
        seek.press(SeekDirection.Forward, 0)
        seek.press(SeekDirection.Forward, 100)
        seek.press(SeekDirection.Back, 200)
        assertEquals(-10_000, seek.pendingOffsetMs)
    }

    @Test
    fun usesTheConfiguredStepPerDirection() {
        val seek = SeekAccumulator(backStepMs = 5_000, forwardStepMs = 30_000)
        seek.press(SeekDirection.Back, 0)
        assertEquals(-5_000, seek.pendingOffsetMs)
        seek.take()
        seek.press(SeekDirection.Forward, 1_000)
        assertEquals(30_000, seek.pendingOffsetMs)
    }

    @Test
    fun holdingAcceleratesAndCommitsOnRelease() {
        val shortHold = accumulator()
        assertTrue(shortHold.holdKey(SeekDirection.Forward, downAt = 0, upAt = 900))
        // Tap step + hold steps at 500 and 750 ms, all 10s.
        assertEquals(30_000, shortHold.pendingOffsetMs)

        val longHold = accumulator()
        assertTrue(longHold.holdKey(SeekDirection.Forward, downAt = 0, upAt = 4_000))
        // 10s tap + 10s×2 (0.5–1s) + 30s×8 (1–3s) + 60s×4 (3–4s)
        assertEquals(10_000L + 20_000 + 240_000 + 240_000, longHold.pendingOffsetMs)
    }

    @Test
    fun keyRepeatRateDoesNotChangeTheHoldSpeed() {
        val slowRepeats = accumulator().apply {
            press(SeekDirection.Forward, 0)
            listOf(500L, 1_000L).forEach { hold(SeekDirection.Forward, 0, it) }
        }
        val fastRepeats = accumulator().apply {
            press(SeekDirection.Forward, 0)
            (500L..1_000L step 10).forEach { hold(SeekDirection.Forward, 0, it) }
        }
        assertEquals(fastRepeats.pendingOffsetMs, slowRepeats.pendingOffsetMs)
    }

    @Test
    fun neverCommitsMidHold() {
        val seek = accumulator()
        seek.press(SeekDirection.Back, 0)
        seek.hold(SeekDirection.Back, 0, 600)
        assertFalse(seek.readyToCommit(now = 5_000))
    }

    @Test
    fun aHeldLargeStepIsNotShrunkByAcceleration() {
        val seek = SeekAccumulator(backStepMs = 10_000, forwardStepMs = 60_000)
        seek.press(SeekDirection.Forward, 0)
        seek.hold(SeekDirection.Forward, 0, 500)
        assertEquals(120_000, seek.pendingOffsetMs)
    }
}
