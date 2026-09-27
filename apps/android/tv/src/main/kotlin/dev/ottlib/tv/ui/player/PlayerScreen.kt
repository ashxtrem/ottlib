package dev.ottlib.tv.ui.player

import android.view.View
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.annotation.OptIn
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import androidx.tv.material3.Button
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.OutlinedButton
import androidx.tv.material3.Surface
import androidx.tv.material3.SurfaceDefaults
import androidx.tv.material3.Text
import dev.ottlib.tv.InterceptKeys
import dev.ottlib.tv.appContainer
import dev.ottlib.tv.playback.openInExternalPlayer
import dev.ottlib.tv.ui.components.ErrorMessage
import dev.ottlib.tv.ui.components.LoadingMessage
import dev.ottlib.tv.ui.components.tryRequestFocus
import dev.ottlib.tv.ui.theme.OttlibColors
import kotlinx.coroutines.delay

@Composable
fun PlayerScreen(movieId: Long, fromStart: Boolean, onExit: () -> Unit) {
    val container = appContainer()
    val viewModel = viewModel(key = "player-$movieId-$fromStart") {
        PlayerViewModel(container.api, container.playerFactory, container.playbackPreferences, container.watchNext, container.appScope, movieId, fromStart)
    }
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val problem by viewModel.problem.collectAsStateWithLifecycle()
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
            is PlayerUiState.Ready -> PlayerSurface(current.player, current.title, keysEnabled = problem == null)
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

@OptIn(UnstableApi::class)
@Composable
private fun PlayerSurface(player: ExoPlayer, title: String, keysEnabled: Boolean) {
    var playerView by remember { mutableStateOf<PlayerView?>(null) }
    var controlsVisible by remember { mutableStateOf(false) }
    var hint by remember { mutableStateOf<SeekHint?>(null) }

    InterceptKeys { event ->
        val view = playerView
        keysEnabled && view != null && handlePlayerKey(event, view, player) { hint = it }
    }
    BackHandler(enabled = controlsVisible) { playerView?.hideController() }

    Box(Modifier.fillMaxSize()) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { context ->
                PlayerView(context).apply {
                    this.player = player
                    useController = true
                    controllerShowTimeoutMs = 4_000
                    setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING)
                    setShowSubtitleButton(true)
                    setShowNextButton(false)
                    setShowPreviousButton(false)
                    keepScreenOn = true
                    isFocusable = true
                    setControllerVisibilityListener(PlayerView.ControllerVisibilityListener { visibility -> controlsVisible = visibility == View.VISIBLE })
                    playerView = this
                    post { requestFocus() }
                }
            },
            onRelease = { view ->
                view.player = null
                playerView = null
            },
        )
        AnimatedVisibility(visible = controlsVisible, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.align(Alignment.TopStart)) {
            Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold, color = Color.White, modifier = Modifier.padding(40.dp))
        }
        hint?.let { current ->
            Text(
                current.text,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                modifier = Modifier.align(Alignment.Center).background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(12.dp)).padding(horizontal = 24.dp, vertical = 12.dp),
            )
            LaunchedEffect(current.id) {
                delay(900)
                hint = null
            }
        }
    }
}

@Composable
private fun ProblemDialog(problem: PlaybackProblem, onContinue: () -> Unit, onRetry: () -> Unit, onExternal: () -> Unit, onExit: () -> Unit) {
    val focus = remember { FocusRequester() }
    Dialog(onDismissRequest = if (problem is PlaybackProblem.Error) onExit else onContinue) {
        Surface(shape = RoundedCornerShape(16.dp), colors = SurfaceDefaults.colors(containerColor = OttlibColors.Surface)) {
            Column(Modifier.width(620.dp).padding(28.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                Text(problem.message, style = MaterialTheme.typography.titleMedium, color = OttlibColors.Foreground)
                Text("“Play in another app” hands the stream to a player like VLC.", style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Muted)
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Button(onClick = onExternal, modifier = Modifier.focusRequester(focus)) { Text("Play in another app") }
                    when (problem) {
                        is PlaybackProblem.Error -> OutlinedButton(onClick = onRetry) { Text("Retry") }
                        is PlaybackProblem.UnsupportedAudio -> OutlinedButton(onClick = onContinue) { Text("Watch without sound") }
                        is PlaybackProblem.UnsupportedVideo -> Unit
                    }
                    OutlinedButton(onClick = onExit) { Text("Back") }
                }
            }
        }
    }
    LaunchedEffect(problem) { focus.tryRequestFocus() }
}
