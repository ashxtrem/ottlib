package dev.ottlib.tv.ui.player

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.openInExternalPlayer
import dev.ottlib.core.presentation.player.PlayerUiState
import dev.ottlib.core.presentation.player.PlayerViewModel
import dev.ottlib.tv.ui.components.ErrorMessage
import dev.ottlib.tv.ui.components.LoadingMessage

@Composable
fun PlayerScreen(movieId: Long, fromStart: Boolean, onExit: () -> Unit) {
    val container = appContainer()
    val viewModel = viewModel(key = "player-$movieId-$fromStart") {
        PlayerViewModel(container.api, container.playerFactory, container.playbackPreferences, container.pictureModes, container.trackChoices, container.continueWatching, container.appScope, movieId, fromStart)
    }
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val problem by viewModel.problem.collectAsStateWithLifecycle()
    val pictureMode by viewModel.pictureMode.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val openExternally = {
        val url = viewModel.streamUrl
        if (url != null && openInExternalPlayer(context, url, viewModel.title)) onExit()
        else Toast.makeText(context, "No other video player is installed", Toast.LENGTH_LONG).show()
    }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        when (val current = state) {
            PlayerUiState.Loading -> LoadingMessage("Starting playback…")
            is PlayerUiState.Failed -> ErrorMessage(current.message, actionLabel = "Back", onAction = onExit)
            PlayerUiState.Ended -> LaunchedEffect(Unit) { onExit() }
            is PlayerUiState.Ready -> PlayerSurface(
                player = current.player,
                title = current.title,
                controls = current.controls,
                pictureMode = pictureMode,
                keysEnabled = problem == null,
                onPictureModeChosen = viewModel::choosePictureMode,
                onPictureHintSeen = viewModel::pictureHintSeen,
            )
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
