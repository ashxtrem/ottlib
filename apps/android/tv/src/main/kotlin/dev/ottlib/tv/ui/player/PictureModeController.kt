package dev.ottlib.tv.ui.player

import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.common.util.UnstableApi
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import dev.ottlib.core.model.PictureMode
import dev.ottlib.core.player.PictureGeometry

/**
 * Applies a [PictureMode] to Media3's PlayerView. Geometry only: the hardware video path (HDR, Dolby Vision,
 * tunnelling) is untouched.
 *
 * This is the one place that relies on PlayerView's layout contract: the video frame `exo_content_frame` (an
 * [AspectRatioFrameLayout]) and the full-screen overlay. If a Media3 update changes them, forced ratios and the
 * subtitle move are skipped and plain resize modes still work.
 */
@OptIn(UnstableApi::class)
class PictureModeController(private val view: PlayerView, private val player: Player) {
    private val frame: AspectRatioFrameLayout? = view.findViewById(androidx.media3.ui.R.id.exo_content_frame)
    private var mode = PictureMode.Fit

    // PlayerView resets the frame's ratio on every video-size change; re-apply a forced one after it does.
    private val listener = object : Player.Listener {
        override fun onVideoSizeChanged(videoSize: VideoSize) {
            applyAspectRatio()
            view.post { applyAspectRatio() }
        }
    }

    // Smart fill depends on the screen's shape, which is only known once the view is laid out.
    private val layoutListener = View.OnLayoutChangeListener { _, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom ->
        if (right - left != oldRight - oldLeft || bottom - top != oldBottom - oldTop) applyAspectRatio()
    }

    init {
        keepSubtitlesOnScreen()
        player.addListener(listener)
        view.addOnLayoutChangeListener(layoutListener)
    }

    fun apply(mode: PictureMode) {
        this.mode = mode
        view.setResizeMode(
            when (mode.scaling) {
                PictureMode.Scaling.Fit -> AspectRatioFrameLayout.RESIZE_MODE_FIT
                PictureMode.Scaling.Crop, PictureMode.Scaling.Balanced -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                PictureMode.Scaling.Stretch -> AspectRatioFrameLayout.RESIZE_MODE_FILL
            },
        )
        applyAspectRatio()
    }

    fun release() {
        player.removeListener(listener)
        view.removeOnLayoutChangeListener(layoutListener)
    }

    private fun applyAspectRatio() {
        val ratio = when {
            mode.aspectRatio != null -> mode.aspectRatio
            mode.scaling == PictureMode.Scaling.Balanced -> smartFillAspectRatio()
            else -> naturalAspectRatio()
        } ?: return
        frame?.setAspectRatio(ratio)
    }

    private fun smartFillAspectRatio(): Float? {
        val video = naturalAspectRatio() ?: return null
        if (view.width <= 0 || view.height <= 0) return null
        return PictureGeometry.smartFillAspectRatio(video, view.width.toFloat() / view.height)
    }

    private fun naturalAspectRatio(): Float? =
        player.videoSize.takeIf { it.width > 0 && it.height > 0 }?.let { it.width * it.pixelWidthHeightRatio / it.height }

    /**
     * In the stock layout subtitles live inside the video frame, which Zoom enlarges past the screen edges — bottom
     * subtitles on 4:3 content would be cut off. The full-screen overlay sits above the video and below the controls.
     */
    private fun keepSubtitlesOnScreen() {
        val subtitles = view.subtitleView ?: return
        val overlay = view.overlayFrameLayout ?: return
        if (subtitles.parent === overlay) return
        (subtitles.parent as? ViewGroup)?.removeView(subtitles)
        overlay.addView(subtitles, 0, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
    }
}
