package dev.ottlib.mobile.ui.player

import androidx.activity.compose.LocalActivity
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ZoomInMap
import androidx.compose.material.icons.filled.ZoomOutMap
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.movableContentOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.media3.common.C
import androidx.media3.common.Player
import dev.ottlib.core.model.PictureMode
import dev.ottlib.core.player.SeekDirection
import dev.ottlib.core.presentation.player.PlayerControls
import dev.ottlib.core.presentation.player.SubtitleSearchController
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.ottlib.mobile.MainActivity
import kotlinx.coroutines.delay

private enum class Panel { Tracks, Picture, Subtitles }

/**
 * The video with touch controls. Flat, the controls float over the video and fade while it plays; half-folded
 * (Flex mode), the video moves above the fold and the controls stay below it. The video view itself moves between
 * the two layouts without being rebuilt, so folding never interrupts the picture.
 */
@Composable
fun PlayerSurface(
    player: Player,
    title: String,
    controls: PlayerControls,
    pictureMode: PictureMode,
    inPictureInPicture: Boolean,
    onExit: () -> Unit,
    onPictureModeChosen: (PictureMode, Boolean) -> Unit,
    onSessionPictureMode: (PictureMode) -> Unit,
    onPictureHintSeen: () -> Unit,
    onPlayElsewhere: () -> Unit,
    subtitles: SubtitleSearchController,
    onFindSubtitles: () -> Unit,
) {
    val context = LocalContext.current
    val activity = LocalActivity.current as? MainActivity
    val snapshot by rememberPlaybackSnapshot(player)
    val subtitleState by subtitles.uiState.collectAsStateWithLifecycle()
    var controlsVisible by rememberSaveable { mutableStateOf(true) }
    var panel by rememberSaveable { mutableStateOf<Panel?>(null) }
    var scrubbing by remember { mutableStateOf(false) }
    var interactions by remember { mutableIntStateOf(0) }
    var hint by remember { mutableStateOf<PlayerHint?>(null) }
    var swipeFrom by remember { mutableStateOf<Long?>(null) }
    /** Where the player sits in the window: for the Flex mode split and the picture-in-picture animation. */
    var area by remember { mutableStateOf(Rect.Zero) }

    val seeker = remember(player, controls) { TouchSeeker(player, controls.skipBackMs, controls.skipForwardMs) { hint = it } }
    DisposableEffect(seeker) { onDispose { seeker.release() } }
    val brightness = remember(activity) { activity?.window?.let(::ScreenBrightness) }
    DisposableEffect(brightness) { onDispose { brightness?.reset() } }
    val volume = remember(context) { MediaVolume(context) }
    val duration = { player.duration.takeIf { it != C.TIME_UNSET } }

    val gestures by rememberUpdatedState(
        PlayerGestureHandler(
            onTap = { controlsVisible = !controlsVisible },
            onDoubleTap = { zone ->
                when (zone) {
                    Zone.Start -> seeker.tap(SeekDirection.Back)
                    Zone.End -> seeker.tap(SeekDirection.Forward)
                    Zone.Center -> player.togglePlayPause()
                }
            },
            onVerticalDragStart = { side -> if (side == Zone.End) volume.sync() },
            onVerticalDrag = { side, delta ->
                hint = if (side == Zone.Start) brightness?.let { PlayerHint.brightness(it.adjust(delta)) } else PlayerHint.volume(volume.adjust(delta))
            },
            onHorizontalDrag = { fraction ->
                val from = swipeFrom ?: player.currentPosition.also { swipeFrom = it }
                val offset = SeekMath.swipeOffsetMs(fraction)
                hint = seekHint(offset, SeekMath.target(from, offset, duration()))
            },
            onHorizontalDragEnd = { fraction ->
                val from = swipeFrom ?: player.currentPosition
                swipeFrom = null
                val offset = SeekMath.swipeOffsetMs(fraction)
                if (offset != 0L) player.seekTo(SeekMath.target(from, offset, duration()))
            },
            onPinch = { zoomIn ->
                val mode = if (zoomIn) PictureMode.Zoom else PictureMode.Fit
                onSessionPictureMode(mode)
                hint = PlayerHint(mode.label, if (zoomIn) Icons.Filled.ZoomOutMap else Icons.Filled.ZoomInMap)
            },
        ),
    )

    val actions = PlayerActions(
        onBack = onExit,
        onPlayPause = {
            player.togglePlayPause()
            interactions++
        },
        onSkip = {
            seeker.tap(it)
            interactions++
        },
        onSeekTo = player::seekTo,
        onScrubbing = { scrubbing = it },
        onTracks = { panel = Panel.Tracks },
        onPicture = { panel = Panel.Picture },
        onPictureInPicture = activity?.takeIf { it.supportsPictureInPicture() }?.let { host -> { host.enterPictureInPicture(player, area) } },
        onPlayElsewhere = onPlayElsewhere,
    )

    // Controls fade while the video plays untouched; they stay while paused, scrubbing, or a panel is open.
    LaunchedEffect(controlsVisible, snapshot.isPlaying, scrubbing, panel, interactions) {
        if (controlsVisible && snapshot.isPlaying && !scrubbing && panel == null) {
            delay(CONTROLS_VISIBLE_MS)
            controlsVisible = false
        }
    }
    hint?.let { shown ->
        LaunchedEffect(shown.id) {
            delay(shown.visibleMs)
            hint = null
        }
    }
    LaunchedEffect(inPictureInPicture) { if (inPictureInPicture) panel = null }
    if (controls.showPictureHint) LaunchedEffect(Unit) {
        delay(PICTURE_HINT_DELAY_MS)
        hint = PlayerHint("Pinch to fill the screen", Icons.Filled.ZoomOutMap, visibleMs = PICTURE_HINT_VISIBLE_MS)
        onPictureHintSeen()
    }

    val split = if (inPictureInPicture) null else rememberTabletopSplit(area.top, area.height.toInt())
    PictureInPictureEffect(player, area)
    val video = remember(player) { movableContentOf { mode: PictureMode, modifier: Modifier -> VideoView(player, mode, modifier) } }
    val touch = Modifier.fillMaxSize().playerGestures { gestures }

    Box(
        Modifier.fillMaxSize().background(Color.Black).onGloballyPositioned { area = it.boundsInWindow() },
    ) {
        if (split == null) {
            video(pictureMode, Modifier.fillMaxSize())
            if (!inPictureInPicture) {
                Box(touch)
                AnimatedVisibility(controlsVisible, enter = fadeIn(), exit = fadeOut()) { OverlayControls(title, snapshot, controls, actions) }
                PlayerHintOverlay(hint)
            }
        } else {
            Column(Modifier.fillMaxSize()) {
                Box(Modifier.fillMaxWidth().height(split.top)) {
                    video(pictureMode, Modifier.fillMaxSize())
                    Box(touch)
                    PlayerHintOverlay(hint)
                }
                Spacer(Modifier.height(split.hinge))
                TabletopControls(title, snapshot, controls, actions, Modifier.weight(1f).fillMaxWidth())
            }
        }
        when (panel) {
            Panel.Tracks -> TrackPanel(player, onFindSubtitles = { onFindSubtitles(); panel = Panel.Subtitles }, onDismiss = { panel = null })
            Panel.Subtitles -> SubtitlePanel(subtitleState, subtitles, onRetry = onFindSubtitles, onDismiss = { panel = null })
            Panel.Picture -> PicturePanel(pictureMode, onChoose = onPictureModeChosen, onDismiss = { panel = null })
            null -> Unit
        }
    }
}

private const val CONTROLS_VISIBLE_MS = 3_500L
private const val PICTURE_HINT_DELAY_MS = 1_500L
private const val PICTURE_HINT_VISIBLE_MS = 4_000L
