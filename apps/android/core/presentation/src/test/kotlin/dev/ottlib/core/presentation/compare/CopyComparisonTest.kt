package dev.ottlib.core.presentation.compare

import dev.ottlib.core.model.MediaInfo
import dev.ottlib.core.model.MediaTrack
import dev.ottlib.core.model.Movie
import dev.ottlib.core.presentation.formatBytes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CopyComparisonTest {
    private fun track(type: String, language: String, codec: String) =
        MediaTrack(type, "embedded", 1, language, null, codec, null, null, isDefault = false, isForced = false, isHearingImpaired = false)

    private fun copy(id: Long, height: Int?, bitRate: Long?, hdr: String?, size: Long, tracks: List<MediaTrack> = emptyList()) = Movie(
        id = id, title = "Arrival", year = 2016, rawFilename = "Arrival.$id.mkv", filePath = "D:/media/Arrival.$id.mkv", titleOverride = null, overview = null,
        posterUrl = null, backdropUrl = null, genres = emptyList(), cast = emptyList(), rating = null, runtime = 116, imdbId = "tt2543164", metadataStatus = "matched",
        metadataSource = "tmdb", mediaType = "movie", season = null, episode = null, fileSizeBytes = size,
        mediaInfo = MediaInfo("MKV", 6_960_000, null, height, "HEVC", "Main 10", bitRate, hdr, tracks),
        watched = false, resumePositionMs = null, missing = false, addedAt = "2026-01-01T00:00:00.000Z", shelves = emptyList(),
    )

    @Test
    fun putsThisCopyFirstThenTheRestBestPictureFirst() {
        val comparison = compareCopies(copy(1, 720, 3_000_000, null, 1_000), listOf(copy(2, 1080, 8_000_000, null, 2_000), copy(3, 2160, 40_000_000, "HDR10", 9_000)))
        assertEquals(listOf(1L, 3L, 2L), comparison.columns.map { it.movieId })
        assertEquals(listOf("This copy", "Copy 2", "Copy 3"), comparison.columns.map { it.heading })
        assertTrue(comparison.columns.first().isCurrent)
    }

    @Test
    fun marksTheStrongerPictureButNotATie() {
        val comparison = compareCopies(copy(1, 1080, 8_000_000, null, 1_000), listOf(copy(2, 2160, 8_000_000, "HDR10", 9_000)))
        fun row(label: String) = comparison.rows.first { it.label == label }.cells
        assertEquals(listOf(false, true), row("Resolution").map { it.best })
        assertEquals(listOf(false, true), row("HDR").map { it.best })
        assertEquals(listOf(false, false), row("Bitrate").map { it.best })
        assertEquals(listOf("1080p", "4K"), row("Resolution").map { it.text })
        assertEquals(listOf("—", "HDR10"), row("HDR").map { it.text })
    }

    @Test
    fun listsAudioAndSubtitleTracksPerCopy() {
        val comparison = compareCopies(
            copy(1, 1080, null, null, 1, listOf(track("audio", "eng", "AC3"), track("subtitle", "eng", "SRT"))),
            listOf(copy(2, 1080, null, null, 1)),
        )
        assertEquals(listOf("English · AC3", "—"), comparison.rows.first { it.label == "Audio" }.cells.map { it.text })
        assertEquals(listOf("English · SRT", "—"), comparison.rows.first { it.label == "Subtitles" }.cells.map { it.text })
    }

    @Test
    fun aStandoutNeedsRealDifferenceAndAtLeastTwoKnownValues() {
        assertEquals(setOf(1), standouts(listOf(1L, 5L, 3L)))
        assertEquals(emptySet<Int>(), standouts(listOf(5L, 5L)))
        assertEquals(emptySet<Int>(), standouts(listOf(5L, null)))
        assertEquals(setOf(0), standouts(listOf(5L, 3L, null)))
        assertFalse(standouts(listOf(null, null)).isNotEmpty())
    }

    @Test
    fun formatsFileSizes() {
        assertEquals("512 B", formatBytes(512))
        assertEquals("820.2 MB", formatBytes(860_000_000))
        assertEquals("1.4 GB", formatBytes(1_503_238_554))
        assertEquals("—", formatBytes(-1))
    }
}
