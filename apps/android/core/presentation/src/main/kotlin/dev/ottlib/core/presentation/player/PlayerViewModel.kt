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
import dev.ottlib.core.model.PictureArea
import dev.ottlib.core.model.PictureMode
import dev.ottlib.core.model.PlaybackProgressUpdate
import dev.ottlib.core.model.TrackChoice
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.player.OttlibPlayerFactory
import dev.ottlib.core.player.PlayerSettings
import dev.ottlib.core.player.ProgressReporter
import dev.ottlib.core.player.PlaybackSession
import dev.ottlib.core.player.TrackMemory
import dev.ottlib.core.player.hasOnlyUnsupportedAudio
import dev.ottlib.core.player.hasOnlyUnsupportedVideo
import dev.ottlib.core.player.toMediaItem
import dev.ottlib.core.player.withSubtitlesFrom
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
import kotlinx.coroutines.Job
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
    /** "Play via server" was refused ([message] says why); the dialog keeps [original]'s other choices. */
    data class ServerUnavailable(override val message: String, val original: PlaybackProblem) : PlaybackProblem
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
    private val autoPlayStreak: AutoPlayStreak,
) : ViewModel() {
    private val state = MutableStateFlow<PlayerUiState>(PlayerUiState.Loading)
    val uiState: StateFlow<PlayerUiState> = state.asStateFlow()
    private val currentProblem = MutableStateFlow<PlaybackProblem?>(null)
    val problem: StateFlow<PlaybackProblem?> = currentProblem.asStateFlow()
    private val picture = MutableStateFlow(PictureMode.Fit)
    /** The confirmed picture mode (panel previews are applied to the view without changing this). */
    val pictureMode: StateFlow<PictureMode> = picture.asStateFlow()
    private val area = MutableStateFlow<PictureArea?>(null)
    /** The real picture inside the current source's frame (burned-in bars excluded), or null for the whole frame. */
    val pictureArea: StateFlow<PictureArea?> = area.asStateFlow()

    private val next = MutableStateFlow<Movie?>(null)
    val nextMovie = next.asStateFlow()
    private val warning = MutableStateFlow<String?>(null)
    val nextWarning = warning.asStateFlow()
    private val completion = MutableStateFlow<String?>(null)
    val completionError = completion.asStateFlow()
    private val countdown = AutoPlayCountdown(viewModelScope, autoPlayStreak)
    val autoPlay: StateFlow<AutoPlayState> = countdown.state
    private var autoPlaySeconds = 0
    private val saving = Mutex()
    private val collectionId = sequence.collectionFor(movieId)
    @Volatile private var ended = false
    private var completionSaved = false
    private var session: PlaybackSession? = null
    private val player: ExoPlayer? get() = session?.player
    private var startup: Job? = null
    private var fallback: Job? = null
    /** The server's remux/transcode session behind the current HLS source; stopped on release or a new source. */
    private var serverSession: String? = null
    private var movie: Movie? = null
    private var warnedAboutTracks = false
    val subtitles = SubtitleSearchController(api, movieId, viewModelScope,
        preferredLanguages = { preferences.current().subtitleSearchLanguages },
        saveLanguages = preferences::setSubtitleSearchLanguages,
        applySubtitle = { source ->
            val active = session ?: error("Playback is no longer active")
            rememberTracks(active.useSubtitle(source) { api.resolve(it) ?: error("No server selected") })
        })

    fun findSubtitles() = subtitles.open(movie)

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
                startAutoPlay()
            }
        }
    }

    init {
        autoPlayStreak.playerOpened()
        // Leaving the title unwatched because the save failed would be worse than waiting for the viewer.
        viewModelScope.launch { completion.collect { if (it != null) countdown.cancel() } }
        start()
    }

    private fun start() {
        startup = viewModelScope.launch {
            try {
                val details = async { api.movie(movieId) }
                val source = api.playbackSource(movieId)
                val loaded = details.await().also { movie = it }
                viewModelScope.launch {
                    next.value = try { sequence.next(loaded) }
                    catch (error: CancellationException) { throw error }
                    catch (_: Exception) { null }
                    warning.value = next.value?.episodeGapAfter(loaded)
                    startAutoPlay()
                }
                val settings = preferences.current()
                autoPlaySeconds = settings.autoPlayNextSeconds
                picture.value = pictureModes.get(movieId) ?: settings.defaultPictureMode
                area.value = source.pictureArea
                val skipBackMs = settings.skipBackSeconds * 1_000L
                val skipForwardMs = settings.skipForwardSeconds * 1_000L
                // Read preferences before creating a decoder: cancellation during a suspended read must not leak a player.
                val savedTracks = trackChoices.get(movieId)
                val exo = playerFactory.create(PlayerSettings(settings.audioLanguage, settings.subtitleLanguage, skipBackMs, skipForwardMs))
                // Before prepare(), so the first track list is seen and the title's remembered tracks are restored.
                session = PlaybackSession(
                    exo, listener,
                    ProgressReporter(exo, viewModelScope, backgroundScope, source.durationMs ?: loaded.mediaInfo?.durationMs) { position, duration -> save(position, duration) },
                    TrackMemory(exo, savedTracks, ::rememberTracks),
                )
                exo.setMediaItem(source.toMediaItem(movieId, loaded.title) { api.resolve(it)!! }, if (fromStart) 0 else source.resumePositionMs ?: 0)
                exo.prepare()
                exo.playWhenReady = true
                state.value = PlayerUiState.Ready(exo, loaded.title, PlayerControls(skipBackMs, skipForwardMs, showPictureHint = !settings.pictureHintShown))
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                releasePlayback()
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

    /** Once the title has ended and the next one is known, whichever comes last. */
    private fun startAutoPlay() {
        val upcoming = next.value ?: return
        if (ended && completion.value == null) countdown.start(upcoming.id, autoPlaySeconds)
    }

    fun cancelAutoPlay() = countdown.cancel()

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

    /**
     * Swaps to the server's remux/transcode of this title from the current position, on the same player, so progress
     * reporting, remembered tracks and side-loaded subtitles carry on. The HLS timeline is the whole film, so positions
     * stay film positions. A refusal (busy, no ffmpeg) is shown in the problem dialog instead.
     */
    fun playViaServer() {
        val shown = currentProblem.value ?: return
        val exo = player ?: return
        val request = serverFallbackRequest(shown, exo.currentPosition.coerceAtLeast(0)) ?: return
        currentProblem.value = null
        exo.pause()
        fallback?.cancel()
        fallback = viewModelScope.launch {
            val source = try { api.playbackSource(movieId, request) }
            catch (error: CancellationException) { throw error }
            catch (error: Exception) { currentProblem.value = PlaybackProblem.ServerUnavailable(error.userMessage(), shown); return@launch }
            val refusal = serverFallbackRefusal(source)
            val active = player
            if (refusal != null || active == null) {
                source.sessionUrl?.let(::stopServerSession)
                if (refusal != null) currentProblem.value = PlaybackProblem.ServerUnavailable(refusal, shown)
                return@launch
            }
            val item = runCatching { source.toMediaItem(movieId, title) { api.resolve(it)!! }.withSubtitlesFrom(active.currentMediaItem) }
                .getOrElse { error ->
                    source.sessionUrl?.let(::stopServerSession)
                    currentProblem.value = PlaybackProblem.ServerUnavailable(error.userMessage(), shown)
                    return@launch
                }
            serverSession?.let(::stopServerSession)
            serverSession = source.sessionUrl
            area.value = source.pictureArea
            active.setMediaItem(item, request.startMs ?: 0)
            active.prepare()
            active.playWhenReady = true
        }
    }

    private fun stopServerSession(sessionUrl: String) {
        backgroundScope.launch { runCatching { api.stopSession(sessionUrl) } }
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

    /** Call before navigating away; Navigation may retain the old ViewModel through its exit animation. */
    fun releasePlayback() {
        countdown.cancel()
        subtitles.cancel()
        startup?.cancel()
        fallback?.cancel()
        session?.release()
        session = null
        serverSession?.let(::stopServerSession)
        serverSession = null
    }

    override fun onCleared() = releasePlayback()
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
