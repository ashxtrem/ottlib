@file:OptIn(UnstableApi::class)

package dev.ottlib.mobile.ui.player

import androidx.annotation.OptIn
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ListItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalResources
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.ui.DefaultTrackNameProvider
import androidx.media3.ui.TrackNameProvider

private class TrackOption(val group: Tracks.Group, val index: Int, val label: String, val selected: Boolean)

/**
 * Audio and subtitle picker. Choices go through track-selection parameters, so TrackMemory remembers them for the
 * title exactly as it does for the TV player's menus.
 */
@Composable
fun BoxScope.TrackPanel(player: Player, onDismiss: () -> Unit) {
    val resources = LocalResources.current
    val names = remember(resources) { DefaultTrackNameProvider(resources) }
    val tracks by produceState(player.currentTracks, player) {
        val listener = object : Player.Listener {
            override fun onTracksChanged(tracks: Tracks) {
                value = tracks
            }
        }
        player.addListener(listener)
        awaitDispose { player.removeListener(listener) }
    }
    val audio = options(tracks, C.TRACK_TYPE_AUDIO, names)
    val subtitles = options(tracks, C.TRACK_TYPE_TEXT, names)

    PlayerPanel("Audio & subtitles", onDismiss) {
        item { PanelHeading("Audio") }
        if (audio.isEmpty()) item { ListItem(headlineContent = { Text("No playable audio track") }, colors = PanelRowColors) }
        items(audio) { option -> PanelOption(option.label, option.selected) { player.select(option) } }
        item { PanelHeading("Subtitles") }
        item { PanelOption("Off", subtitles.none { it.selected }) { player.turnSubtitlesOff() } }
        items(subtitles) { option -> PanelOption(option.label, option.selected) { player.select(option) } }
    }
}

private fun options(tracks: Tracks, type: Int, names: TrackNameProvider): List<TrackOption> =
    tracks.groups.filter { it.type == type }.flatMap { group ->
        (0 until group.length).filter(group::isTrackSupported).map { index ->
            TrackOption(group, index, names.getTrackName(group.getTrackFormat(index)), group.isTrackSelected(index))
        }
    }

private fun Player.select(option: TrackOption) {
    trackSelectionParameters = trackSelectionParameters.buildUpon()
        .setOverrideForType(TrackSelectionOverride(option.group.mediaTrackGroup, option.index))
        .setTrackTypeDisabled(option.group.type, false)
        .build()
}

private fun Player.turnSubtitlesOff() {
    trackSelectionParameters = trackSelectionParameters.buildUpon()
        .clearOverridesOfType(C.TRACK_TYPE_TEXT)
        .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
        .build()
}
