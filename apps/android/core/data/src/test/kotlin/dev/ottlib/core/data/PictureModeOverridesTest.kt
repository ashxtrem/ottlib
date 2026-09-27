package dev.ottlib.core.data

import dev.ottlib.core.model.PictureMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PictureModeOverridesTest {
    @Test
    fun roundTripsAndSkipsUnreadableLines() {
        val decoded = PictureModeOverrides.decode("1=Zoom\nbad line\n2=NoSuchMode\n3=Cinema")
        assertEquals(mapOf(1L to PictureMode.Zoom, 3L to PictureMode.Cinema), decoded)
        assertEquals(decoded, PictureModeOverrides.decode(PictureModeOverrides.encode(decoded)))
        assertEquals(emptyMap<Long, PictureMode>(), PictureModeOverrides.decode(null))
    }

    @Test
    fun updatingMovesATitleToMostRecentAndNullForgetsIt() {
        val overrides = PictureModeOverrides.decode("1=Zoom\n2=Stretch")
        PictureModeOverrides.update(overrides, 1, PictureMode.Wide)
        assertEquals(listOf(2L, 1L), overrides.keys.toList())
        PictureModeOverrides.update(overrides, 2, null)
        assertNull(overrides[2])
    }

    @Test
    fun dropsTheLeastRecentlyUsedBeyondTheCap() {
        val overrides = LinkedHashMap<Long, PictureMode>()
        (1L..PictureModeOverrides.MAX_ENTRIES + 5L).forEach { PictureModeOverrides.update(overrides, it, PictureMode.Zoom) }
        assertEquals(PictureModeOverrides.MAX_ENTRIES, overrides.size)
        assertEquals(6L, overrides.keys.first())
    }
}
