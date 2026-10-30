package dev.ottlib.core.player

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ScrubSessionTest {
    private fun opened(base: Long = 60_000, duration: Long = 600_000) = ScrubSession().apply { open(base, duration) }

    @Test
    fun opensAtTheBase() {
        val session = ScrubSession()
        assertFalse(session.isOpen)
        session.open(basePositionMs = 60_000, durationMs = 600_000)
        assertTrue(session.isOpen)
        assertEquals(60_000, session.base)
        assertEquals(60_000, session.head)
    }

    @Test
    fun moveAddsToTheHeadAndLeavesTheBase() {
        val session = opened()
        assertEquals(70_000, session.move(10_000))
        assertEquals(40_000, session.move(-30_000))
        assertEquals(40_000, session.head)
        assertEquals(60_000, session.base)
    }

    @Test
    fun moveClampsAtZero() {
        val session = opened(base = 5_000)
        assertEquals(0, session.move(-30_000))
        assertEquals(10_000, session.move(10_000))
    }

    @Test
    fun moveClampsOneSecondBeforeTheEnd() {
        val session = opened(base = 590_000)
        assertEquals(599_000, session.move(60_000))
        assertEquals(599_000, session.move(10_000))
    }

    @Test
    fun anUnknownDurationOnlyClampsAtZero() {
        val session = opened(base = 10_000, duration = 0)
        assertEquals(3_610_000, session.move(3_600_000))
        assertEquals(0, session.move(-9_999_999))
    }

    @Test
    fun idleDueOnlyAfterTwoSecondsSinceTheLastKey() {
        val session = opened()
        session.touched(10_000)
        assertFalse(session.idleDue(10_000))
        assertFalse(session.idleDue(11_999))
        assertTrue(session.idleDue(12_000))
        session.touched(11_500)
        assertFalse(session.idleDue(12_000))
        assertTrue(session.idleDue(13_500))
    }

    @Test
    fun aHoldInProgressIsNeverIdle() {
        val session = opened()
        session.touched(0)
        session.holding = true
        assertFalse(session.idleDue(60_000))
        session.holding = false
        assertTrue(session.idleDue(60_000))
    }

    @Test
    fun notIdleWhenClosed() {
        val session = ScrubSession()
        session.touched(0)
        assertFalse(session.idleDue(60_000))
    }

    @Test
    fun commitReturnsTheHeadAndCloses() {
        val session = opened()
        session.move(25_000)
        session.holding = true
        assertEquals(85_000, session.commit())
        assertFalse(session.isOpen)
        assertFalse(session.holding)
    }

    @Test
    fun cancelReturnsTheBaseAndCloses() {
        val session = opened()
        session.move(25_000)
        assertEquals(60_000, session.cancel())
        assertFalse(session.isOpen)
    }

    @Test
    fun reopeningStartsFresh() {
        val session = opened()
        session.move(25_000)
        session.holding = true
        session.commit()
        session.open(basePositionMs = 100_000, durationMs = 600_000)
        assertEquals(100_000, session.base)
        assertEquals(100_000, session.head)
        assertFalse(session.holding)
    }
}
