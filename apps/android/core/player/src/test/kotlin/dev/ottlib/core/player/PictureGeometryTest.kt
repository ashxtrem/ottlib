package dev.ottlib.core.player

import dev.ottlib.core.model.PictureArea
import dev.ottlib.core.model.PictureMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PictureGeometryTest {
    private val screen = 16f / 9f

    @Test
    fun smartFillSplitsAScopeFilmBetweenTrimAndStretch() {
        val scope = 2.40f
        val frame = PictureGeometry.smartFillAspectRatio(scope, screen)
        val trimmed = PictureGeometry.trimmedFraction(frame, screen)
        val stretched = PictureGeometry.distortion(scope, frame)

        // Zoom alone trims ~26%; Stretch alone distorts ~35%. Smart fill does roughly half of each.
        assertEquals(0.26f, PictureGeometry.trimmedFraction(scope, screen), 0.01f)
        assertEquals(0.35f, PictureGeometry.distortion(scope, screen), 0.01f)
        assertEquals(0.14f, trimmed, 0.01f)
        assertEquals(0.16f, stretched, 0.01f)
    }

    @Test
    fun smartFillWorksForNarrowerContentToo() {
        val standard = 4f / 3f
        val frame = PictureGeometry.smartFillAspectRatio(standard, screen)
        assertTrue(frame > standard && frame < screen)
        assertEquals(0.13f, PictureGeometry.trimmedFraction(frame, screen), 0.01f)
    }

    @Test
    fun matchingShapesNeedNeitherTrimNorStretch() {
        val frame = PictureGeometry.smartFillAspectRatio(screen, screen)
        assertEquals(screen, frame, 0.0001f)
        assertEquals(0f, PictureGeometry.trimmedFraction(frame, screen), 0.0001f)
        assertEquals(0f, PictureGeometry.distortion(screen, frame), 0.0001f)
    }

    // Mummy 4K: a 3840×2160 frame holding a 3840×1632 picture at y=264.
    private val mummy = PictureArea(x = 0f, y = 0.1222f, width = 1f, height = 0.7556f)
    private val wholeFrame = PictureArea(x = 0f, y = 0f, width = 1f, height = 1f)

    private fun rect(mode: PictureMode, video: Float, area: PictureArea, w: Float = 1920f, h: Float = 1080f) =
        PictureGeometry.frameRect(mode.scaling, mode.aspectRatio, video, area, w, h)

    private fun assertRect(expected: FrameRect, actual: FrameRect) {
        assertEquals(expected.width, actual.width, 1f)
        assertEquals(expected.height, actual.height, 1f)
        assertEquals(expected.left, actual.left, 1f)
        assertEquals(expected.top, actual.top, 1f)
    }

    /** The on-screen rectangle of the real picture inside a placed frame. */
    private fun activeOnScreen(frame: FrameRect, area: PictureArea) =
        FrameRect(frame.width * area.width, frame.height * area.height, frame.left + area.x * frame.width, frame.top + area.y * frame.height)

    @Test
    fun fitWithTheAreaFitsTheRealPicture() {
        val frame = rect(PictureMode.Fit, screen, mummy)
        // The scope picture fills the width; the burned-in bars land where Fit's bars would be anyway.
        assertRect(FrameRect(1920f, 1080f, 0f, 0f), frame)
        val active = activeOnScreen(frame, mummy)
        assertEquals(1920f, active.width, 1f)
        assertEquals(816f, active.height, 1f)
        assertEquals(132f, active.top, 1f)
    }

    @Test
    fun zoomWithTheAreaCoversTheScreenWithTheRealPicture() {
        val frame = rect(PictureMode.Zoom, screen, mummy)
        assertEquals(1080f / 0.7556f, frame.height, 1f) // ≈ 1429: the frame is taller than the screen
        val active = activeOnScreen(frame, mummy)
        assertEquals(1080f, active.height, 1f)
        assertEquals(0f, active.top, 1f)
        assertEquals(1920f / 2f, active.left + active.width / 2f, 1f)
        assertTrue(active.width > 1920f)
    }

    @Test
    fun stretchWithTheAreaFillsTheScreenWithTheRealPicture() {
        val active = activeOnScreen(rect(PictureMode.Stretch, screen, mummy), mummy)
        assertRect(FrameRect(1920f, 1080f, 0f, 0f), active)
    }

    @Test
    fun smartFillWithTheAreaCoversTheScreenAtTheMeanShape() {
        val active = activeOnScreen(rect(PictureMode.SmartFill, screen, mummy), mummy)
        val mean = PictureGeometry.smartFillAspectRatio(screen / 0.7556f, screen)
        assertEquals(1080f, active.height, 1f)
        assertEquals(1080f * mean, active.width, 1f)
        assertEquals(960f, active.left + active.width / 2f, 1f)
    }

    @Test
    fun aForcedRatioFitsThatRatioWithTheRealPicture() {
        val active = activeOnScreen(rect(PictureMode.Standard, screen, mummy), mummy)
        assertRect(FrameRect(1440f, 1080f, 240f, 0f), active)
    }

    @Test
    fun theWholeFrameAsTheAreaMatchesTodaysFitAndZoom() {
        val scope = 2.40f
        assertRect(FrameRect(1920f, 800f, 0f, 140f), rect(PictureMode.Fit, scope, wholeFrame))
        assertRect(FrameRect(2592f, 1080f, -336f, 0f), rect(PictureMode.Zoom, scope, wholeFrame))
        assertRect(FrameRect(1920f, 1080f, 0f, 0f), rect(PictureMode.Fit, screen, wholeFrame))
    }

    @Test
    fun aWiderScreenShowsTheRealPictureWider() {
        val sixteenNine = activeOnScreen(rect(PictureMode.Fit, screen, mummy), mummy)
        val twentyNine = activeOnScreen(rect(PictureMode.Fit, screen, mummy, w = 2400f, h = 1080f), mummy)
        assertTrue(twentyNine.width > sixteenNine.width)
        assertEquals(2400f, twentyNine.width, 1f)
        assertEquals(0f, twentyNine.left, 1f)
    }
}
