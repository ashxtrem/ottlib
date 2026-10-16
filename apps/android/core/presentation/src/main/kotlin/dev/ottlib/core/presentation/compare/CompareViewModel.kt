package dev.ottlib.core.presentation.compare

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.presentation.ContinueWatchingPublisher
import dev.ottlib.core.presentation.LoadState
import dev.ottlib.core.presentation.userMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch

/** What the screen should do after a copy was deleted. */
sealed interface CompareEvent {
    /** The copy being viewed was deleted: carry on with a copy that still exists. */
    data class OpenOther(val movieId: Long) : CompareEvent

    /** No other copies are left to compare. */
    data object Close : CompareEvent
}

class CompareViewModel(
    private val api: OttlibApi,
    private val continueWatching: ContinueWatchingPublisher,
    private val appScope: CoroutineScope,
    val movieId: Long,
) : ViewModel() {
    private val state = MutableStateFlow<LoadState<CopyComparison>>(LoadState.Loading)
    val comparison: StateFlow<LoadState<CopyComparison>> = state.asStateFlow()
    private val working = MutableStateFlow(false)
    val deleting: StateFlow<Boolean> = working.asStateFlow()
    private val failure = MutableStateFlow<String?>(null)
    /** The server's reason a delete was refused or failed, until dismissed. */
    val deleteError: StateFlow<String?> = failure.asStateFlow()
    private val outcomes = Channel<CompareEvent>(Channel.BUFFERED)
    val events = outcomes.receiveAsFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            state.value = try {
                LoadState.Loaded(compareCopies(api.movie(movieId), api.duplicates(movieId)))
            } catch (error: CancellationException) { throw error } catch (error: Exception) { LoadState.Failed(error.userMessage()) }
        }
    }

    fun dismissError() { failure.value = null }

    /** Permanently deletes [copyId]'s file on the server; the server refuses to delete the only copy. */
    fun delete(copyId: Long) {
        if (working.value) return
        viewModelScope.launch {
            working.value = true
            try {
                api.deleteFile(copyId)
                appScope.launch { continueWatching.remove(copyId) }
                val remaining = (state.value as? LoadState.Loaded)?.value?.columns?.filter { it.movieId != copyId }.orEmpty()
                when {
                    copyId == movieId -> outcomes.send(CompareEvent.OpenOther(remaining.first().movieId))
                    remaining.size < 2 -> outcomes.send(CompareEvent.Close)
                    else -> load()
                }
            } catch (error: CancellationException) { throw error } catch (error: Exception) { failure.value = error.userMessage() } finally { working.value = false }
        }
    }
}
