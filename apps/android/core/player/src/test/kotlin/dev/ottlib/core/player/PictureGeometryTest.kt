package dev.ottlib.core.player

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
}
