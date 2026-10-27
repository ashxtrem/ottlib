package dev.ottlib.tv.ui.player

import android.view.View
import androidx.activity.compose.BackHandler
import androidx.annotation.OptIn
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
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
import dev.ottlib.core.presentation.player.CreditsController
import dev.ottlib.core.presentation.player.SubtitleSearchController
import dev.ottlib.tv.ui.components.tryRequestFocus
import dev.ottlib.core.model.PictureArea
import dev.ottlib.core.model.PictureMode
import dev.ottlib.core.player.PictureModeController
import dev.ottlib.core.player.SeekAccumulator
import dev.ottlib.core.presentation.player.PlayerControls
import dev.ottlib.tv.InterceptKeys
import kotlinx.coroutines.delay

/** The video, Media3's controls, remote shortcuts, and the overlays drawn on top (seek hints, credits, panels). */
@OptIn(UnstableApi::class)
@Composable
fun PlayerSurface(
    player: ExoPlayer,
    title: String,
    controls: PlayerControls,
    pictureMode: PictureMode,
    pictureArea: PictureArea?,
    keysEnabled: Boolean,
    onPictureModeChosen: (PictureMode, Boolean) -> Unit,
    onPictureHintSeen: () -> Unit,
    subtitles: SubtitleSearchController,
    onFindSubtitles: () -> Unit,
    credits: CreditsController,
    /** The up-next countdown's message while it runs during playback (it started at the credits). */
    upNext: String?,
    onSkipCredits: () -> Unit,
) {
    var playerView by remember { mutableStateOf<PlayerView?>(null) }
    var picture by remember { mutableStateOf<PictureModeController?>(null) }
    var controlsVisible by remember { mutableStateOf(false) }
    var panelOpen by remember { mutableStateOf(false) }
    var subtitlesOpen by remember { mutableStateOf(false) }
    var creditsOpen by remember { mutableStateOf(false) }
    val subtitleFocus = remember { FocusRequester() }
    val creditsFocus = remember { FocusRequester() }
    val creditsState by credits.state.collectAsStateWithLifecycle()
    var pillFocused by remember { mutableStateOf(false) }
    val anyPanelOpen = panelOpen || subtitlesOpen || creditsOpen
    val pillVisible = (creditsState.showSkip || (creditsState.counting && upNext != null)) && !anyPanelOpen
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

    InterceptKeys { event ->
        val view = playerView ?: return@InterceptKeys false
        if (pillFocused && !controlsVisible && keysEnabled && !anyPanelOpen) {
            // OK presses the pill; D-pad directions fall through to the player (seek, or show the controls with focus on them).
            if (event.keyCode !in PILL_PASS_THROUGH_KEYS) return@InterceptKeys false
            view.requestFocus()
        }
        remoteKeys.handle(event, view, enabled = keysEnabled && !anyPanelOpen)
    }
    BackHandler(enabled = controlsVisible && !anyPanelOpen) { playerView?.hideController() }
    // Back dismisses the pill once for this title (on the countdown it means "Watch credits").
    BackHandler(enabled = pillVisible && !controlsVisible) { if (creditsState.counting) credits.watchCredits() else credits.dismiss() }
    // When the pill goes (skipped, dismissed, credits over), focus returns to the player surface.
    var pillWasVisible by remember { mutableStateOf(false) }
    LaunchedEffect(pillVisible) {
        if (!pillVisible) pillFocused = false
        if (pillWasVisible && !pillVisible && !controlsVisible && !anyPanelOpen) playerView?.requestFocus()
        pillWasVisible = pillVisible
    }
    // The pill is hidden under a panel, so its countdown must not run (and navigate away) unseen.
    LaunchedEffect(anyPanelOpen) { credits.hold(anyPanelOpen) }
    LaunchedEffect(picture, pictureMode, pictureArea) {
        picture?.setPictureArea(pictureArea)
        picture?.apply(pictureMode)
    }

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
        if (controlsVisible && !anyPanelOpen) {
            val holdControls = Modifier.onFocusChanged { playerView?.controllerShowTimeoutMs = if (it.isFocused) 0 else 4_000 }
            Row(Modifier.align(Alignment.TopEnd).padding(40.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(onClick = { playerView?.clearFocus(); creditsOpen = true }, modifier = Modifier.focusRequester(creditsFocus).then(holdControls)) { Text("Credits") }
                Button(onClick = { playerView?.clearFocus(); onFindSubtitles(); subtitlesOpen = true },
                    modifier = Modifier.focusRequester(subtitleFocus).then(holdControls)) { Text("Find subtitles") }
            }
        }
        if (pillVisible) {
            CreditsPill(
                upNext = upNext.takeIf { creditsState.counting },
                controlsVisible = controlsVisible,
                onFocused = { pillFocused = it },
                onSkip = onSkipCredits,
                onWatchCredits = credits::watchCredits,
                modifier = Modifier.align(Alignment.BottomEnd).padding(start = 40.dp, end = 40.dp, bottom = if (controlsVisible) 140.dp else 40.dp),
            )
        }
        if (creditsOpen) {
            CreditsPanel(
                state = creditsState,
                position = { player.currentPosition },
                onMark = { credits.mark(player.currentPosition) },
                onClearMark = credits::clearMark,
                onAutoSkip = credits::chooseAutoSkip,
                onDismiss = {
                    creditsOpen = false
                    playerView?.showController()
                    playerView?.post { creditsFocus.tryRequestFocus() }
                },
                modifier = Modifier.align(Alignment.CenterEnd),
            )
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
        if (showPictureHint && !anyPanelOpen) {
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
