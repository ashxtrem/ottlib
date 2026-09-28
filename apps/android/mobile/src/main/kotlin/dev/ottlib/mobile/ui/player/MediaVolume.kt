package dev.ottlib.mobile.ui.player

import android.content.Context
import android.media.AudioManager
import kotlin.math.roundToInt

/**
 * The device's media volume, driven by swipes. Tracks a fractional level so slow swipes still move it, even though
 * the stream only has ~15 steps. Levels are 0..1. The system volume panel stays hidden; the player shows its own.
 */
class MediaVolume(context: Context) {
    private val audio = context.getSystemService(AudioManager::class.java)
    private val maxIndex = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1)
    private var level = currentLevel()

    /** Call when a swipe starts: the volume keys may have changed it since the last one. */
    fun sync() {
        level = currentLevel()
    }

    fun adjust(delta: Float): Float {
        level = (level + delta).coerceIn(0f, 1f)
        // Fixed-volume devices and Do Not Disturb can refuse; the level shown is still the one asked for.
        runCatching { audio.setStreamVolume(AudioManager.STREAM_MUSIC, (level * maxIndex).roundToInt(), 0) }
        return level
    }

    private fun currentLevel() = audio.getStreamVolume(AudioManager.STREAM_MUSIC).toFloat() / maxIndex
}
