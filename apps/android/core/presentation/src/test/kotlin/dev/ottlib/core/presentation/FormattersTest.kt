package dev.ottlib.core.presentation

import dev.ottlib.core.model.OutsideRating
import org.junit.Assert.assertEquals
import org.junit.Test

class FormattersTest {
    @Test fun ratingsReadAsTheOutsideSitesWriteThem() {
        val ratings = listOf(OutsideRating("imdb", 8.8, 10.0), OutsideRating("rottenTomatoes", 87.0, 100.0), OutsideRating("metacritic", 74.0, 100.0))
        assertEquals("IMDb 8.8  ·  RT 87%  ·  MC 74", ratings.ratingsLine())
        assertEquals("RT 87%", ratings.filter { it.source == "rottenTomatoes" }.ratingsLine())
        assertEquals("IMDb 7.0", listOf(OutsideRating("imdb", 7.0, 10.0)).ratingsLine())
    }

    @Test fun unknownSourcesAreSkippedAndNoRatingsGiveAnEmptyLine() {
        assertEquals("MC 50", listOf(OutsideRating("letterboxd", 4.1, 5.0), OutsideRating("metacritic", 50.0, 100.0)).ratingsLine())
        assertEquals("", emptyList<OutsideRating>().ratingsLine())
    }
}
