package dev.ottlib.mobile.ui.player

import android.app.PictureInPictureParams
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Rect as AndroidRect
import android.os.Build
import android.util.Rational
import androidx.activity.compose.LocalActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.geometry.Rect
import androidx.core.app.PictureInPictureModeChangedInfo
import androidx.core.util.Consumer
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import dev.ottlib.mobile.MainActivity
import kotlin.math.roundToInt

fun Context.supportsPictureInPicture(): Boolean = packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)

/** True while the app is showing in the picture-in-picture window. */
@Composable
fun rememberInPictureInPicture(): Boolean {
    val activity = LocalActivity.current as? MainActivity ?: return false
    var inPictureInPicture by remember { mutableStateOf(activity.isInPictureInPictureMode) }
    DisposableEffect(activity) {
        val listener = Consumer<PictureInPictureModeChangedInfo> { inPictureInPicture = it.isInPictureInPictureMode }
        activity.addOnPictureInPictureModeChangedListener(listener)
        onDispose { activity.removeOnPictureInPictureModeChangedListener(listener) }
    }
    return inPictureInPicture
}

/**
 * Keeps the activity's picture-in-picture setup in step with the video: the window takes the video's shape, and
 * leaving the app (Home gesture, app switch) shrinks the video into it — only while it is playing. [videoArea] is
 * where the player is drawn in the window, so the shrink animation starts from the picture itself.
 */
@Composable
fun PictureInPictureEffect(player: Player, videoArea: Rect) {
    val activity = LocalActivity.current as? MainActivity ?: return
    if (!activity.supportsPictureInPicture()) return
    var playing by remember(player) { mutableStateOf(player.isPlaying) }
    var videoSize by remember(player) { mutableStateOf(player.videoSize) }
    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                playing = isPlaying
            }

            override fun onVideoSizeChanged(size: VideoSize) {
                videoSize = size
            }
        }
        player.addListener(listener)
        onDispose { player.removeListener(listener) }
    }
    DisposableEffect(activity, playing, videoSize, videoArea) {
        val params = pictureInPictureParams(videoSize, videoArea, autoEnter = playing)
        activity.setPictureInPictureParams(params)
        activity.pictureInPictureOnLeave = params.takeIf { playing }
        onDispose {
            activity.pictureInPictureOnLeave = null
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) activity.setPictureInPictureParams(PictureInPictureParams.Builder().setAutoEnterEnabled(false).build())
        }
    }
}

fun MainActivity.enterPictureInPicture(player: Player, videoArea: Rect) {
    enterPictureInPictureMode(pictureInPictureParams(player.videoSize, videoArea, autoEnter = player.isPlaying))
}

private fun pictureInPictureParams(videoSize: VideoSize, videoArea: Rect, autoEnter: Boolean): PictureInPictureParams =
    PictureInPictureParams.Builder().apply {
        aspectRatio(videoSize)?.let(::setAspectRatio)
        sourceRect(videoArea, videoSize)?.let(::setSourceRectHint)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            setAutoEnterEnabled(autoEnter)
            setSeamlessResizeEnabled(false) // video content: let the system cross-fade instead of stretching frames
        }
    }.build()

/** The video's shape, clamped to the range Android accepts for picture-in-picture windows (1:2.39 to 2.39:1). */
private fun aspectRatio(size: VideoSize): Rational? {
    val ratio = size.aspect()?.coerceIn(MIN_RATIO, MAX_RATIO) ?: return null
    return Rational((ratio * 10_000).toInt(), 10_000)
}

/** The picture inside [area] as Fit mode draws it (letterboxed), in window pixels. */
private fun sourceRect(area: Rect, size: VideoSize): AndroidRect? {
    if (area.isEmpty) return null
    val video = size.aspect() ?: return null
    val (width, height) = if (video > area.width / area.height) area.width to area.width / video else area.height * video to area.height
    val left = area.center.x - width / 2
    val top = area.center.y - height / 2
    return AndroidRect(left.roundToInt(), top.roundToInt(), (left + width).roundToInt(), (top + height).roundToInt())
}

private fun VideoSize.aspect(): Float? = if (width > 0 && height > 0) width * pixelWidthHeightRatio / height else null

private const val MAX_RATIO = 2.39f
private const val MIN_RATIO = 1 / 2.39f + 0.001f
