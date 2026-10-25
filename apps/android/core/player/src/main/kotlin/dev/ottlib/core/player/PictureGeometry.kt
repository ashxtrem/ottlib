package dev.ottlib.core.player

import dev.ottlib.core.model.PictureArea
import dev.ottlib.core.model.PictureMode
import kotlin.math.max
import kotlin.math.sqrt

/**
 * Picture-shape maths for [dev.ottlib.core.model.PictureMode]. Aspect ratios are width ÷ height.
 */
object PictureGeometry {
    /**
     * The frame shape for Smart fill: the geometric mean of the video's and the screen's aspect ratios. The video is
     * stretched to this shape and the frame is then zoomed to cover the screen, so the mismatch is split evenly —
     * e.g. a 2.40:1 film on a 16:9 screen is stretched ~16% and trimmed ~14%, instead of 35% stretched (Stretch) or
     * 25% trimmed (Zoom).
     */
    fun smartFillAspectRatio(videoAspect: Float, screenAspect: Float): Float = sqrt(videoAspect * screenAspect)

    /** Fraction of the picture cut off when a frame of [frameAspect] is zoomed to cover a [screenAspect] screen. */
    fun trimmedFraction(frameAspect: Float, screenAspect: Float): Float =
        1f - minOf(frameAspect, screenAspect) / max(frameAspect, screenAspect)

    /** How much the video's shape is distorted when drawn into a frame of [frameAspect] (0 = undistorted). */
    fun distortion(videoAspect: Float, frameAspect: Float): Float =
        max(videoAspect, frameAspect) / minOf(videoAspect, frameAspect) - 1f

    /**
     * Where to draw the whole video frame so that the real picture [area] (bars burned into the frame excluded) is
     * fitted to the screen by [scaling], or by [forcedAspect] when set. The rectangle may be larger than the screen
     * and start off it (negative [FrameRect.left]/[FrameRect.top]); the player view clips it.
     */
    fun frameRect(
        scaling: PictureMode.Scaling,
        forcedAspect: Float?,
        videoAspect: Float,
        area: PictureArea,
        screenW: Float,
        screenH: Float,
    ): FrameRect {
        val screenAspect = screenW / screenH
        val active = videoAspect * area.width / area.height
        val (activeW, activeH) = when {
            forcedAspect != null -> fit(forcedAspect, screenW, screenH)
            scaling == PictureMode.Scaling.Fit -> fit(active, screenW, screenH)
            scaling == PictureMode.Scaling.Crop -> cover(active, screenW, screenH)
            scaling == PictureMode.Scaling.Stretch -> screenW to screenH
            else -> cover(smartFillAspectRatio(active, screenAspect), screenW, screenH)
        }
        val frameW = activeW / area.width
        val frameH = activeH / area.height
        return FrameRect(
            width = frameW,
            height = frameH,
            left = screenW / 2f - (area.x + area.width / 2f) * frameW,
            top = screenH / 2f - (area.y + area.height / 2f) * frameH,
        )
    }

    private fun fit(aspect: Float, w: Float, h: Float): Pair<Float, Float> =
        if (aspect > w / h) w to w / aspect else h * aspect to h

    private fun cover(aspect: Float, w: Float, h: Float): Pair<Float, Float> =
        if (aspect > w / h) h * aspect to h else w to w / aspect
}

/** A rectangle in px, relative to the player view's top-left corner. */
data class FrameRect(val width: Float, val height: Float, val left: Float, val top: Float)
