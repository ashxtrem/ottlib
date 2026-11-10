package dev.ottlib.core.presentation.details

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.ottlib.core.data.HiddenTitleStore
import dev.ottlib.core.model.CastMember
import dev.ottlib.core.model.Movie
import dev.ottlib.core.model.OutsideRating
import dev.ottlib.core.model.hideKey
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.presentation.ContinueWatchingPublisher
import dev.ottlib.core.presentation.LoadState
import dev.ottlib.core.presentation.player.PlaybackSequence
import dev.ottlib.core.presentation.userMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.Job

class DetailsViewModel(
    private val api: OttlibApi,
    private val continueWatching: ContinueWatchingPublisher,
    private val backgroundScope: CoroutineScope,
    val movieId: Long,
    private val sequence: PlaybackSequence,
    private val hiddenKeys: Flow<Set<String>>,
    private val hide: suspend (Movie) -> Unit,
    private val unhide: suspend (String) -> Unit,
) : ViewModel() {
    constructor(
        api: OttlibApi,
        continueWatching: ContinueWatchingPublisher,
        backgroundScope: CoroutineScope,
        movieId: Long,
        sequence: PlaybackSequence,
        hiddenTitles: HiddenTitleStore,
    ) : this(api, continueWatching, backgroundScope, movieId, sequence, hiddenTitles.keys, hiddenTitles::hide, hiddenTitles::unhide)

    private val state = MutableStateFlow<LoadState<Movie>>(LoadState.Loading)
    val movie: StateFlow<LoadState<Movie>> = state.asStateFlow()
    private val working = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = working.asStateFlow()

    private fun <T> fromMovie(initial: T, pick: (Movie) -> T): StateFlow<T> =
        state.map { (it as? LoadState.Loaded)?.value?.let(pick) ?: initial }.stateIn(viewModelScope, SharingStarted.Eagerly, initial)

    /** Outside scores (IMDb, Rotten Tomatoes, Metacritic) of the loaded title; format with `ratingsLine()`. */
    val ratings: StateFlow<List<OutsideRating>> = fromMovie(emptyList()) { it.ratings }
    /** The cast with photos; photo URLs are absolute. */
    val castMembers: StateFlow<List<CastMember>> = fromMovie(emptyList()) { movie -> movie.castMembers.map { it.copy(photoUrl = api.resolve(it.photoUrl)) } }
    /** The title logo, an absolute URL, or null. */
    val logoUrl: StateFlow<String?> = fromMovie(null) { api.resolve(it.logoUrl) }

    /** Which control had focus (a screen-chosen key), so returning from the player or another title puts TV focus back. */
    var lastFocusedKey: String? = null

    /** Whether this title (or its whole show) is hidden on this device. */
    val hidden: StateFlow<Boolean> = combine(state, hiddenKeys) { movie, keys -> (movie as? LoadState.Loaded)?.value?.hideKey() in keys }
        .stateIn(viewModelScope, SharingStarted.Eagerly, false)

    private val otherCopies = MutableStateFlow(0)
    /** How many other available copies of this title the library has; the Compare button appears when above zero. */
    val copies: StateFlow<Int> = otherCopies.asStateFlow()

    private val suggested = MutableStateFlow<List<RecommendedPoster>>(emptyList())
    /** "More like this", minus titles hidden on this device. */
    val recommendations: StateFlow<List<RecommendedPoster>> = combine(suggested, hiddenKeys) { items, hidden -> items.filterNot { it.poster.hideKey in hidden } }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    private val sagaOf = MutableStateFlow<CollectionSummary?>(null)
    /** The saga this title belongs to, when it has one: the other owned titles (minus those hidden here) and the count of missing parts. */
    val collection: StateFlow<CollectionSummary?> = combine(sagaOf, hiddenKeys) { saga, hidden -> saga?.copy(owned = saga.owned.filterNot { it.hideKey in hidden }) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    private val next = MutableStateFlow<Movie?>(null)
    val nextMovie = next.asStateFlow()
    private var loading: Job? = null
    init {
        load()
        loadRecommendations()
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
                loadCollection(fresh.value.collection != null)
                otherCopies.value = try { api.duplicates(movieId).size } catch (error: CancellationException) { throw error } catch (_: Exception) { 0 }
                next.value = try { sequence.next(fresh.value) }
                catch (error: CancellationException) { throw error }
                catch (_: Exception) { null }
            }
        }
    }

    /** Beside the recommendations, once the movie says it belongs to a saga. A failure just leaves the section out. */
    private suspend fun loadCollection(inCollection: Boolean) {
        if (!inCollection) { sagaOf.value = null; return }
        // The endpoint is keyed by this title's id and answers with the saga it belongs to.
        try { sagaOf.value = api.collection(movieId)?.toSummary(movieId, api::resolve) }
        catch (error: CancellationException) { throw error }
        catch (_: Exception) { /* keep what is shown */ }
    }

    private fun loadRecommendations() {
        viewModelScope.launch {
            suggested.value = try { api.recommendations(movieId).map { it.toRecommendedPoster(api::resolve) } }
            catch (error: CancellationException) { throw error }
            catch (_: Exception) { emptyList() }
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

    fun toggleHidden() {
        val current = (state.value as? LoadState.Loaded)?.value ?: return
        viewModelScope.launch { if (hidden.value) unhide(current.hideKey()) else hide(current) }
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
