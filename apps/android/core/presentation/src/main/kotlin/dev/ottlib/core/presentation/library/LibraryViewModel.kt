package dev.ottlib.core.presentation.library

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.ottlib.core.network.MovieQuery
import dev.ottlib.core.network.MovieSort
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.presentation.PosterItem
import dev.ottlib.core.presentation.sync.LibrarySync
import dev.ottlib.core.presentation.sync.SyncOutcome
import dev.ottlib.core.presentation.toPosterItem
import dev.ottlib.core.presentation.userMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LibraryFilters(
    val sort: MovieSort = MovieSort.Title,
    val watched: Boolean? = null,
    val genre: String? = null,
    val mediaType: String? = null,
)

data class LibraryUiState(
    val filters: LibraryFilters = LibraryFilters(),
    val items: List<PosterItem> = emptyList(),
    val total: Int? = null,
    val loading: Boolean = true,
    val error: String? = null,
    val nextCursor: String? = null,
    val genres: List<String> = emptyList(),
)

/** The full library as a filterable, cursor-paged grid (same query parameters as the web library). */
class LibraryViewModel(private val api: OttlibApi, sync: LibrarySync) : ViewModel() {
    private val state = MutableStateFlow(LibraryUiState())
    val uiState: StateFlow<LibraryUiState> = state.asStateFlow()
    private var page: Job? = null
    /** Restores focus to the same poster after returning from a movie. */
    var lastFocusedId: Long? = null

    init {
        loadGenres()
        reload()
        viewModelScope.launch {
            api.watchChange.collect { change ->
                if (change == null) return@collect
                state.update { current -> current.copy(items = current.items.map {
                    if (it.id == change.movieId) it.copy(watched = change.watched, resumePositionMs = if (change.watched) null else it.resumePositionMs) else it
                }) }
                if (state.value.filters.watched != null) reload()
            }
        }
        // A finished sync may have added titles (and genres): refresh the grid and the genre choices.
        viewModelScope.launch {
            sync.outcomes.collect {
                if (it is SyncOutcome.Done) {
                    loadGenres()
                    reload()
                }
            }
        }
    }

    private fun loadGenres() {
        viewModelScope.launch { runCatching { api.filterOptions().genres }.onSuccess { genres -> state.update { it.copy(genres = genres) } } }
    }

    fun setFilters(filters: LibraryFilters) {
        if (filters == state.value.filters) return
        state.update { it.copy(filters = filters) }
        lastFocusedId = null
        reload()
    }

    fun reload() {
        page?.cancel()
        state.update { it.copy(items = emptyList(), total = null, nextCursor = null, error = null) }
        fetch(cursor = null)
    }

    /** Called as focus nears the end of the loaded items. */
    fun loadMore() {
        val current = state.value
        if (current.loading || current.nextCursor == null) return
        fetch(current.nextCursor)
    }

    private fun fetch(cursor: String?) {
        state.update { it.copy(loading = true) }
        val filters = state.value.filters
        page = viewModelScope.launch {
            try {
                val result = api.movies(MovieQuery(watched = filters.watched, genre = filters.genre, mediaType = filters.mediaType, sort = filters.sort, limit = PAGE_SIZE, cursor = cursor))
                val change = api.watchChange.value
                val posters = result.items.map { item ->
                    item.toPosterItem(api::resolve).let { poster ->
                        if (change?.movieId == poster.id) poster.copy(watched = change.watched, resumePositionMs = if (change.watched) null else poster.resumePositionMs) else poster
                    }
                }
                state.update { it.copy(items = it.items + posters, total = result.total, nextCursor = result.nextCursor, loading = false) }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                state.update { it.copy(loading = false, error = error.userMessage()) }
            }
        }
    }

    companion object { const val PAGE_SIZE = 48 }
}
