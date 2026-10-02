package dev.ottlib.core.presentation.player

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.Tracks
import androidx.media3.exoplayer.ExoPlayer
import dev.ottlib.core.data.PictureModeStore
import dev.ottlib.core.data.PlaybackPreferences
import dev.ottlib.core.data.TrackChoiceStore
import dev.ottlib.core.model.Movie
import dev.ottlib.core.model.PictureMode
import dev.ottlib.core.model.PlaybackProgressUpdate
import dev.ottlib.core.model.TrackChoice
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.player.OttlibPlayerFactory
import dev.ottlib.core.player.PlayerSettings
import dev.ottlib.core.player.ProgressReporter
import dev.ottlib.core.player.TrackMemory
import dev.ottlib.core.player.hasOnlyUnsupportedAudio
import dev.ottlib.core.player.hasOnlyUnsupportedVideo
import dev.ottlib.core.player.toMediaItem
import dev.ottlib.core.presentation.ContinueWatchingEntry
import dev.ottlib.core.presentation.ContinueWatchingPublisher
import dev.ottlib.core.presentation.userMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

sealed interface PlayerUiState {
    data object Loading : PlayerUiState
    data class Ready(val player: ExoPlayer, val title: String, val controls: PlayerControls) : PlayerUiState
    data class Failed(val message: String) : PlayerUiState
    data object Ended : PlayerUiState
}

/** Remote behaviour for this session, from the viewer's settings. */
data class PlayerControls(val skipBackMs: Long, val skipForwardMs: Long, val showPictureHint: Boolean)

/** Something the viewer must decide about; playback is paused while it is shown. */
sealed interface PlaybackProblem {
    val message: String
    data class UnsupportedAudio(override val message: String) : PlaybackProblem
    data class UnsupportedVideo(override val message: String) : PlaybackProblem
    data class Error(override val message: String) : PlaybackProblem
}

