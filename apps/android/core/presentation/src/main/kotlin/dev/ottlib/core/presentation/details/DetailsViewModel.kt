package dev.ottlib.core.presentation.details

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.ottlib.core.model.Movie
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.presentation.ContinueWatchingPublisher
import dev.ottlib.core.presentation.LoadState
import dev.ottlib.core.presentation.player.PlaybackSequence
import dev.ottlib.core.presentation.userMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.Job

class DetailsViewModel(
    private val api: OttlibApi,
    private val continueWatching: ContinueWatchingPublisher,
    private val backgroundScope: CoroutineScope,
    val movieId: Long,
    private val sequence: PlaybackSequence,
) : ViewModel() {
    private val state = MutableStateFlow<LoadState<Movie>>(LoadState.Loading)
    val movie: StateFlow<LoadState<Movie>> = state.asStateFlow()
    private val working = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = working.asStateFlow()

    private val next = MutableStateFlow<Movie?>(null)
    val nextMovie = next.asStateFlow()
    private var loading: Job? = null
    init {
        load()
        viewModelScope.launch { api.libraryRevision.collect { if (it > 0) load() } }
    }

    private var resumedOnce = false

    /** Returning from the player may have changed the resume position or watched state. */
    fun onResume() {
        if (resumedOnce) load() else resumedOnce = true
    }

    fun load() {
        loading?.cancel()
        loading = viewModelScope.launch {
            val fresh = try { LoadState.Loaded(api.movie(movieId)) } catch (error: CancellationException) { throw error } catch (error: Exception) { LoadState.Failed(error.userMessage()) }
            if (fresh is LoadState.Loaded || state.value !is LoadState.Loaded) state.value = fresh
            if (fresh is LoadState.Loaded) {
                next.value = try { sequence.next(fresh.value) }
                catch (error: CancellationException) { throw error }
                catch (_: Exception) { null }
            }
        }
    }

    fun toggleWatched() = mutate {
        val current = (state.value as? LoadState.Loaded)?.value ?: return@mutate
        val updated = api.setWatched(movieId, !current.watched)
        if (updated.watched) backgroundScope.launch { continueWatching.remove(movieId) }
        state.value = LoadState.Loaded(updated)
    }

    fun clearProgress() = mutate {
        api.clearProgress(movieId)
        backgroundScope.launch { continueWatching.remove(movieId) }
        state.value = LoadState.Loaded(api.movie(movieId))
    }

    fun streamUrl(): String? = api.resolve("/api/stream/$movieId")

    private fun mutate(block: suspend () -> Unit) {
        if (working.value) return
        viewModelScope.launch {
            working.value = true
            try { block() } catch (error: CancellationException) { throw error } catch (_: Exception) { load() } finally { working.value = false }
        }
    }
}
