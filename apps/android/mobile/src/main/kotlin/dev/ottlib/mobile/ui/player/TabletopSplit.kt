package dev.ottlib.mobile.ui.player

import androidx.compose.material3.adaptive.currentWindowAdaptiveInfo
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp

/** Where a horizontal fold crosses the player: [top] of video above it, then [hinge] of dead space. */
data class TabletopSplit(val top: Dp, val hinge: Dp)

/**
 * Non-null while the device is half-folded with the fold running across the player — Samsung's Flex mode, or
 * any foldable standing like a laptop. [layoutTop] and [layoutHeight] place the player in the window, in pixels.
 */
@Composable
fun rememberTabletopSplit(layoutTop: Float, layoutHeight: Int): TabletopSplit? {
    val posture = currentWindowAdaptiveInfo().windowPosture
    if (!posture.isTabletop) return null
    val hinge = posture.hingeList.firstOrNull { !it.isVertical } ?: return null
    val top = hinge.bounds.top - layoutTop
    // Only split when the fold leaves usable room on both sides (not in a small split-screen pane, say).
    if (top < layoutHeight * MIN_SHARE || top > layoutHeight * (1 - MIN_SHARE)) return null
    return with(LocalDensity.current) { TabletopSplit(top.toDp(), hinge.bounds.height.toDp()) }
}

private const val MIN_SHARE = 0.25f
