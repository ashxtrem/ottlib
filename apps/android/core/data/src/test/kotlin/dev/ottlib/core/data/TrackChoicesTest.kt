package dev.ottlib.core.data

import dev.ottlib.core.model.TrackChoice
import dev.ottlib.core.model.TrackIdentity
import org.junit.Assert.assertEquals
import org.junit.Test

class TrackChoicesTest {
    private val hindi = TrackChoice(audio = TrackIdentity("hi", null, "ac3", 6), subtitle = TrackIdentity("en", "English (external file)", "application/x-subrip", external = true))
    private val off = TrackChoice(audio = TrackIdentity("en", "Atmos", "eac3", 8), subtitlesOff = true)

    @Test
    fun roundTripsAndIgnoresCorruptData() {
        val choices = linkedMapOf(7L to hindi, 9L to off)
        assertEquals(choices, TrackChoices.decode(TrackChoices.encode(choices)))
        assertEquals(emptyMap<Long, TrackChoice>(), TrackChoices.decode("not json"))
        assertEquals(emptyMap<Long, TrackChoice>(), TrackChoices.decode(null))
    }

    @Test
    fun updatingMovesATitleToMostRecentAndCapsTheSize() {
        val choices = TrackChoices.decode(TrackChoices.encode(linkedMapOf(1L to hindi, 2L to off)))
        TrackChoices.update(choices, 1L, off)
        assertEquals(listOf(2L, 1L), choices.keys.toList())
        assertEquals(off, choices[1L])

        val many = LinkedHashMap<Long, TrackChoice>()
        (1L..TrackChoices.MAX_ENTRIES + 3L).forEach { TrackChoices.update(many, it, hindi) }
        assertEquals(TrackChoices.MAX_ENTRIES, many.size)
        assertEquals(4L, many.keys.first())
    }
}
