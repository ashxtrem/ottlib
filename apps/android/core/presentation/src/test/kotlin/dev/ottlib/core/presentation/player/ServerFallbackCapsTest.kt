package dev.ottlib.core.presentation.player

import dev.ottlib.core.model.PlaybackRequest
import dev.ottlib.core.model.PlaybackSource
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ServerFallbackCapsTest {
    @Test
    fun unsupportedAudioAsksForTheVideoAsItIsWithAac() {
        assertEquals(
            PlaybackRequest(video = listOf("h264", "hevc", "av1", "vp9"), audio = listOf("aac"), hdr = true, startMs = 61_000),
            serverFallbackRequest(PlaybackProblem.UnsupportedAudio("no DTS"), 61_000),
        )
    }

    @Test
    fun unsupportedVideoAndErrorsAskForH264AndAac() {
        val transcode = PlaybackRequest(video = listOf("h264"), audio = listOf("aac"), hdr = false, maxHeight = 1080, startMs = 5_000)
        assertEquals(transcode, serverFallbackRequest(PlaybackProblem.UnsupportedVideo("no AV1"), 5_000))
        assertEquals(transcode, serverFallbackRequest(PlaybackProblem.Error("failed"), 5_000))
    }

    @Test
    fun aServerRefusalOffersNoSecondTry() {
        assertNull(serverFallbackRequest(PlaybackProblem.ServerUnavailable("busy", PlaybackProblem.Error("failed")), 0))
    }

    @Test
    fun refusesAnAnswerWithoutAConvertedStream() {
        fun source(kind: String, reasons: List<String>) = PlaybackSource(kind, "/x", "video/mp4", null, null, emptyList(), reasons = reasons)
        assertEquals("The server can't convert this file because ffmpeg isn't installed on it.", serverFallbackRefusal(source("direct", listOf("audio-codec", "ffmpeg-missing"))))
        assertEquals("The server offered no converted stream for this file.", serverFallbackRefusal(source("direct", emptyList())))
        assertNull(serverFallbackRefusal(source("hls", listOf("audio-codec"))))
    }
}
