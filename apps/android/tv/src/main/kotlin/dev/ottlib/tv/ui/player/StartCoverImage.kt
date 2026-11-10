package dev.ottlib.tv.ui.player

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import coil3.compose.AsyncImage
import dev.ottlib.core.presentation.player.StartCover

/** [surface] with [cover] drawn over it (it takes no focus, so the remote keeps driving the player); null once a frame is up. */
@Composable
fun ReadyPlayer(cover: StartCover?, surface: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize()) {
        surface()
        StartCoverImage(cover)
    }
}

/** One static image (the resume frame, else the backdrop) shown while playback starts; dimmed so status text stays readable. */
@Composable
fun StartCoverImage(cover: StartCover?, modifier: Modifier = Modifier) {
    val url = cover?.imageUrl ?: return
    Box(modifier.fillMaxSize().background(Color.Black)) {
        AsyncImage(model = url, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.45f)))
    }
}
