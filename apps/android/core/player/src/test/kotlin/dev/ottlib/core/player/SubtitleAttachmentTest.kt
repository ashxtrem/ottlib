package dev.ottlib.core.player

import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.Player
import androidx.media3.common.TrackGroup
import androidx.media3.common.TrackSelectionParameters
import androidx.media3.common.Tracks
import dev.ottlib.core.model.SubtitleSource
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.lang.reflect.Proxy

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [28])
class SubtitleAttachmentTest {
    private class FakePlayer(val loadTracks: Boolean = true) {
        val listeners = mutableListOf<Player.Listener>()
        var item = MediaItem.Builder().setUri("https://server/video.mkv").build()
        var parameters = TrackSelectionParameters.DEFAULT_WITHOUT_CONTEXT
        var position = 123_456L
        var playing = false
        var prepares = 0
        val audio = TrackGroup("audio", *listOf("en", "hi").map { language ->
            Format.Builder().setLanguage(language).setSampleMimeType(MimeTypes.AUDIO_AAC).build()
        }.toTypedArray())
        var tracks = Tracks(listOf(Tracks.Group(audio, false, intArrayOf(C.FORMAT_HANDLED, C.FORMAT_HANDLED), booleanArrayOf(false, true))))
        val player = Proxy.newProxyInstance(Player::class.java.classLoader, arrayOf(Player::class.java)) { _, method, args ->
            when (method.name) {
                "getCurrentMediaItem" -> item
                "getCurrentTracks" -> tracks
                "getCurrentPosition" -> position
                "getPlayWhenReady" -> playing
                "setPlayWhenReady" -> { playing = args!![0] as Boolean; null }
                "getTrackSelectionParameters" -> parameters
                "setTrackSelectionParameters" -> { parameters = args!![0] as TrackSelectionParameters; null }
                "addListener" -> { listeners += args!![0] as Player.Listener; null }
                "removeListener" -> { listeners -= args!![0] as Player.Listener; null }
                "setMediaItem" -> { item = args!![0] as MediaItem; position = args[1] as Long; null }
                "prepare" -> {
                    prepares++
                    if (loadTracks) {
                        val subtitles = item.localConfiguration!!.subtitleConfigurations.map { configuration ->
                            val format = Format.Builder().setId(configuration.id).setLanguage(configuration.language).setLabel(configuration.label).setSampleMimeType(configuration.mimeType).build()
                            Tracks.Group(TrackGroup(configuration.id.orEmpty(), format), false, intArrayOf(C.FORMAT_HANDLED), booleanArrayOf(false))
                        }
                        tracks = Tracks(listOf(Tracks.Group(audio, false, intArrayOf(C.FORMAT_HANDLED, C.FORMAT_HANDLED), booleanArrayOf(true, false))) + subtitles)
                        listeners.toList().forEach { it.onTracksChanged(tracks) }
                    }
                    null
                }
                else -> error("Unexpected call: ${method.name}")
            }
        } as Player
    }
    private val subtitle = SubtitleSource("/api/movies/1/subtitles/1000001", "en", "SRT", "English release", false, false)
    private val resolve = { path: String -> "https://server$path" }

    @Test fun restoresPositionPausedStateAndAudioWhileSelectingTheExactNewSubtitle() = runBlocking {
        val fake = FakePlayer()
        val choice = attachSubtitle(fake.player, subtitle, resolve)
        assertEquals(123_456L, fake.position)
        assertFalse(fake.playing)
        assertEquals("hi", choice.audio?.language)
        assertEquals(listOf(1), fake.parameters.overrides[fake.audio]?.trackIndices)
        assertEquals("English release (external file)", choice.subtitle?.label)
        assertFalse(fake.parameters.disabledTrackTypes.contains(C.TRACK_TYPE_TEXT))
        assertTrue(fake.listeners.isEmpty())
        attachSubtitle(fake.player, subtitle, resolve)
        assertEquals(1, fake.item.localConfiguration!!.subtitleConfigurations.size)
        assertEquals(1, fake.prepares)
    }
    @Test fun distinguishesSubtitlesWithIdenticalLabelsByStableId() = runBlocking {
        val fake = FakePlayer()
        val other = subtitle.copy(url = "/api/movies/1/subtitles/1000002")
        fake.item = fake.item.buildUpon().setSubtitleConfigurations(listOf(other.toConfiguration(resolve)!!)).build()
        attachSubtitle(fake.player, subtitle, resolve)
        val selected = fake.tracks.groups.single { group ->
            group.type == C.TRACK_TYPE_TEXT && fake.parameters.overrides.containsKey(group.mediaTrackGroup)
        }
        assertEquals(subtitle.url, selected.getTrackFormat(0).id)
        assertEquals(2, fake.item.localConfiguration!!.subtitleConfigurations.size)
    }
    @Test fun keepsPlayingAndRemovesTemporaryListenersWhenLoadingTimesOut() = runBlocking {
        val fake = FakePlayer(loadTracks = false).apply { playing = true }
        val failed = runCatching { attachSubtitle(fake.player, subtitle, resolve, timeoutMs = 10) }
        assertTrue(failed.isFailure)
        assertTrue(fake.playing)
        assertEquals(123_456L, fake.position)
        assertTrue(fake.listeners.isEmpty())
    }
}
