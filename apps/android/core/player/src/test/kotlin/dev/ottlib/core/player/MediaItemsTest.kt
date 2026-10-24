package dev.ottlib.core.player

import androidx.media3.common.MimeTypes
import dev.ottlib.core.model.PlaybackSource
import dev.ottlib.core.model.SubtitleSource
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [28])
class MediaItemsTest {
    private val resolve: (String) -> String = { "http://server$it" }
    private fun source(kind: String, url: String, subtitles: List<SubtitleSource> = emptyList()) =
        PlaybackSource(kind, url, "video/mp4", 1_000, null, subtitles)
    private fun subtitle(url: String) = SubtitleSource(url, "en", "SRT", null, isForced = false, isHearingImpaired = false)

    @Test
    fun hlsSourcesAreMarkedAsPlaylists() {
        val item = source("hls", "/api/hls/abc/index.m3u8").toMediaItem(1, "Film", resolve)
        assertEquals(MimeTypes.APPLICATION_M3U8, item.localConfiguration?.mimeType)
        assertEquals("http://server/api/hls/abc/index.m3u8", item.localConfiguration?.uri.toString())
    }

    @Test
    fun directSourcesLeaveTheContainerToBeSniffed() {
        assertNull(source("direct", "/api/stream/1").toMediaItem(1, "Film", resolve).localConfiguration?.mimeType)
    }

    @Test
    fun keepsSubtitlesTheNewItemDoesNotCarry() {
        val previous = source("direct", "/api/stream/1", listOf(subtitle("/a.srt"), subtitle("/found.srt"))).toMediaItem(1, "Film", resolve)
        val next = source("hls", "/p.m3u8", listOf(subtitle("/a.srt"))).toMediaItem(1, "Film", resolve).withSubtitlesFrom(previous)
        assertEquals(listOf("/a.srt", "/found.srt"), next.localConfiguration?.subtitleConfigurations?.map { it.id })
    }
}