class PlayerViewModel(
    private val api: OttlibApi,
    private val playerFactory: OttlibPlayerFactory,
    private val preferences: PlaybackPreferences,
    private val pictureModes: PictureModeStore,
    private val trackChoices: TrackChoiceStore,
    private val continueWatching: ContinueWatchingPublisher,
    private val backgroundScope: CoroutineScope,
    private val movieId: Long,
    private val fromStart: Boolean,
    private val sequence: PlaybackSequence,
) : ViewModel() {
    private val state = MutableStateFlow<PlayerUiState>(PlayerUiState.Loading)
    val uiState: StateFlow<PlayerUiState> = state.asStateFlow()
    private val currentProblem = MutableStateFlow<PlaybackProblem?>(null)
    val problem: StateFlow<PlaybackProblem?> = currentProblem.asStateFlow()
    private val picture = MutableStateFlow(PictureMode.Fit)
    /** The confirmed picture mode (panel previews are applied to the view without changing this). */
    val pictureMode: StateFlow<PictureMode> = picture.asStateFlow()

    private val next = MutableStateFlow<Movie?>(null)
    val nextMovie = next.asStateFlow()
    private val warning = MutableStateFlow<String?>(null)
    val nextWarning = warning.asStateFlow()
    private val completion = MutableStateFlow<String?>(null)
    val completionError = completion.asStateFlow()
    private val saving = Mutex()
    private val collectionId = sequence.collectionFor(movieId)
    @Volatile private var ended = false
    private var completionSaved = false
    private var player: ExoPlayer? = null
    private var reporter: ProgressReporter? = null
    private var trackMemory: TrackMemory? = null
    private var movie: Movie? = null
    private var warnedAboutTracks = false

    val streamUrl: String? get() = api.resolve("/api/stream/$movieId")
    val title: String get() = movie?.title ?: ""

    private val listener = object : Player.Listener {
        override fun onPlayerError(error: PlaybackException) {
            currentProblem.value = PlaybackProblem.Error(playbackErrorMessage(error))
        }

        override fun onTracksChanged(tracks: Tracks) {
            if (warnedAboutTracks) return
            val problem = when {
                tracks.hasOnlyUnsupportedVideo() -> PlaybackProblem.UnsupportedVideo("This device can't decode the video in this file (${movie?.mediaInfo?.videoCodec ?: "unknown codec"}).")
                tracks.hasOnlyUnsupportedAudio() -> PlaybackProblem.UnsupportedAudio("This device can't play the audio in this file (${audioCodecs()}). Video will play without sound.")
                else -> null
            } ?: return
            warnedAboutTracks = true
            player?.pause()
            currentProblem.value = problem
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
            if (playbackState == Player.STATE_ENDED) {
                ended = true
                state.value = PlayerUiState.Ended
                saveCompletion()
            }
        }
    }

    init { start() }

    private fun start() {
        viewModelScope.launch {
            try {
                val details = async { api.movie(movieId) }
                val source = api.playbackSource(movieId)
                val loaded = details.await().also { movie = it }
                viewModelScope.launch {
                    next.value = try { sequence.next(loaded) }
                    catch (error: CancellationException) { throw error }
                    catch (_: Exception) { null }
                    warning.value = next.value?.episodeGapAfter(loaded)
                }
                val settings = preferences.current()
                picture.value = pictureModes.get(movieId) ?: settings.defaultPictureMode
                val skipBackMs = settings.skipBackSeconds * 1_000L
                val skipForwardMs = settings.skipForwardSeconds * 1_000L
                val exo = playerFactory.create(PlayerSettings(settings.audioLanguage, settings.subtitleLanguage, skipBackMs, skipForwardMs))
                exo.addListener(listener)
                // Before prepare(), so the first track list is seen and the title's remembered tracks are restored.
                trackMemory = TrackMemory(exo, trackChoices.get(movieId), ::rememberTracks).also { it.start() }
                exo.setMediaItem(source.toMediaItem(movieId, loaded.title) { api.resolve(it)!! }, if (fromStart) 0 else source.resumePositionMs ?: 0)
                exo.prepare()
                exo.playWhenReady = true
                reporter = ProgressReporter(exo, viewModelScope, backgroundScope, source.durationMs ?: loaded.mediaInfo?.durationMs) { position, duration -> save(position, duration) }
                    .also { it.start() }
                player = exo
                state.value = PlayerUiState.Ready(exo, loaded.title, PlayerControls(skipBackMs, skipForwardMs, showPictureHint = !settings.pictureHintShown))
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                state.value = PlayerUiState.Failed(error.userMessage())
            }
        }
    }

    /** Keeps [mode] for this session, and for this title on future plays when [rememberForTitle]. */
    fun choosePictureMode(mode: PictureMode, rememberForTitle: Boolean) {
        picture.value = mode
        backgroundScope.launch { pictureModes.set(movieId, if (rememberForTitle) mode else null) }
    }

    /** Changes the picture for this session only, leaving any remembered choice for the title alone (pinch to zoom). */
    fun usePictureModeForSession(mode: PictureMode) {
        picture.value = mode
    }

    /** Remembered for this title; with "follow last choice" on, also becomes the language default for new titles. */
    private fun rememberTracks(choice: TrackChoice) {
        backgroundScope.launch {
            trackChoices.set(movieId, choice)
            val settings = preferences.current()
            if (!settings.languagesFollowLastChoice) return@launch
            choice.audio?.language?.let { preferences.setAudioLanguage(it) }
            val subtitleLanguage = choice.subtitle?.language
            when {
                choice.subtitlesOff -> preferences.setSubtitleLanguage(null)
                subtitleLanguage != null -> preferences.setSubtitleLanguage(subtitleLanguage)
            }
        }
    }

    fun pictureHintSeen() {
        backgroundScope.launch { preferences.markPictureHintShown() }
    }

    fun dismissProblem(resume: Boolean) {
        currentProblem.value = null
        player?.let { if (resume) it.play() }
    }

    fun retry() {
        currentProblem.value = null
        player?.run { prepare(); play() }
    }

    fun saveCompletion() {
        backgroundScope.launch {
            saving.withLock {
                if (completionSaved) return@withLock
                try {
                    api.complete(movieId, collectionId)
                    completionSaved = true
                    completion.value = null
                    runCatching {
                        continueWatching.remove(movieId)
                        next.value?.let { upcoming ->
                            val queued = api.continueWatching().find { it.id == upcoming.id }
                            if (queued != null) continueWatching.upsert(ContinueWatchingEntry(queued.id, queued.title, api.resolve(queued.posterUrl), queued.resumePositionMs ?: 0, queued.durationMs ?: 0, nextUp = queued.nextUp != null))
                        }
                    }
                } catch (error: CancellationException) { throw error }
                catch (_: Exception) { completion.value = "Couldn't save watched status. Check your connection and retry." }
            }
        }
    }

    private suspend fun save(positionMs: Long, durationMs: Long) = saving.withLock {
        if (ended) return@withLock
        val result = api.saveProgress(movieId, PlaybackProgressUpdate(positionMs, durationMs, collectionId))
        val current = movie ?: return@withLock
        val resume = result.resumePositionMs
        if (resume != null) continueWatching.upsert(ContinueWatchingEntry(movieId, current.title, api.resolve(current.posterUrl), resume, durationMs))
        else continueWatching.remove(movieId)
    }

    private fun audioCodecs(): String = movie?.mediaInfo?.tracks?.filter { it.isAudio }?.mapNotNull { it.codec }?.distinct()?.joinToString(", ")?.ifEmpty { null } ?: "unknown codec"

    override fun onCleared() {
        reporter?.stop()
        trackMemory?.stop()
        player?.run {
            removeListener(listener)
            release()
        }
        player = null
    }
}

private fun playbackErrorMessage(error: PlaybackException): String = when (error.errorCode) {
    PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED, PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT ->
        "Lost connection to the Ottlib server."
    PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS, PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND ->
        "The server couldn't provide this file. It may have been moved or its drive disconnected."
    PlaybackException.ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED, PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED ->
        "This file's format isn't supported by the built-in player."
    PlaybackException.ERROR_CODE_DECODER_INIT_FAILED, PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED, PlaybackException.ERROR_CODE_DECODING_FORMAT_EXCEEDS_CAPABILITIES ->
        "This device can't decode this file."
    else -> "Playback failed (${error.errorCodeName})."
}
