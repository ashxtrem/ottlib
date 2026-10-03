package dev.ottlib.core.presentation.metadata

import androidx.lifecycle.ViewModelStore
import dev.ottlib.core.model.MetadataCandidate
import dev.ottlib.core.model.Movie
import dev.ottlib.core.model.ScanStatus
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.network.OttlibJson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

@OptIn(ExperimentalCoroutinesApi::class)
class MetadataViewModelTest {
    private val movieBody = File(requireNotNull(System.getProperty("contract.fixtures")), "movie.json").readText()
    private val movie = OttlibJson.decodeFromString(Movie.serializer(), movieBody)
    private val candidate = MetadataCandidate("tmdb", "42", "Example Show", 2024, 0.9, "tv")

    @Test fun selectingAMatchIsAPreviewAndInvalidEpisodesNeverReachTheServer() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val server = MockWebServer().apply { start(); enqueue(MockResponse().setBody("[]")) }
        val store = ViewModelStore()
        try {
            val api = OttlibApi(OkHttpClient()) { server.url("/") }
            val refresh = MetadataRefresh(backgroundScope, { ScanStatus("idle") }, { ScanStatus("idle") }, {}, { "server" })
            val viewModel = MetadataViewModel(api, refresh, movie)
            store.put("metadata", viewModel)
            viewModel.state.first { !it.busy }
            assertEquals("/api/movies/1/candidates", server.takeRequest().path)
            viewModel.select(candidate)
            viewModel.season("0"); viewModel.episode("-2"); viewModel.accept()
            assertEquals(1, server.requestCount)
            assertTrue(viewModel.state.value.message!!.contains("positive"))
            assertEquals(0L, api.metadataRevision.value)

            server.enqueue(MockResponse().setBody(movieBody))
            viewModel.season("3"); viewModel.episode("7"); viewModel.accept()
            viewModel.state.first { !it.busy }
            val request = server.takeRequest()
            assertEquals("/api/movies/1/manual-candidates/accept", request.path)
            assertTrue(request.body.readUtf8().contains(""""season":3,"episode":7"""))
            assertEquals(1L, api.metadataRevision.value)
            assertEquals("Match updated for this title.", viewModel.state.value.message)
        } finally { store.clear(); server.shutdown(); Dispatchers.resetMain() }
    }

    @Test fun searchFailureRetainsExistingCandidatesAndReportsTheError() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val server = MockWebServer().apply {
            start()
            enqueue(MockResponse().setBody("""[{"id":7,"provider":"tmdb","providerId":"42","title":"Example Show","year":2024,"score":0.9,"mediaType":"tv"}]"""))
            enqueue(MockResponse().setResponseCode(503).setBody("""{"error":"Provider unavailable"}"""))
        }
        val store = ViewModelStore()
        try {
            val api = OttlibApi(OkHttpClient()) { server.url("/") }
            val refresh = MetadataRefresh(backgroundScope, { ScanStatus("idle") }, { ScanStatus("idle") }, {}, { "server" })
            val viewModel = MetadataViewModel(api, refresh, movie)
            store.put("metadata", viewModel)
            viewModel.state.first { !it.busy }
            viewModel.search()
            viewModel.state.first { !it.busy }
            assertEquals(1, viewModel.state.value.candidates.size)
            assertEquals("Provider unavailable", viewModel.state.value.message)
            assertEquals(0L, api.metadataRevision.value)
        } finally { store.clear(); server.shutdown(); Dispatchers.resetMain() }
    }

    @Test fun episodeDefaultsPreferSavedNumbersAndRecognizeFilenameFallbacks() {
        assertEquals("3" to "7", metadataEpisode(movie.copy(season = 3, episode = 7, rawFilename = "Wrong.S01E02.mkv")))
        assertEquals("2" to "5", metadataEpisode(movie.copy(rawFilename = "Example.S02E05.mkv")))
        assertEquals("1" to "12", metadataEpisode(movie.copy(rawFilename = "Example.1x12.mkv")))
        assertEquals("" to "", metadataEpisode(movie))
    }

    @Test fun refreshBlocksMatchWritesAndOnlyStartsTheOpenedTitle() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val server = MockWebServer().apply { start(); enqueue(MockResponse().setBody("[]")) }
        val store = ViewModelStore()
        val started = mutableListOf<Long>()
        try {
            val api = OttlibApi(OkHttpClient()) { server.url("/") }
            val refresh = MetadataRefresh(backgroundScope, { id -> started += id; ScanStatus("running", id = 7) }, { ScanStatus("idle") }, {}, { "server" })
            val viewModel = MetadataViewModel(api, refresh, movie)
            store.put("metadata", viewModel)
            viewModel.state.first { !it.busy }
            viewModel.refreshTitle(); runCurrent()
            viewModel.select(candidate); viewModel.season("1"); viewModel.episode("2"); viewModel.accept()
            assertEquals(listOf(1L), started)
            assertEquals(1, server.requestCount)
            assertFalse(viewModel.state.value.busy)
        } finally { store.clear(); server.shutdown(); Dispatchers.resetMain() }
    }
}
