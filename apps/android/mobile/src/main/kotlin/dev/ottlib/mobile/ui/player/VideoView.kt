package dev.ottlib.mobile.ui.player

import androidx.annotation.OptIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.ui.PlayerView
import dev.ottlib.core.model.PictureMode
import dev.ottlib.core.player.PictureModeController

/**
 * The video and its subtitles. Media3's own controller is off: the phone draws touch controls in Compose on top.
 * Picture modes go through the same [PictureModeController] as the TV app.
 */
@OptIn(UnstableApi::class)
@Composable
fun VideoView(player: Player, pictureMode: PictureMode, modifier: Modifier = Modifier) {
    var picture by remember { mutableStateOf<PictureModeController?>(null) }
    LaunchedEffect(picture, pictureMode) { picture?.apply(pictureMode) }

    AndroidView(
        modifier = modifier,
        factory = { context ->
            PlayerView(context).apply {
                this.player = player
                useController = false
                setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING)
                keepScreenOn = true
                picture = PictureModeController(this, player)
            }
        },
        onRelease = { view ->
            picture?.release()
            picture = null
            view.player = null
        },
    )
}
