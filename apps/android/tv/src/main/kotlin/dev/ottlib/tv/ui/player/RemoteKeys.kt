package dev.ottlib.tv.ui.player

import android.view.KeyEvent
import androidx.media3.common.Player
import androidx.media3.ui.PlayerView
import dev.ottlib.core.player.SeekDirection

/**
 * Remote shortcuts, seen before PlayerView (which would otherwise consume D-pad keys to show its controls).
 *
 * Controls hidden: ←/→ seek (tap, or hold to accelerate) · OK toggles pause · hold OK opens picture options ·
 * ↑/↓ reveal the controls. Any time: ⏩/⏪ media keys seek; Menu/Info opens picture options.
 * With controls visible, D-pad and OK go to PlayerView so its buttons and seek bar work.
 */
class RemoteKeys(private val player: Player, private val seeker: RemoteSeeker, private val openPictureOptions: () -> Unit) {
    /** Set once a held OK has opened picture options; the rest of that press is swallowed. */
    private var okLongPressed = false

    fun handle(event: KeyEvent, view: PlayerView, enabled: Boolean): Boolean {
        // Swallow the remainder of the long-press, or its release would click the first option in the panel.
        if (event.keyCode in OK_KEYS && okLongPressed) {
            if (event.action == KeyEvent.ACTION_UP) okLongPressed = false
            return true
        }
        if (!enabled) return false
        val firstDown = event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0
        when (event.keyCode) {
            KeyEvent.KEYCODE_MENU, KeyEvent.KEYCODE_INFO -> {
                if (firstDown) openPictureOptions()
                return true
            }
            KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> return true.also { seeker.onKey(SeekDirection.Forward, event) }
            KeyEvent.KEYCODE_MEDIA_REWIND -> return true.also { seeker.onKey(SeekDirection.Back, event) }
        }
        if (view.isControllerFullyVisible) return false
        return when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_LEFT -> true.also { seeker.onKey(SeekDirection.Back, event) }
            KeyEvent.KEYCODE_DPAD_RIGHT -> true.also { seeker.onKey(SeekDirection.Forward, event) }
            in OK_KEYS -> true.also { handleOk(event, view) }
            KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_DOWN -> true.also { if (firstDown) view.showController() }
            else -> false
        }
    }

    /** OK acts on release, so holding it can mean something else. */
    private fun handleOk(event: KeyEvent, view: PlayerView) {
        when (event.action) {
            // Android flags the repeat once the system long-press timeout passes; elapsed time covers remotes that don't.
            KeyEvent.ACTION_DOWN -> if (event.repeatCount > 0 && (event.isLongPress || event.eventTime - event.downTime >= LONG_PRESS_MS)) {
                okLongPressed = true
                openPictureOptions()
            }
            KeyEvent.ACTION_UP -> {
                if (player.isPlaying) player.pause() else player.play()
                view.showController()
            }
        }
    }

    private companion object {
        const val LONG_PRESS_MS = 500L
        val OK_KEYS = setOf(KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER)
    }
}
