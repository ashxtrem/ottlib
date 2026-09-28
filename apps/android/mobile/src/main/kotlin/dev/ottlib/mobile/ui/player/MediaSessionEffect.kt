package dev.ottlib.mobile.ui.player

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalContext
import androidx.media3.common.Player
import androidx.media3.session.MediaSession

/**
 * Publishes the player to the system while it is on screen: play/pause in the picture-in-picture window, and
 * headset / Bluetooth media buttons.
 */
@Composable
fun MediaSessionEffect(player: Player) {
    val context = LocalContext.current
    DisposableEffect(player) {
        val session = MediaSession.Builder(context, player).build()
        onDispose { session.release() }
    }
}
