package dev.ottlib.core.data

import dev.ottlib.core.model.HiddenTitle
import dev.ottlib.core.model.hiddenDisplayTitle
import dev.ottlib.core.model.hideKeyOf
import org.junit.Assert.assertEquals
import org.junit.Test

class HiddenTitlesTest {
    private val movie = HiddenTitle(hideKeyOf(1, null), 1, "Alien", 1979, "/media/posters/a.jpg", isShow = false)
    private val show = HiddenTitle(hideKeyOf(9, "tv:imdb:tt11280740"), 9, "Severance", 2022, null, isShow = true)

    @Test
    fun hidesAMovieByIdAndAShowOnceHoweverManyEpisodes() {
        val episodeTwo = show
        val episodeThree = show.copy(id = 10)
        val list = HiddenTitles.with(HiddenTitles.with(HiddenTitles.with(emptyList(), movie), episodeTwo), episodeThree)
        assertEquals(listOf("m:1", "tv:imdb:tt11280740"), list.map { it.key })
        assertEquals(10L, list.last().id)
    }

    @Test
    fun roundTripsUnhidesAndIgnoresCorruptData() {
        val list = listOf(movie, show)
        assertEquals(list, HiddenTitles.decode(HiddenTitles.encode(list)))
        assertEquals(listOf(show), HiddenTitles.without(list, "m:1"))
        assertEquals(emptyList<HiddenTitle>(), HiddenTitles.decode("not json"))
        assertEquals(emptyList<HiddenTitle>(), HiddenTitles.decode(null))
    }

    @Test
    fun showsTheShowNameRatherThanTheEpisodeTitle() {
        assertEquals("Breaking Bad", hiddenDisplayTitle("Breaking Bad · S1E2 · Cat's in the Bag...", "tv:imdb:tt0903747"))
        assertEquals("Dune · Part Two", hiddenDisplayTitle("Dune · Part Two", null))
    }
}
