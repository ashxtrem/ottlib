package dev.ottlib.core.player

import androidx.media3.common.MimeTypes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SubtitleMimeTypeTest {
    @Test
    fun mapsServerSubtitleCodecsToMedia3MimeTypes() {
        assertEquals(MimeTypes.APPLICATION_SUBRIP, subtitleMimeType("SRT"))
        assertEquals(MimeTypes.TEXT_SSA, subtitleMimeType("ASS"))
        assertEquals(MimeTypes.TEXT_SSA, subtitleMimeType("ssa"))
        assertEquals(MimeTypes.TEXT_VTT, subtitleMimeType("WebVTT"))
        assertNull(subtitleMimeType("VobSub"))
        assertNull(subtitleMimeType(null))
    }
}
