package dev.ottlib.tv.ui.player

import android.view.KeyEvent
import androidx.media3.common.Player
import androidx.media3.ui.PlayerView

/** Transient on-screen feedback for remote shortcuts; [id] makes repeated identical hints restart their timer. */
data class SeekHint(val text: String, val id: Long = System.nanoTime())

/**
 * Remote shortcuts while the controls are hidden: ←/→ seek, OK toggles pause, ↑/↓ reveal the controls.
 * With controls visible, keys go to PlayerView as normal so its buttons and seek bar work.
 */
fun handlePlayerKey(event: KeyEvent, view: PlayerView, player: Player, showHint: (SeekHint) -> Unit): Boolean {
    if (view.isControllerFullyVisible) return false
    val down = event.action == KeyEvent.ACTION_DOWN
    return when (event.keyCode) {
        KeyEvent.KEYCODE_DPAD_LEFT -> {
            if (down) { player.seekBack(); showHint(SeekHint("−${player.seekBackIncrement / 1_000}s")) }
            true
        }
        KeyEvent.KEYCODE_DPAD_RIGHT -> {
            if (down) { player.seekForward(); showHint(SeekHint("+${player.seekForwardIncrement / 1_000}s")) }
            true
        }
        KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER -> {
            if (down && event.repeatCount == 0) {
                if (player.isPlaying) player.pause() else player.play()
                view.showController()
            }
            true
        }
        KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_DOWN -> {
            if (down) view.showController()
            true
        }
        else -> false
    }
}
