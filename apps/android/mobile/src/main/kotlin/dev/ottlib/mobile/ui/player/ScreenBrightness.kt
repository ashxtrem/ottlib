package dev.ottlib.mobile.ui.player

import android.provider.Settings
import android.view.Window
import android.view.WindowManager

/**
 * Brightness for this window only: the system setting (and auto-brightness) is untouched, and [reset] hands control
 * back when the player closes. Levels are 0..1.
 */
class ScreenBrightness(private val window: Window) {
    var level: Float = initialLevel()
        private set

    fun adjust(delta: Float): Float {
        level = (level + delta).coerceIn(MIN_LEVEL, 1f)
        window.attributes = window.attributes.apply { screenBrightness = level }
        return level
    }

    fun reset() {
        window.attributes = window.attributes.apply { screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE }
    }

    /** Starts from the current screen brightness so the first swipe doesn't jump. */
    private fun initialLevel(): Float {
        window.attributes.screenBrightness.takeIf { it >= 0f }?.let { return it }
        val system = runCatching { Settings.System.getInt(window.context.contentResolver, Settings.System.SCREEN_BRIGHTNESS) }.getOrNull() ?: return 0.5f
        return (system / 255f).coerceIn(MIN_LEVEL, 1f)
    }

    private companion object {
        /** Zero turns some panels fully off; keep the picture visible. */
        const val MIN_LEVEL = 0.01f
    }
}
