package dev.ottlib.core.presentation.metadata

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.ottlib.core.model.MetadataCandidate
import dev.ottlib.core.model.Movie
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.presentation.userMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MetadataEditorState(
    val title: String = "",
    val imdb: String = "",
    val season: String = "",
    val episode: String = "",
    val candidates: List<MetadataCandidate> = emptyList(),
    val selected: MetadataCandidate? = null,
    val busy: Boolean = false,
    val message: String? = null,
    val searched: Boolean = false,
)

/** Search results are previews; metadata is applied only by accept(). */
class MetadataViewModel(
    private val api: OttlibApi,
    val refresh: MetadataRefresh,
    private val movie: Movie,
) : ViewModel() {
    private val current = MutableStateFlow(MetadataEditorState(
        title = movie.title,
        season = metadataEpisode(movie).first,
        episode = metadataEpisode(movie).second,
    ))
    val state = current.asStateFlow()

    init { loadSuggestions() }

    fun title(value: String) { current.update { it.copy(title = value, selected = null, candidates = emptyList(), searched = false, message = null) } }
    fun imdb(value: String) { current.update { it.copy(imdb = value, selected = null, message = null) } }
    fun season(value: String) { current.update { it.copy(season = value, message = null) } }
    fun episode(value: String) { current.update { it.copy(episode = value, message = null) } }
    fun select(candidate: MetadataCandidate) {
        current.update { it.copy(selected = candidate, season = candidate.season?.toString() ?: it.season, episode = candidate.episode?.toString() ?: it.episode, message = null) }
    }
    fun clearSelection() { current.update { it.copy(selected = null) } }
    fun refreshTitle() {
        if (!current.value.busy) refresh.refresh(movie.id)
    }

    fun loadSuggestions() = work {
        val candidates = api.metadataCandidates(movie.id)
        current.update { it.copy(candidates = candidates, selected = null, searched = candidates.isNotEmpty()) }
    }
    fun search() {
        val title = current.value.title.trim()
        if (title.isEmpty()) { message("Enter a title to search."); return }
        work {
            val found = api.searchMetadata(movie.id, title)
            current.update { it.copy(candidates = found, selected = null, searched = true, message = if (found.isEmpty()) "No matches found. Try another title or an IMDb ID." else null) }
        }
    }
    fun lookupImdb() {
        val imdb = current.value.imdb.trim()
        if (imdb.isEmpty()) { message("Enter an IMDb ID or link."); return }
        work {
            api.lookupMetadataImdb(movie.id, imdb)
            val found = api.metadataCandidates(movie.id)
            current.update { it.copy(candidates = found, selected = null, searched = true, message = "Choose a result to apply it to this title.") }
        }
    }
    fun accept() {
        val state = current.value
        val candidate = state.selected ?: return
        val season = if (candidate.mediaType == "tv") positiveEpisodeNumber(state.season) else null
        val episode = if (candidate.mediaType == "tv") positiveEpisodeNumber(state.episode) else null
        if (candidate.mediaType == "tv" && (season == null || episode == null)) {
            message("Enter a positive season and episode number."); return
        }
        work {
            api.acceptMetadata(movie.id, candidate, season, episode)
            current.update { it.copy(candidates = emptyList(), selected = null, searched = false, message = "Match updated for this title.") }
        }
    }
    fun reject() = work {
        if (current.value.candidates.any { it.id != null }) api.rejectMetadata(movie.id)
        current.update { it.copy(candidates = emptyList(), selected = null, searched = false, message = "Try another title or an IMDb ID.") }
    }

    private fun message(text: String) { current.update { it.copy(message = text) } }
    private fun work(block: suspend () -> Unit) {
        if (current.value.busy || refresh.state.value.running) return
        current.update { it.copy(busy = true, message = null) }
        viewModelScope.launch {
            try { block() }
            catch (error: CancellationException) { throw error }
            catch (error: Exception) { message(error.userMessage()) }
            finally { current.update { it.copy(busy = false) } }
        }
    }
}
