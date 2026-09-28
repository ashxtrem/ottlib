package dev.ottlib.core.presentation.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.ottlib.core.network.MovieQuery
import dev.ottlib.core.network.MovieSort
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.presentation.LoadState
import dev.ottlib.core.presentation.PosterItem
import dev.ottlib.core.presentation.toPosterItem
import dev.ottlib.core.presentation.userMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class HomeRow(val key: String, val title: String, val items: List<PosterItem>)

/** Which poster had focus, so returning from a movie puts focus back where the user was. */
data class FocusTarget(val rowKey: String, val itemId: Long)

class HomeViewModel(private val api: OttlibApi) : ViewModel() {
    private val state = MutableStateFlow<LoadState<List<HomeRow>>>(LoadState.Loading)
    val rows: StateFlow<LoadState<List<HomeRow>>> = state.asStateFlow()
    var lastFocus: FocusTarget? = null
    private var resumedOnce = false

    init { load() }

    fun load() {
        viewModelScope.launch {
            if (state.value !is LoadState.Loaded) state.value = LoadState.Loading
            state.value = try { LoadState.Loaded(buildRows()) } catch (error: CancellationException) { throw error } catch (error: Exception) { LoadState.Failed(error.userMessage()) }
        }
    }

    /** Coming back from the player changes progress; refresh just the Continue watching row to keep focus stable. */
    fun onResume() {
        if (!resumedOnce) { resumedOnce = true; return }
        val current = (state.value as? LoadState.Loaded)?.value ?: return load()
        viewModelScope.launch {
            val row = runCatching { continueWatchingRow() }.getOrNull() ?: return@launch
            val others = current.filterNot { it.key == CONTINUE_KEY }
            state.value = LoadState.Loaded(if (row.items.isEmpty()) others else listOf(row) + others)
        }
    }

    private suspend fun continueWatchingRow() = HomeRow(CONTINUE_KEY, "Continue watching", api.continueWatching(20).map { it.toPosterItem(api::resolve) })

    private suspend fun buildRows(): List<HomeRow> = coroutineScope {
        val resolve: (String?) -> String? = api::resolve
        val continueWatching = async { continueWatchingRow() }
        val recent = async { api.movies(MovieQuery(sort = MovieSort.Added, limit = 30)) }
        val unwatched = async { api.movies(MovieQuery(sort = MovieSort.Added, watched = false, limit = 30)) }
        val shelves = async { runCatching { api.shelves() }.getOrDefault(emptyList()) }
        val genres = async { runCatching { api.filterOptions().genres }.getOrDefault(emptyList()) }

        val shelfRows = shelves.await().filter { it.movieCount > 0 }.map { summary ->
            async { runCatching { api.shelf(summary.id) }.getOrNull()?.let { shelf -> HomeRow("shelf-${shelf.id}", shelf.name, shelf.movies.filterNot { it.missing }.map { it.toPosterItem(resolve) }) } }
        }
        val genreRows = homeGenres(genres.await()).map { genre ->
            async { runCatching { api.movies(MovieQuery(genre = genre, sort = MovieSort.Added, limit = 24)) }.getOrNull()?.let { page -> HomeRow("genre-$genre", genre, page.items.map { it.toPosterItem(resolve) }) } }
        }

        listOfNotNull(
            continueWatching.await(),
            HomeRow("recent", "Recently added", recent.await().items.map { it.toPosterItem(resolve) }),
            HomeRow("unwatched", "Unwatched", unwatched.await().items.map { it.toPosterItem(resolve) }),
        ).plus(shelfRows.awaitAll().filterNotNull()).plus(genreRows.awaitAll().filterNotNull()).filter { it.items.isNotEmpty() }
    }

    companion object {
        const val CONTINUE_KEY = "continue"
        private val preferredGenres = listOf("Action", "Comedy", "Drama", "Thriller", "Science Fiction", "Animation", "Crime", "Horror", "Romance", "Adventure")

        /** A handful of familiar genre rows, falling back to whatever genres the library has. */
        fun homeGenres(available: List<String>, count: Int = 6): List<String> =
            (preferredGenres.filter { it in available } + available.sorted()).distinct().take(count)
    }
}
