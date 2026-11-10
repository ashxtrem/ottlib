package dev.ottlib.core.presentation.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.ottlib.core.data.RecentSearches
import dev.ottlib.core.network.MovieQuery
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.presentation.LoadState
import dev.ottlib.core.presentation.PosterItem
import dev.ottlib.core.presentation.hidden.withoutHidden
import dev.ottlib.core.presentation.toPosterItem
import dev.ottlib.core.presentation.userMessage
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Null results mean "nothing typed yet". */
@OptIn(FlowPreview::class, ExperimentalCoroutinesApi::class)
class SearchViewModel(
    private val api: OttlibApi,
    hiddenKeys: Flow<Set<String>>,
    private val recentSearches: RecentSearches,
    /** Which server and profile recents belong to (see RecentSearchScope); null while none is active. */
    private val recentScope: Flow<String?>,
) : ViewModel() {
    private val query = MutableStateFlow("")
    val text: StateFlow<String> = query.asStateFlow()
    var lastFocusedId: Long? = null

    private val found: Flow<LoadState<List<PosterItem>>?> = query
        .map { it.trim() }
        .combine(api.libraryRevision) { term, revision -> term to revision }
        .debounce(SEARCH_DEBOUNCE_MS)
        .distinctUntilChanged()
        .flatMapLatest { search(it.first) }

    /** Search results minus titles hidden on this device. */
    val results: StateFlow<LoadState<List<PosterItem>>?> = combine(found, hiddenKeys) { result, hidden ->
        if (result is LoadState.Loaded && hidden.isNotEmpty()) LoadState.Loaded(result.value.withoutHidden(hidden)) else result
    }.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    /** Recent searches for the current server and profile, newest first. */
    val recents: StateFlow<List<String>> = recentScope
        .flatMapLatest { scope -> if (scope == null) flowOf(emptyList()) else recentSearches.flow(scope) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    init {
        // A query counts as a search once it has stayed put for a while after the results debounce.
        viewModelScope.launch {
            query
                .map { it.trim() }
                .debounce(SEARCH_DEBOUNCE_MS + SAVE_HOLD_MS)
                .filter { it.length >= MIN_SAVED_LENGTH }
                .collect { term -> recentScope.first()?.let { recentSearches.add(it, term) } }
        }
    }

    fun onTextChange(value: String) {
        query.value = value
        lastFocusedId = null
    }

    /** Runs a recent search again by putting it in the box. */
    fun useRecent(term: String) = onTextChange(term)

    fun removeRecent(term: String) {
        viewModelScope.launch { recentScope.first()?.let { recentSearches.remove(it, term) } }
    }

    private fun search(term: String): Flow<LoadState<List<PosterItem>>?> = flow {
        if (term.isEmpty()) { emit(null); return@flow }
        emit(LoadState.Loading)
        emit(
            try { LoadState.Loaded(api.movies(MovieQuery(search = term, limit = 60)).items.map { it.toPosterItem(api::resolve) }) }
            catch (error: kotlinx.coroutines.CancellationException) { throw error }
            catch (error: Exception) { LoadState.Failed(error.userMessage()) },
        )
    }

    private companion object {
        const val SEARCH_DEBOUNCE_MS = 350L
        const val SAVE_HOLD_MS = 1500L
        const val MIN_SAVED_LENGTH = 2
    }
}
