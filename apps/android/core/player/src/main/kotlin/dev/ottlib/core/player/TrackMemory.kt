package dev.ottlib.core.player

import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.TrackSelectionParameters
import androidx.media3.common.Tracks
import dev.ottlib.core.model.TrackChoice
import dev.ottlib.core.model.TrackIdentity

/**
 * Remembers the viewer's audio and subtitle choice for a title. When the tracks first load, [saved] is restored
 * (overriding the language defaults); after that, any change made through the player's menus is reported to
 * [onUserChoice]. Changes are detected via track-selection parameters, so it works for every menu that uses them.
 */
class TrackMemory(
    private val player: Player,
    private val saved: TrackChoice?,
    private val onUserChoice: (TrackChoice) -> Unit,
) : Player.Listener {
    private var restored = false
    private var ownParameters: TrackSelectionParameters? = null
    private var userChanged = false
    private var lastSubtitle: TrackIdentity? = null

    fun start() = player.addListener(this)

    fun stop() = player.removeListener(this)

    override fun onTracksChanged(tracks: Tracks) {
        if (tracks.groups.isEmpty()) return
        if (!restored) {
            restored = true
            restore(tracks)
            lastSubtitle = selected(tracks, C.TRACK_TYPE_TEXT)
            return
        }
        val subtitle = selected(tracks, C.TRACK_TYPE_TEXT)
        if (userChanged) {
            userChanged = false
            // "Off" is only recorded when the viewer turned a showing subtitle off (or kept it off after restoring
            // "off"); a title that simply has no subtitle selected stays on the defaults, so forced subtitles work.
            val turnedOff = subtitle == null && (lastSubtitle != null || saved?.subtitlesOff == true)
            onUserChoice(TrackChoice(audio = selected(tracks, C.TRACK_TYPE_AUDIO), subtitle = subtitle, subtitlesOff = turnedOff))
        }
        lastSubtitle = subtitle
    }

    override fun onTrackSelectionParametersChanged(parameters: TrackSelectionParameters) {
        if (parameters != ownParameters) userChanged = true
    }

    private fun restore(tracks: Tracks) {
        val choice = saved ?: return
        val parameters = player.trackSelectionParameters.buildUpon().apply {
            choice.audio?.let { override(tracks, C.TRACK_TYPE_AUDIO, it)?.let(::setOverrideForType) }
            if (choice.subtitlesOff) {
                setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
            } else {
                choice.subtitle?.let { saved -> override(tracks, C.TRACK_TYPE_TEXT, saved)?.let { setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false).setOverrideForType(it) } }
            }
        }.build()
        ownParameters = parameters
        player.trackSelectionParameters = parameters
    }

    private fun override(tracks: Tracks, type: Int, saved: TrackIdentity): TrackSelectionOverride? {
        val candidates = tracks.groups.filter { it.type == type }.flatMap { group -> (0 until group.length).filter(group::isTrackSupported).map { group to it } }
        val index = TrackMatcher.bestMatch(saved, candidates.map { (group, track) -> group.getTrackFormat(track).identity() }) ?: return null
        val (group, track) = candidates[index]
        return TrackSelectionOverride(group.mediaTrackGroup, track)
    }

    private fun selected(tracks: Tracks, type: Int): TrackIdentity? =
        tracks.groups.filter { it.type == type && it.isSelected }.firstNotNullOfOrNull { group ->
            (0 until group.length).firstOrNull(group::isTrackSelected)?.let { group.getTrackFormat(it).identity() }
        }
}

/** Codec from `codecs` when set (subtitles parsed during extraction report their original format there). */
internal fun Format.identity() = TrackIdentity(
    language = language,
    label = label,
    codec = codecs ?: sampleMimeType,
    channels = channelCount.takeIf { it != Format.NO_VALUE },
    external = label?.endsWith(EXTERNAL_SUBTITLE_SUFFIX) == true,
)
