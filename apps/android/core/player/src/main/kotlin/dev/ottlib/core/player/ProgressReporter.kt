package dev.ottlib.core.player

import androidx.media3.common.C
import androidx.media3.common.Player
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.abs

/**
 * Saves the playback position every [intervalMs] while playing, and whenever playback pauses, ends, or
 * the screen closes. Positions are read on the main thread; [save] runs in [saveScope], which should
 * outlive the screen so the final position is not lost when the player is released.
 */
class ProgressReporter(
    private val player: Player,
    private val tickerScope: CoroutineScope,
    private val saveScope: CoroutineScope,
    private val fallbackDurationMs: Long?,
    private val intervalMs: Long = 15_000,
    private val save: suspend (positionMs: Long, durationMs: Long) -> Unit,
) {
    private var ticker: Job? = null
    private var lastSavedPositionMs = -1L

    private val listener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            if (isPlaying) startTicker() else { ticker?.cancel(); report() }
        }
        override fun onPlaybackStateChanged(playbackState: Int) {
            if (playbackState == Player.STATE_ENDED) durationMs()?.let { submit(it, it) }
        }
    }

    fun start() = player.addListener(listener)

    /** Final save; call before releasing the player. */
    fun stop() {
        player.removeListener(listener)
        ticker?.cancel()
        if (player.playbackState != Player.STATE_ENDED) report()
    }

    private fun startTicker() {
        ticker?.cancel()
        ticker = tickerScope.launch {
            while (isActive) {
                delay(intervalMs)
                report()
            }
        }
    }

    private fun report() {
        val duration = durationMs() ?: return
        submit(player.currentPosition.coerceIn(0, duration), duration)
    }

    private fun submit(positionMs: Long, durationMs: Long) {
        if (abs(positionMs - lastSavedPositionMs) < 1_000) return
        lastSavedPositionMs = positionMs
        saveScope.launch { runCatching { save(positionMs, durationMs) } }
    }

    private fun durationMs(): Long? = player.duration.takeIf { it != C.TIME_UNSET && it > 0 } ?: fallbackDurationMs?.takeIf { it > 0 }
}
