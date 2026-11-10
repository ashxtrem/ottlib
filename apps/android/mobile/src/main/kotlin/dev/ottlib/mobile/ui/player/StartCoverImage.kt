package dev.ottlib.mobile.ui.player

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import coil3.compose.AsyncImage
import dev.ottlib.core.presentation.player.StartCover

/**
 * The resume frame (else the backdrop) shown in the video area until the first frame renders. Fitted like the video,
 * so the picture does not jump when playback takes over. Callers pass null once the first frame is up.
 */
@Composable
fun StartCoverImage(cover: StartCover?, modifier: Modifier = Modifier) {
    val url = cover?.imageUrl ?: return
    AsyncImage(model = url, contentDescription = null, contentScale = ContentScale.Fit, modifier = modifier.fillMaxSize())
}
