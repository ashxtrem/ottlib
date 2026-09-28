package dev.ottlib.mobile.ui.components

import androidx.compose.material3.adaptive.currentWindowAdaptiveInfo
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass

/**
 * Material window width classes. Layouts key off the window, never the device, so the same code handles the Fold's
 * cover screen (Compact), the inner screen (Medium/Expanded), phone landscape, split screen and pop-up windows.
 */
enum class WindowWidth { Compact, Medium, Expanded }

@Composable
fun windowWidth(): WindowWidth {
    val sizeClass = currentWindowAdaptiveInfo().windowSizeClass
    return when {
        sizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND) -> WindowWidth.Expanded
        sizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND) -> WindowWidth.Medium
        else -> WindowWidth.Compact
    }
}

/** Grids use this as a minimum cell width, so column counts follow the window: ~3 on the cover screen, 5–7 unfolded. */
val WindowWidth.posterWidth: Dp
    get() = when (this) {
        WindowWidth.Compact -> 108.dp
        WindowWidth.Medium -> 124.dp
        WindowWidth.Expanded -> 140.dp
    }

val WindowWidth.gutter: Dp
    get() = if (this == WindowWidth.Compact) 16.dp else 24.dp
