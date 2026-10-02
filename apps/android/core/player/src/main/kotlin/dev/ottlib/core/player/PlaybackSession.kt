package dev.ottlib.core.player

import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer

/** Owns one title's listeners and decoder resources. Release on the player's application thread. */
class PlaybackSession(
    val player: ExoPlayer,
    private val listener: Player.Listener,
    private val progress: ProgressReporter,
    private val tracks: TrackMemory,
) {
    private var released = false

    init {
        player.addListener(listener)
        tracks.start()
        progress.start()
    }

    /** Synchronous: the next player must not start until the old decoder has been released. */
    fun release() {
        if (released) return
        released = true
        progress.stop()
        tracks.stop()
        player.removeListener(listener)
        player.release()
    }
}
