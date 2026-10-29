package dev.ottlib.tv.ui.player

import android.view.KeyEvent
import android.view.View
import androidx.media3.common.Player
import androidx.media3.ui.PlayerView
import dev.ottlib.core.player.SeekDirection

/**
 * Remote shortcuts, seen before PlayerView (which would otherwise consume D-pad keys to show its controls).
 *
 * Controls hidden: ←/→ tap to skip, hold to open the scrub bar · OK toggles pause · hold OK opens picture options ·
 * ↑/↓ reveal the controls. Any time: ⏩/⏪ media keys act like ←/→; Menu/Info opens picture options.
 * With controls visible, ←/→ on the focused timeline open the scrub bar; other keys go to PlayerView.
 * While a scrub is open it takes every key (see [handleScrub]).
 */
class RemoteKeys(private val player: Player, private val seeker: RemoteSeeker, private val openPictureOptions: () -> Unit) {
    /** Set once a held OK has opened picture options; the rest of that press is swallowed. */
    private var okLongPressed = false

    fun handle(event: KeyEvent, view: PlayerView, enabled: Boolean): Boolean {
        if (seeker.scrubOpen) return handleScrub(event, enabled)
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
        if (view.isControllerFullyVisible) return openFromTimeline(event, view)
        return when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_LEFT -> true.also { seeker.onKey(SeekDirection.Back, event) }
            KeyEvent.KEYCODE_DPAD_RIGHT -> true.also { seeker.onKey(SeekDirection.Forward, event) }
            in OK_KEYS -> true.also { handleOk(event, view) }
            KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_DOWN -> true.also { if (firstDown) view.showController() }
            else -> false
        }
    }

    /** An open scrub takes every key: ←/→ and ⏩/⏪ move it, OK jumps, Back cancels, the rest is swallowed. */
    private fun handleScrub(event: KeyEvent, enabled: Boolean): Boolean {
        if (!enabled) {
            seeker.cancel() // a dialog took over; let it have the keys
            return false
        }
        val up = event.action == KeyEvent.ACTION_UP
        when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_MEDIA_REWIND -> seeker.onKey(SeekDirection.Back, event)
            KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> seeker.onKey(SeekDirection.Forward, event)
            in OK_KEYS -> if (up) seeker.commit()
            // Both halves are consumed, so Back never reaches the activity (it must not leave the player).
            KeyEvent.KEYCODE_BACK -> if (up) seeker.cancel()
        }
        return true
    }

    /**
     * Controls showing: ←/→ on the focused timeline hide them and open the scrub (its first step). Every other key
     * goes to PlayerView so its buttons work.
     */
    private fun openFromTimeline(event: KeyEvent, view: PlayerView): Boolean {
        val direction = when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_LEFT -> SeekDirection.Back
            KeyEvent.KEYCODE_DPAD_RIGHT -> SeekDirection.Forward
            else -> return false
        }
        if (event.action != KeyEvent.ACTION_DOWN) return false
        if (view.findViewById<View>(androidx.media3.ui.R.id.exo_progress)?.isFocused != true) return false
        view.hideController()
        seeker.openFromTimeline(direction, event)
        return true
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
