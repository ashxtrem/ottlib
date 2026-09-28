package dev.ottlib.core.presentation.library

import dev.ottlib.core.network.MovieSort
import dev.ottlib.core.presentation.Choice

/** The library filter options, labelled the same on every client. */
object LibraryChoices {
    val sort = listOf(Choice("Title", MovieSort.Title), Choice("Recently added", MovieSort.Added), Choice("Year", MovieSort.Year), Choice("Quality", MovieSort.Quality))
    val watched: List<Choice<Boolean?>> = listOf(Choice("All", null), Choice("Unwatched", false), Choice("Watched", true))
    val type: List<Choice<String?>> = listOf(Choice("All", null), Choice("Movies", "movie"), Choice("TV episodes", "tv"))
}
