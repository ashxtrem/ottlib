package dev.ottlib.core.player

import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.common.util.UnstableApi
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import dev.ottlib.core.model.PictureArea
import dev.ottlib.core.model.PictureMode
import kotlin.math.roundToInt


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
    private val stockLayoutParams: ViewGroup.LayoutParams? = frame?.layoutParams
    private var mode = PictureMode.Fit
    private var area: PictureArea? = null
    private var areaPlaced = false

    // PlayerView resets the frame's ratio on every video-size change; re-apply a forced one after it does.
    private val listener = object : Player.Listener {
        override fun onVideoSizeChanged(videoSize: VideoSize) {
            onVideoSize()
            view.post { onVideoSize() }
        }
    }

    private fun onVideoSize() {
        if (area != null) refresh() else applyAspectRatio()
    }

    // Smart fill and the picture area depend on the screen's shape, which is only known once the view is laid out.
    private val layoutListener = View.OnLayoutChangeListener { _, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom ->
        if (right - left != oldRight - oldLeft || bottom - top != oldBottom - oldTop) {
            applyAspectRatio()
            if (area != null) view.post { refresh() }
        }
    }

    init {
        keepSubtitlesOnScreen()
        player.addListener(listener)
        view.addOnLayoutChangeListener(layoutListener)
    }

    fun apply(mode: PictureMode) {
        this.mode = mode
        refresh()
    }

    /**
     * The real picture inside the video frame (scope bars burned into a 16:9 frame excluded), or null for the whole
     * frame. With an area every mode, Fit included, fits the real picture instead of the frame.
     */
    fun setPictureArea(area: PictureArea?) {
        this.area = area
        refresh()
    }

    fun release() {
        player.removeListener(listener)
        view.removeOnLayoutChangeListener(layoutListener)
    }

    private fun refresh() {
        val rect = areaRect()
        if (rect != null) {
            placeFrame(rect)
        } else {
            restoreFrame()
            applyMode()
        }
    }

    private fun applyMode() {
        view.setResizeMode(
            when (mode.scaling) {
                PictureMode.Scaling.Fit -> AspectRatioFrameLayout.RESIZE_MODE_FIT
                PictureMode.Scaling.Crop, PictureMode.Scaling.Balanced -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                PictureMode.Scaling.Stretch -> AspectRatioFrameLayout.RESIZE_MODE_FILL
            },
        )
        applyAspectRatio()
    }

    /** The frame's on-screen rectangle for the current area, or null when there is no area or nothing to size by. */
    private fun areaRect(): FrameRect? {
        val area = area ?: return null
        if (frame == null || stockLayoutParams == null) return null
        if (area.width <= 0f || area.height <= 0f) return null
        val video = naturalAspectRatio() ?: return null
        if (view.width <= 0 || view.height <= 0) return null
        return PictureGeometry.frameRect(mode.scaling, mode.aspectRatio, video, area, view.width.toFloat(), view.height.toFloat())
    }

    /** Sizes and positions the content frame explicitly; PlayerView clips the parts that fall off screen. */
    private fun placeFrame(rect: FrameRect) {
        val frame = frame ?: return
        view.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FILL)
        val params = FrameLayout.LayoutParams(rect.width.roundToInt(), rect.height.roundToInt(), Gravity.TOP or Gravity.START).apply {
            leftMargin = rect.left.roundToInt()
            topMargin = rect.top.roundToInt()
        }
        val current = frame.layoutParams as? FrameLayout.LayoutParams
        val same = areaPlaced && current != null && current.width == params.width && current.height == params.height &&
            current.leftMargin == params.leftMargin && current.topMargin == params.topMargin
        if (!same) frame.layoutParams = params
        areaPlaced = true
    }

    /** Puts back the stock MATCH_PARENT layout params after an area was applied. */
    private fun restoreFrame() {
        if (!areaPlaced) return
        areaPlaced = false
        val frame = frame ?: return
        stockLayoutParams?.let { frame.layoutParams = it }
    }

    private fun applyAspectRatio() {
        if (areaPlaced) return
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
