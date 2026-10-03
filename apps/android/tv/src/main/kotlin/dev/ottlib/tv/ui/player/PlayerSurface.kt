package dev.ottlib.tv.ui.player

import android.view.View
import androidx.activity.compose.BackHandler
import androidx.annotation.OptIn
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.DefaultTimeBar
import androidx.media3.ui.PlayerView
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import androidx.tv.material3.Button
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.ottlib.core.presentation.player.SubtitleSearchController
import dev.ottlib.tv.ui.components.tryRequestFocus
import dev.ottlib.core.model.PictureMode
import dev.ottlib.core.player.PictureModeController
import dev.ottlib.core.player.SeekAccumulator
import dev.ottlib.core.presentation.player.PlayerControls
import dev.ottlib.tv.InterceptKeys
import kotlinx.coroutines.delay

/** The video, Media3's controls, remote shortcuts, and the overlays drawn on top (seek hints, picture panel). */
@OptIn(UnstableApi::class)
@Composable
fun PlayerSurface(
    player: ExoPlayer,
    title: String,
    controls: PlayerControls,
    pictureMode: PictureMode,
    keysEnabled: Boolean,
    onPictureModeChosen: (PictureMode, Boolean) -> Unit,
    onPictureHintSeen: () -> Unit,
    subtitles: SubtitleSearchController,
    onFindSubtitles: () -> Unit,
) {
    var playerView by remember { mutableStateOf<PlayerView?>(null) }
    var picture by remember { mutableStateOf<PictureModeController?>(null) }
    var controlsVisible by remember { mutableStateOf(false) }
    var panelOpen by remember { mutableStateOf(false) }
    var subtitlesOpen by remember { mutableStateOf(false) }
    val subtitleFocus = remember { FocusRequester() }
    val subtitleState by subtitles.uiState.collectAsStateWithLifecycle()
    var hint by remember { mutableStateOf<SeekHint?>(null) }
    var showPictureHint by remember { mutableStateOf(controls.showPictureHint) }

    val seeker = remember(player, controls) { RemoteSeeker(player, SeekAccumulator(controls.skipBackMs, controls.skipForwardMs)) { hint = it } }
    val remoteKeys = remember(player, seeker) {
        RemoteKeys(player, seeker) {
            playerView?.run {
                hideController()
                clearFocus() // release focus held by the video view or a control button, so the panel can take it
            }
            panelOpen = true
        }
    }
    DisposableEffect(seeker) { onDispose { seeker.release() } }

    InterceptKeys { event -> playerView?.let { remoteKeys.handle(event, it, enabled = keysEnabled && !panelOpen && !subtitlesOpen) } ?: false }
    BackHandler(enabled = controlsVisible && !panelOpen && !subtitlesOpen) { playerView?.hideController() }
    LaunchedEffect(picture, pictureMode) { picture?.apply(pictureMode) }

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
                    // The seek bar moves by the same step as the → key when it has focus.
                    findViewById<DefaultTimeBar>(androidx.media3.ui.R.id.exo_progress)?.setKeyTimeIncrement(controls.skipForwardMs)
                    setControllerVisibilityListener(PlayerView.ControllerVisibilityListener { visibility -> controlsVisible = visibility == View.VISIBLE })
                    playerView = this
                    picture = PictureModeController(this, player)
                    post { requestFocus() }
                }
            },
            onRelease = { view ->
                picture?.release()
                picture = null
                view.player = null
                playerView = null
            },
        )
        AnimatedVisibility(visible = controlsVisible, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.align(Alignment.TopStart)) {
            Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold, color = Color.White, modifier = Modifier.padding(40.dp))
        }
        if (controlsVisible && !panelOpen && !subtitlesOpen) {
            Button(onClick = { playerView?.clearFocus(); onFindSubtitles(); subtitlesOpen = true },
                modifier = Modifier.align(Alignment.TopEnd).padding(40.dp).focusRequester(subtitleFocus).onFocusChanged {
                    playerView?.controllerShowTimeoutMs = if (it.isFocused) 0 else 4_000
                }) { Text("Find subtitles") }
        }
        if (subtitlesOpen) {
            SubtitlePanel(subtitleState, subtitles, onRetry = onFindSubtitles, onDismiss = {
                subtitlesOpen = false
                playerView?.showController()
                playerView?.post { subtitleFocus.tryRequestFocus() }
            }, modifier = Modifier.align(Alignment.CenterEnd))
        }
        hint?.let { current ->
            OverlayText(current.text, Modifier.align(Alignment.Center))
            LaunchedEffect(current.id) {
                delay(HINT_VISIBLE_MS)
                hint = null
            }
        }
        if (showPictureHint && !panelOpen && !subtitlesOpen) {
            OverlayText("Hold OK for picture options", Modifier.align(Alignment.BottomStart).padding(40.dp), small = true)
            LaunchedEffect(Unit) {
                delay(PICTURE_HINT_VISIBLE_MS)
                showPictureHint = false
                onPictureHintSeen()
            }
        }
        if (panelOpen) {
            val close = {
                panelOpen = false
                playerView?.requestFocus()
            }
            PicturePanel(
                current = pictureMode,
                onPreview = { picture?.apply(it) },
                onConfirm = { mode, rememberForTitle ->
                    onPictureModeChosen(mode, rememberForTitle)
                    close()
                },
                onCancel = {
                    picture?.apply(pictureMode)
                    close()
                },
                modifier = Modifier.align(Alignment.CenterEnd),
            )
        }
    }
}

@Composable
private fun OverlayText(text: String, modifier: Modifier, small: Boolean = false) {
    Text(
        text,
        style = if (small) MaterialTheme.typography.titleMedium else MaterialTheme.typography.headlineMedium,
        fontWeight = FontWeight.Bold,
        color = Color.White,
        modifier = modifier.background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(12.dp)).padding(horizontal = 24.dp, vertical = 12.dp),
    )
}

private const val HINT_VISIBLE_MS = 1_000L
private const val PICTURE_HINT_VISIBLE_MS = 5_000L
