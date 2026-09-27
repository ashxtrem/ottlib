package dev.ottlib.tv.ui.player

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.Tracks
import androidx.media3.exoplayer.ExoPlayer
import dev.ottlib.core.data.PlaybackPreferences
import dev.ottlib.core.model.Movie
import dev.ottlib.core.model.PlaybackProgressUpdate
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.player.OttlibPlayerFactory
import dev.ottlib.core.player.ProgressReporter
import dev.ottlib.core.player.TrackPreferences
import dev.ottlib.core.player.hasOnlyUnsupportedAudio
import dev.ottlib.core.player.hasOnlyUnsupportedVideo
import dev.ottlib.core.player.toMediaItem
import dev.ottlib.tv.ui.components.userMessage
import dev.ottlib.tv.watchnext.WatchNextEntry
import dev.ottlib.tv.watchnext.WatchNextPublisher
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface PlayerUiState {
    data object Loading : PlayerUiState
    data class Ready(val player: ExoPlayer, val title: String) : PlayerUiState
    data class Failed(val message: String) : PlayerUiState
    data object Ended : PlayerUiState
}

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
    private val watchNext: WatchNextPublisher,
    private val backgroundScope: CoroutineScope,
    private val movieId: Long,
    private val fromStart: Boolean,
) : ViewModel() {
    private val state = MutableStateFlow<PlayerUiState>(PlayerUiState.Loading)
    val uiState: StateFlow<PlayerUiState> = state.asStateFlow()
    private val currentProblem = MutableStateFlow<PlaybackProblem?>(null)
    val problem: StateFlow<PlaybackProblem?> = currentProblem.asStateFlow()

    private var player: ExoPlayer? = null
    private var reporter: ProgressReporter? = null
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
            if (playbackState == Player.STATE_ENDED) state.value = PlayerUiState.Ended
        }
    }

    init { start() }

    private fun start() {
        viewModelScope.launch {
            try {
                val details = async { api.movie(movieId) }
                val source = api.playbackSource(movieId)
                val loaded = details.await().also { movie = it }
                val settings = preferences.current()
                val exo = playerFactory.create(TrackPreferences(settings.audioLanguage, settings.subtitleLanguage))
                exo.addListener(listener)
                exo.setMediaItem(source.toMediaItem(movieId, loaded.title) { api.resolve(it)!! }, if (fromStart) 0 else source.resumePositionMs ?: 0)
                exo.prepare()
                exo.playWhenReady = true
                reporter = ProgressReporter(exo, viewModelScope, backgroundScope, source.durationMs ?: loaded.mediaInfo?.durationMs) { position, duration -> save(position, duration) }
                    .also { it.start() }
                player = exo
                state.value = PlayerUiState.Ready(exo, loaded.title)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                state.value = PlayerUiState.Failed(error.userMessage())
            }
        }
    }

    fun dismissProblem(resume: Boolean) {
        currentProblem.value = null
        player?.let { if (resume) it.play() }
    }

    fun retry() {
        currentProblem.value = null
        player?.run { prepare(); play() }
    }

    private suspend fun save(positionMs: Long, durationMs: Long) {
        val result = api.saveProgress(movieId, PlaybackProgressUpdate(positionMs, durationMs))
        val current = movie ?: return
        val resume = result.resumePositionMs
        if (resume != null) watchNext.upsert(WatchNextEntry(movieId, current.title, api.resolve(current.posterUrl), resume, durationMs))
        else watchNext.remove(movieId)
    }

    private fun audioCodecs(): String = movie?.mediaInfo?.tracks?.filter { it.isAudio }?.mapNotNull { it.codec }?.distinct()?.joinToString(", ")?.ifEmpty { null } ?: "unknown codec"

    override fun onCleared() {
        reporter?.stop()
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
