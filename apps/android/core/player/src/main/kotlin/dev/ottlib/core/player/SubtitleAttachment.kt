package dev.ottlib.core.player

import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import dev.ottlib.core.model.SubtitleSource
import dev.ottlib.core.model.TrackChoice
import dev.ottlib.core.model.TrackIdentity
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

/** Reloads on the existing player, then selects the exact new track and restores the chosen audio. */
suspend fun attachSubtitle(player: Player, source: SubtitleSource, resolve: (String) -> String, timeoutMs: Long = 20_000): TrackChoice {
    val item = player.currentMediaItem ?: error("Playback is no longer active")
    val configuration = source.toConfiguration(resolve) ?: error("Unsupported subtitle format")
    val audio = player.currentTracks.groups.filter { it.type == C.TRACK_TYPE_AUDIO }.firstNotNullOfOrNull { group ->
        (0 until group.length).firstOrNull(group::isTrackSelected)?.let { group.getTrackFormat(it).identity() }
    }
    val position = player.currentPosition
    val playing = player.playWhenReady
    val parameters = player.trackSelectionParameters
    val configurations = item.localConfiguration?.subtitleConfigurations.orEmpty().filter { it.id != configuration.id } + configuration
    val choice = TrackChoice(audio = audio, subtitle = TrackIdentity(
        language = configuration.language, label = configuration.label, codec = configuration.mimeType, external = true,
    ))
    fun select(tracks: Tracks, beforeSelection: () -> Unit = {}): Boolean {
        val subtitleGroup = tracks.groups.firstOrNull { group ->
            group.type == C.TRACK_TYPE_TEXT && (0 until group.length).any {
                group.isTrackSupported(it) && group.getTrackFormat(it).id == configuration.id
            }
        } ?: return false
        val subtitleIndex = (0 until subtitleGroup.length).first {
            subtitleGroup.isTrackSupported(it) && subtitleGroup.getTrackFormat(it).id == configuration.id
        }
        val selection = parameters.buildUpon().clearOverridesOfType(C.TRACK_TYPE_TEXT).clearOverridesOfType(C.TRACK_TYPE_AUDIO)
            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
            .setOverrideForType(TrackSelectionOverride(subtitleGroup.mediaTrackGroup, subtitleIndex))
        val audioTracks = tracks.groups.filter { it.type == C.TRACK_TYPE_AUDIO }.flatMap { group ->
            (0 until group.length).filter(group::isTrackSupported).map { group to it }
        }
        if (audio != null) TrackMatcher.bestMatch(audio, audioTracks.map { (group, index) -> group.getTrackFormat(index).identity() })?.let { index ->
            val (group, track) = audioTracks[index]
            selection.setOverrideForType(TrackSelectionOverride(group.mediaTrackGroup, track))
        }
        beforeSelection()
        player.trackSelectionParameters = selection.build()
        return true
    }
    if (select(player.currentTracks)) return choice
    return withTimeoutOrNull(timeoutMs) {
        suspendCancellableCoroutine { continuation ->
            val listener = object : Player.Listener {
                override fun onTracksChanged(tracks: Tracks) {
                    if (!continuation.isActive || !select(tracks) { player.removeListener(this) }) return
                    if (continuation.isActive) continuation.resume(choice)
                }
            }
            player.addListener(listener)
            continuation.invokeOnCancellation { player.removeListener(listener) }
            try {
                player.trackSelectionParameters = parameters.buildUpon().clearOverridesOfType(C.TRACK_TYPE_TEXT).clearOverridesOfType(C.TRACK_TYPE_AUDIO).build()
                player.setMediaItem(item.buildUpon().setSubtitleConfigurations(configurations).build(), position)
                player.prepare()
                player.playWhenReady = playing
            } catch (error: Exception) { player.removeListener(listener); continuation.cancel(error) }
        }
    } ?: error("The player could not load the subtitle. Try selecting the saved track from the subtitle menu.")
}
