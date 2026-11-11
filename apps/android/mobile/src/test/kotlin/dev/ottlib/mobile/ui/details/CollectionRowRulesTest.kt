package dev.ottlib.mobile.ui.details

import dev.ottlib.core.presentation.PosterItem
import dev.ottlib.core.presentation.details.CollectionSummary
import dev.ottlib.core.presentation.details.MissingPart
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CollectionRowRulesTest {
    private val owned = PosterItem(1, "Part One", 2001, null, null, watched = false, resumePositionMs = null, durationMs = null)
    private val part = MissingPart("Part Two", 2003, "/media/posters/two.jpg")
    private val saga = CollectionSummary(7, "Saga", listOf(owned), missingCount = 1, missing = listOf(part))

    @Test
    fun missingCardsAppearOnlyInHashlarkMode() {
        assertEquals(listOf(part), saga.missingCards(findAvailable = true))
        assertEquals(emptyList<MissingPart>(), saga.missingCards(findAvailable = false))
    }

    @Test
    fun theCountLineStaysWhenNotInHashlarkMode() {
        assertTrue(saga.showsMissingCount(findAvailable = false))
        assertFalse(saga.showsMissingCount(findAvailable = true))
    }

    @Test
    fun aCollectionWithOnlyMissingPartsStillShows() {
        val onlyMissing = saga.copy(owned = emptyList())
        assertTrue(onlyMissing.hasAnythingToShow(findAvailable = true))
        assertTrue(onlyMissing.hasAnythingToShow(findAvailable = false))
    }

    @Test
    fun anEmptyCollectionHides() {
        val empty = CollectionSummary(7, "Saga", emptyList(), missingCount = 0, missing = emptyList())
        assertFalse(empty.hasAnythingToShow(findAvailable = true))
        assertFalse(empty.hasAnythingToShow(findAvailable = false))
    }
}
