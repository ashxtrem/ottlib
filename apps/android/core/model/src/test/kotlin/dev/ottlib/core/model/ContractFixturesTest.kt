package dev.ottlib.core.model

import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Decodes every server response fixture (written by packages/server/src/routes/nativeClient.test.ts)
 * strictly: an unknown field or a missing non-null field fails here instead of silently on the TV.
 */
class ContractFixturesTest {
    private val strict = Json { ignoreUnknownKeys = false }
    private val fixtures = File(requireNotNull(System.getProperty("contract.fixtures")) { "contract.fixtures system property is not set" })

    private val serializers: Map<String, KSerializer<*>> = mapOf(
        "server-info" to ServerInfo.serializer(),
        "movie-list-page" to MovieListPage.serializer(),
        "movie" to Movie.serializer(),
        "movie-unmatched" to Movie.serializer(),
        "filter-options" to MovieFilterOptions.serializer(),
        "continue-watching" to ListSerializer(MovieListItem.serializer()),
        "queued-next" to ListSerializer(MovieListItem.serializer()),
        "next-episode" to Movie.serializer(),
        "completed-episode" to Movie.serializer(),
        "shelf-summaries" to ListSerializer(ShelfSummary.serializer()),
        "shelf-detail" to ShelfDetail.serializer(),
        "playback-source" to PlaybackSource.serializer(),
        "progress-result" to PlaybackProgressResult.serializer(),
        "scan-status-idle" to ScanStatus.serializer(),
        "scan-status-running" to ScanStatus.serializer(),
        "scan-status-completed" to ScanStatus.serializer(),
        "metadata-refresh-idle" to ScanStatus.serializer(),
        "metadata-refresh-completed" to ScanStatus.serializer(),
        "metadata-candidates" to ListSerializer(MetadataCandidate.serializer()),
        "metadata-search-results" to ListSerializer(MetadataCandidate.serializer()),
        "auth-status" to AuthStatus.serializer(),
        "pin-login-result" to PinLoginResult.serializer(),
        "subtitle-options" to SubtitleOptions.serializer(),
        "subtitle-search" to SubtitleSearchResponse.serializer(),
        "subtitle-download" to SubtitleDownloadResponse.serializer(),
    )

    @Test
    fun everyFixtureHasAMappedModel() {
        val names = fixtures.listFiles { file -> file.extension == "json" }.orEmpty().map { it.nameWithoutExtension }.toSet()
        assertTrue("No fixtures found in $fixtures", names.isNotEmpty())
        assertEquals("Fixtures without a Kotlin model (add them to the map above)", emptySet<String>(), names - serializers.keys)
    }

    @Test
    fun fixturesDecodeStrictly() {
        serializers.forEach { (name, serializer) ->
            val file = File(fixtures, "$name.json")
            runCatching { strict.decodeFromString(serializer, file.readText()) }
                .onFailure { throw AssertionError("$name.json no longer matches its Kotlin model: ${it.message}", it) }
        }
    }

    @Test
    fun scanStatusTellsRunningFromFinished() {
        fun status(name: String) = strict.decodeFromString(ScanStatus.serializer(), File(fixtures, "$name.json").readText())
        assertFalse(status("scan-status-idle").isRunning)
        assertTrue(status("scan-status-running").isRunning)
        assertEquals(120, status("scan-status-running").filesProcessed)
        assertFalse(status("scan-status-completed").isRunning)
        assertEquals(3, status("scan-status-completed").titlesAdded)
    }

    @Test
    fun playbackSourceCarriesResumeAndSubtitles() {
        val source = strict.decodeFromString(PlaybackSource.serializer(), File(fixtures, "playback-source.json").readText())
        assertEquals("direct", source.kind)
        assertTrue(source.subtitles.isNotEmpty())
        assertEquals(SUPPORTED_API_VERSION, strict.decodeFromString(ServerInfo.serializer(), File(fixtures, "server-info.json").readText()).apiVersion)
    }
}
