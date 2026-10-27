@file:OptIn(UnstableApi::class)

package dev.ottlib.core.player

import androidx.annotation.OptIn
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.SeekParameters

/**
 * Live scrubbing on a Media3 player. An [ExoPlayer] uses its scrubbing mode (fast, overlapping seeks to nearby sync
 * frames); the seek parameters in use before the scrub are put back when it ends, so the release seek is exact.
 * Any other [Player] just seeks.
 */
class ExoScrubTarget(private val player: Player) : ScrubTarget {
    private var saved: SeekParameters? = null

    override fun fastSeeking(enabled: Boolean) {
        val exo = player as? ExoPlayer ?: return
        if (enabled) {
            saved = exo.seekParameters
            exo.isScrubbingModeEnabled = true
        } else {
            exo.isScrubbingModeEnabled = false
            exo.setSeekParameters(saved ?: SeekParameters.DEFAULT)
            saved = null
        }
    }

    override fun seekTo(positionMs: Long) = player.seekTo(positionMs)
}
