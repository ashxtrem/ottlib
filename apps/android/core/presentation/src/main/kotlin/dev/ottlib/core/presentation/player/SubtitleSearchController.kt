package dev.ottlib.core.presentation.player

import dev.ottlib.core.model.Movie
import dev.ottlib.core.model.SubtitleOptions
import dev.ottlib.core.model.SubtitleResult
import dev.ottlib.core.model.SubtitleSearch
import dev.ottlib.core.model.SubtitleSource
import dev.ottlib.core.network.OttlibApi
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class SubtitleSearchState(
    val loading: Boolean = false, val searching: Boolean = false, val downloading: String? = null,
    val options: SubtitleOptions? = null, val mode: String = "auto", val query: String = "",
    val filename: String = "", val languages: String = "en", val year: String = "",
    val season: String = "", val episode: String = "", val results: List<SubtitleResult> = emptyList(),
    val warnings: List<String> = emptyList(), val error: String? = null, val message: String? = null,
    val searched: Boolean = false,
) {
    val busy: Boolean get() = loading || searching || downloading != null
    val configured: Boolean get() = options?.providers?.any { it.configured } == true
    val languageCodes: List<String> get() = languages.split(',').map { it.trim().lowercase() }.filter { it.isNotBlank() }.distinct()
    fun languageName(code: String): String = options?.languages?.find { it.code == code }?.name ?: code.uppercase()
}

/** UI-neutral search/download state shared by TV and mobile; the caller owns playback and persistence. */
class SubtitleSearchController(
    private val api: OttlibApi, private val movieId: Long, private val scope: CoroutineScope,
    private val preferredLanguages: suspend () -> List<String>,
    private val saveLanguages: suspend (List<String>) -> Unit,
    private val applySubtitle: suspend (SubtitleSource) -> Unit,
) {
    private val state = MutableStateFlow(SubtitleSearchState())
    val uiState = state.asStateFlow()
    private var operation: Job? = null
    private var initialized = false

    fun open(movie: Movie?) {
        if (initialized || state.value.loading || movie == null) return
        state.value = state.value.copy(loading = true, query = movie.title.replace(Regex("\\s*·\\s*S\\d+E\\d+\\s*$", RegexOption.IGNORE_CASE), ""),
            filename = movie.rawFilename, year = movie.year?.toString().orEmpty(), season = movie.season?.toString().orEmpty(), episode = movie.episode?.toString().orEmpty(), error = null)
        operation = scope.launch {
            try {
                val options = api.subtitleOptions()
                val languages = preferredLanguages().ifEmpty { options.preferredLanguages }
                state.value = state.value.copy(loading = false, options = options, languages = languages.joinToString(", "))
                initialized = true
                if (state.value.configured) search()
            } catch (error: CancellationException) { throw error }
            catch (error: Exception) { state.value = state.value.copy(loading = false, error = error.message ?: "Could not load subtitle services") }
        }
    }
    fun edit(transform: (SubtitleSearchState) -> SubtitleSearchState) {
        if (!state.value.busy) state.value = transform(state.value).copy(error = null, message = null)
    }
    fun search() {
        val current = state.value
        if (current.busy || !current.configured) return
        val codes = current.languageCodes
        val languagePattern = Regex("^[a-z]{2,3}(?:-[a-z]{2,3})?$")
        val year = current.year.toIntOrNull(); val season = current.season.toIntOrNull(); val episode = current.episode.toIntOrNull()
        val validation = when {
            codes.isEmpty() || codes.size > 10 || codes.any { !languagePattern.matches(it) } -> "Choose 1–10 language codes, such as en, hi, ta."
            current.mode == "manual" && current.query.isBlank() -> "Enter a title to search."
            current.query.length > 250 -> "The title is too long."
            current.year.isNotBlank() && (year == null || year !in 1800..2200) -> "Enter a valid year."
            current.season.isNotBlank() && (season == null || season <= 0) -> "Enter a valid season."
            current.episode.isNotBlank() && (episode == null || episode <= 0) -> "Enter a valid episode."
            else -> null
        }
        if (validation != null) { state.value = current.copy(error = validation); return }
        state.value = current.copy(searching = true, error = null, message = null, results = emptyList(), warnings = emptyList(), searched = false)
        operation = scope.launch {
            try {
                saveLanguages(codes)
                val response = api.searchSubtitles(movieId, SubtitleSearch(current.mode, current.query.trim(), codes, year, season, episode))
                state.value = state.value.copy(searching = false, results = response.results, warnings = response.warnings, searched = true)
            } catch (error: CancellationException) { throw error }
            catch (error: Exception) { state.value = state.value.copy(searching = false, error = error.message ?: "Subtitle search failed") }
        }
    }
    fun download(result: SubtitleResult) {
        if (state.value.busy) return
        state.value = state.value.copy(downloading = result.id, error = null, message = null)
        operation = scope.launch {
            var saved = false
            try {
                val response = api.downloadSubtitle(movieId, result.id)
                saved = true
                applySubtitle(response.subtitle)
                state.value = state.value.copy(downloading = null, message = "Subtitle saved and selected. Close to return to playback.",
                    results = state.value.results.map { if (it.id == result.id) it.copy(downloaded = true) else it })
            } catch (error: CancellationException) { throw error }
            catch (error: Exception) {
                state.value = state.value.copy(downloading = null, error = (if (saved) "Subtitle saved, but could not select it: " else "") + (error.message ?: "Download failed"))
            }
        }
    }
    fun cancel() {
        operation?.cancel()
        state.value = state.value.copy(loading = false, searching = false, downloading = null)
    }
}
