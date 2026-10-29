package dev.ottlib.mobile.ui.player

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage

private val FRAME_WIDTH = 160.dp
private val FRAME_HEIGHT = 90.dp

/**
 * The scrub preview frame (direct play and "Play via server"), centred over the slider thumb at [fraction] and kept inside the
 * bar's width (so it works at every width class). Draws above its own bounds: give it `matchParentSize()` over the slider.
 */
@Composable
fun FramePreviewAboveThumb(url: String, fraction: Float, modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier) {
        val x = (maxWidth * fraction - FRAME_WIDTH / 2).coerceIn(0.dp, (maxWidth - FRAME_WIDTH).coerceAtLeast(0.dp))
        FramePreview(url, Modifier.offset(x = x, y = -(FRAME_HEIGHT + 8.dp)).wrapContentSize(Alignment.TopStart, unbounded = true))
    }
}

/** The last frame that loaded stays underneath while the next loads, so a slow or superseded (204) request never blanks it. */
@Composable
private fun FramePreview(url: String, modifier: Modifier) {
    var shown by remember { mutableStateOf<String?>(null) }
    Box(modifier.size(FRAME_WIDTH, FRAME_HEIGHT).clip(RoundedCornerShape(6.dp)).background(Color.Black)) {
        shown?.let { AsyncImage(model = it, contentDescription = null, contentScale = ContentScale.Fit, modifier = Modifier.matchParentSize()) }
        if (url != shown) {
            AsyncImage(
                model = url,
                contentDescription = "Preview frame",
                contentScale = ContentScale.Fit,
                onSuccess = { shown = url },
                modifier = Modifier.matchParentSize(),
            )
        }
    }
}
