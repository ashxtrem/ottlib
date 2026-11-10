package dev.ottlib.core.presentation

import dev.ottlib.core.model.MovieListItem
import org.junit.Assert.assertEquals
import org.junit.Test

class PosterItemTest {
    private fun listItem(fresh: String?) =
        MovieListItem(1, "Alien", 1979, null, null, null, false, null, null, false, "matched", emptyList(), fresh = fresh)

    @Test fun isNewFollowsTheFreshMark() {
        assertEquals(true, listItem("new").toPosterItem { it }.isNew)
        assertEquals(false, listItem(null).toPosterItem { it }.isNew)
        assertEquals(false, listItem("").toPosterItem { it }.isNew)
    }

    @Test fun isNewDefaultsToFalse() {
        assertEquals(false, PosterItem(1, "Alien", 1979, null, null, false, null, null).isNew)
    }
}
