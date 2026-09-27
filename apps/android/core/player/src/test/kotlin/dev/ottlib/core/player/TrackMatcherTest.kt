package dev.ottlib.core.player

import dev.ottlib.core.model.TrackIdentity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TrackMatcherTest {
    private val englishAtmos = TrackIdentity("en", "Dolby Atmos", "eac3", 8)
    private val englishStereo = TrackIdentity("en", "Stereo", "aac", 2)
    private val hindi = TrackIdentity("hi", null, "ac3", 6)

    @Test
    fun prefersTheSameLabelThenCodecThenChannels() {
        val tracks = listOf(englishStereo, hindi, englishAtmos)
        assertEquals(2, TrackMatcher.bestMatch(TrackIdentity("en", "Dolby Atmos", "eac3", 8), tracks))
        assertEquals(0, TrackMatcher.bestMatch(TrackIdentity("en", null, "aac", 2), tracks))
        assertEquals(1, TrackMatcher.bestMatch(TrackIdentity("hi", null, null, null), tracks))
    }

    @Test
    fun survivesAReEncodeThatChangedTheCodec() {
        val reEncoded = listOf(TrackIdentity("hi", null, "aac", 2), TrackIdentity("en", "Dolby Atmos", "truehd", 8))
        assertEquals(1, TrackMatcher.bestMatch(englishAtmos, reEncoded))
    }

    @Test
    fun neverSubstitutesAnotherLanguage() {
        assertNull(TrackMatcher.bestMatch(TrackIdentity("ja"), listOf(englishStereo, hindi)))
    }

    @Test
    fun distinguishesExternalSubtitleFilesFromEmbeddedOnes() {
        val embedded = TrackIdentity("en", null, "application/x-subrip", external = false)
        val external = TrackIdentity("en", "English (external file)", "application/x-subrip", external = true)
        assertEquals(1, TrackMatcher.bestMatch(TrackIdentity("en", null, "application/x-subrip", external = true), listOf(embedded, external)))
        assertEquals(0, TrackMatcher.bestMatch(TrackIdentity("en", null, "application/x-subrip", external = false), listOf(embedded, external)))
    }

    @Test
    fun treatsUnknownLanguagesAsTheSame() {
        assertEquals(0, TrackMatcher.bestMatch(TrackIdentity("und"), listOf(TrackIdentity(null), englishStereo)))
    }
}
