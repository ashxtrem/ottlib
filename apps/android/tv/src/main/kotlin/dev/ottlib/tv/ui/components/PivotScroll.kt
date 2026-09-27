package dev.ottlib.tv.ui.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.gestures.BringIntoViewSpec
import androidx.compose.foundation.gestures.LocalBringIntoViewSpec
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp

/**
 * Scrolls so the focused item's leading edge sits [pivotPx] from the start of the list. Each D-pad move then
 * produces exactly one, predictable scroll (instead of "just enough to be visible"), which is the standard TV
 * behaviour and avoids competing scroll animations on slow devices.
 */
@OptIn(ExperimentalFoundationApi::class)
private class PivotBringIntoViewSpec(private val pivotPx: Float) : BringIntoViewSpec {
    override fun calculateScrollDistance(offset: Float, size: Float, containerSize: Float): Float = offset - pivotPx
}

/** Applies pivot scrolling to lists declared in [content]; use [DefaultScroll] to opt nested lists back out. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun PivotScroll(pivot: Dp, content: @Composable (defaultSpec: BringIntoViewSpec) -> Unit) {
    val defaultSpec = LocalBringIntoViewSpec.current
    val pivotPx = with(LocalDensity.current) { pivot.toPx() }
    val spec = remember(pivotPx) { PivotBringIntoViewSpec(pivotPx) }
    CompositionLocalProvider(LocalBringIntoViewSpec provides spec) { content(defaultSpec) }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun DefaultScroll(spec: BringIntoViewSpec, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalBringIntoViewSpec provides spec, content = content)
