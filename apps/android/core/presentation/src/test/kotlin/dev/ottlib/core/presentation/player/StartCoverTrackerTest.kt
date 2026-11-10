package dev.ottlib.core.presentation.player

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StartCoverTrackerTest {
    private val frames = { positionMs: Long -> "http://server/frames/$positionMs.jpg" }

    @Test
    fun noCoverBeforeDetails() {
        assertNull(StartCoverTracker().startCover.value)
    }

    @Test
    fun backdropWhenResumeIsZero() {
        val tracker = StartCoverTracker()
        tracker.detailsLoaded("Heat", "http://server/backdrop.jpg")
        tracker.resumeAt(0, frames)
        assertEquals(StartCover("Heat", "http://server/backdrop.jpg"), tracker.startCover.value)
    }

    @Test
    fun resumeFrameReplacesBackdropAboveZero() {
        val tracker = StartCoverTracker()
        tracker.detailsLoaded("Heat", "http://server/backdrop.jpg")
        assertEquals("http://server/backdrop.jpg", tracker.startCover.value?.imageUrl)
        tracker.resumeAt(90_000, frames)
        assertEquals(StartCover("Heat", "http://server/frames/90000.jpg"), tracker.startCover.value)
    }

    @Test
    fun keepsBackdropWhenSourceHasNoFrames() {
        val tracker = StartCoverTracker()
        tracker.detailsLoaded("Heat", "http://server/backdrop.jpg")
        tracker.resumeAt(90_000) { null }
        assertEquals("http://server/backdrop.jpg", tracker.startCover.value?.imageUrl)
    }

    @Test
    fun firstFrameFlagResetsOnNewItem() {
        val tracker = StartCoverTracker()
        tracker.newItem()
        assertFalse(tracker.firstFrameShown.value)
        tracker.frameRendered()
        assertTrue(tracker.firstFrameShown.value)
        tracker.newItem() // the swap to the server's stream
        assertFalse(tracker.firstFrameShown.value)
        tracker.frameRendered()
        assertTrue(tracker.firstFrameShown.value)
    }
}
