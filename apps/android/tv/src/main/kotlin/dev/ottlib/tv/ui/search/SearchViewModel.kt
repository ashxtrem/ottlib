package dev.ottlib.tv.ui.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.ottlib.core.network.MovieQuery
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.tv.ui.components.LoadState
import dev.ottlib.tv.ui.components.PosterItem
import dev.ottlib.tv.ui.components.toPosterItem
import dev.ottlib.tv.ui.components.userMessage
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.ExperimentalCoroutinesApi

/** Null results mean "nothing typed yet". */
@OptIn(FlowPreview::class, ExperimentalCoroutinesApi::class)
class SearchViewModel(private val api: OttlibApi) : ViewModel() {
    private val query = MutableStateFlow("")
    val text: StateFlow<String> = query.asStateFlow()
    var lastFocusedId: Long? = null

    val results: StateFlow<LoadState<List<PosterItem>>?> = query
        .map { it.trim() }
        .debounce(350)
        .distinctUntilChanged()
        .flatMapLatest { search(it) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    fun onTextChange(value: String) {
        query.value = value
        lastFocusedId = null
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
}
