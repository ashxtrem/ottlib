package dev.ottlib.core.player

import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import dev.ottlib.core.model.SubtitleSource
import dev.ottlib.core.model.TrackChoice

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

    suspend fun useSubtitle(source: SubtitleSource, resolve: (String) -> String): TrackChoice {
        check(!released) { "Playback is no longer active" }
        tracks.beginReload()
        try { return attachSubtitle(player, source, resolve) }
        finally { if (!released) tracks.finishReload() }
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
