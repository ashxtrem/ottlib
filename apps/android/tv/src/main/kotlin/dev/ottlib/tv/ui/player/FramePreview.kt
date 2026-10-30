package dev.ottlib.tv.ui.player

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage

/**
 * The scrub bar's preview frame from the server, on direct play and "Play via server" alike. The last frame that
 * loaded stays underneath while the next one loads, so a slow or superseded (204) request never blanks the preview;
 * a black box shows until the first one lands ([url] null). Not focusable.
 */
@Composable
fun FramePreview(url: String?, modifier: Modifier = Modifier) {
    var shown by remember { mutableStateOf<String?>(null) }
    Box(modifier.width(FRAME_PREVIEW_WIDTH).aspectRatio(16f / 9f).clip(RoundedCornerShape(8.dp)).background(Color.Black)) {
        shown?.let { AsyncImage(model = it, contentDescription = null, contentScale = ContentScale.Fit, modifier = Modifier.matchParentSize()) }
        if (url != null && url != shown) {
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

val FRAME_PREVIEW_WIDTH = 320.dp
