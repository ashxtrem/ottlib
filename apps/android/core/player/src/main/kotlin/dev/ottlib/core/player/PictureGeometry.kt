package dev.ottlib.core.player

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
}
