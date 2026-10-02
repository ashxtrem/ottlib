package dev.ottlib.mobile.ui.player

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.openInExternalPlayer
import dev.ottlib.core.presentation.player.PlayerUiState
import dev.ottlib.core.presentation.player.PlayerViewModel
import dev.ottlib.mobile.ui.components.ErrorMessage
import dev.ottlib.mobile.ui.components.LoadingMessage

@Composable
fun PlayerScreen(movieId: Long, fromStart: Boolean, onExit: () -> Unit, onNext: (Long) -> Unit, onDetails: (Long) -> Unit) {
    val container = appContainer()
    val viewModel = viewModel(key = "player-$movieId-$fromStart") {
        PlayerViewModel(container.api, container.playerFactory, container.playbackPreferences, container.pictureModes, container.trackChoices, container.continueWatching, container.appScope, movieId, fromStart, container.playbackSequence)
    }
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val problem by viewModel.problem.collectAsStateWithLifecycle()
    val nextMovie by viewModel.nextMovie.collectAsStateWithLifecycle()
    val completionError by viewModel.completionError.collectAsStateWithLifecycle()
    val nextWarning by viewModel.nextWarning.collectAsStateWithLifecycle()
    val pictureMode by viewModel.pictureMode.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val inPictureInPicture = rememberInPictureInPicture()
    val openExternally = {
        val url = viewModel.streamUrl
        if (url != null && openInExternalPlayer(context, url, viewModel.title)) onExit()
        else Toast.makeText(context, "No other video player is installed", Toast.LENGTH_LONG).show()
    }

    FullscreenEffect(inPictureInPicture)

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        when (val current = state) {
            PlayerUiState.Loading -> LoadingMessage(text = "Starting playback…")
            is PlayerUiState.Failed -> ErrorMessage(current.message, actionLabel = "Back", onAction = onExit)
            PlayerUiState.Ended -> PlaybackEnded(nextMovie, container.api.resolve(nextMovie?.posterUrl), nextWarning, completionError, viewModel::saveCompletion, onNext, onDetails, onExit)
            is PlayerUiState.Ready -> {
                MediaSessionEffect(current.player)
                // Stopped means no longer visible at all (screen off, app switched without picture-in-picture, or the
                // picture-in-picture window closed): pause rather than play to an empty room.
                LifecycleEventEffect(Lifecycle.Event.ON_STOP) { current.player.pause() }
                PlayerSurface(
                    player = current.player,
                    title = current.title,
                    controls = current.controls,
                    pictureMode = pictureMode,
                    inPictureInPicture = inPictureInPicture,
                    onExit = onExit,
                    onPictureModeChosen = viewModel::choosePictureMode,
                    onSessionPictureMode = viewModel::usePictureModeForSession,
                    onPictureHintSeen = viewModel::pictureHintSeen,
                    onPlayElsewhere = openExternally,
                )
            }
        }
    }

    problem?.let { shown ->
        ProblemDialog(
            problem = shown,
            onContinue = { viewModel.dismissProblem(resume = true) },
            onRetry = viewModel::retry,
            onExternal = openExternally,
            onExit = onExit,
        )
    }
}
