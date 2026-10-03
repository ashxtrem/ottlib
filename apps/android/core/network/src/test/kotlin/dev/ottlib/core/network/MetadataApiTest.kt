package dev.ottlib.core.network

import dev.ottlib.core.model.MetadataCandidate
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.File

class MetadataApiTest {
    private val server = MockWebServer().apply { start() }
    private val api = OttlibApi(OkHttpClient()) { server.url("/") }
    private val fixtures = File(requireNotNull(System.getProperty("contract.fixtures")))
    private fun fixture(name: String) = File(fixtures, "$name.json").readText()
    @After fun close() = server.shutdown()

    @Test fun refreshAlwaysSendsOneExplicitIdAndDecodesItsStatus() = runTest {
        server.enqueue(MockResponse().setBody(fixture("metadata-refresh-completed")))
        server.enqueue(MockResponse().setBody(fixture("metadata-refresh-idle")))
        api.refreshMetadata(17)
        val request = server.takeRequest()
        assertEquals("POST", request.method)
        assertEquals("/api/movies/metadata-refresh", request.path)
        assertEquals("""{"movieIds":[17]}""", request.body.readUtf8())
        assertFalse(api.metadataRefreshStatus().isRunning)
        assertEquals("/api/movies/metadata-refresh/status", server.takeRequest().path)
    }

    @Test fun searchReturnsPreviewCandidatesWithoutChangingTheLibrary() = runTest {
        server.enqueue(MockResponse().setBody(fixture("metadata-search-results")))
        val found = api.searchMetadata(17, " Example Show ")
        assertNull(found.single().id)
        assertEquals("tv", found.single().mediaType)
        val request = server.takeRequest()
        assertEquals("/api/movies/17/rematch", request.path)
        assertEquals("""{"title":"Example Show"}""", request.body.readUtf8())
        assertEquals(0L, api.metadataRevision.value)
    }

    @Test fun acceptsManualEpisodeIdentityAndPublishesMetadataChanges() = runTest {
        server.enqueue(MockResponse().setBody(fixture("movie")))
        val candidate = MetadataCandidate("tmdb", "42", "Example Show", 2024, 0.9, "tv")
        api.acceptMetadata(17, candidate, season = 3, episode = 7)
        val request = server.takeRequest()
        assertEquals("/api/movies/17/manual-candidates/accept", request.path)
        assertEquals("""{"candidate":{"provider":"tmdb","providerId":"42","mediaType":"tv"},"season":3,"episode":7}""", request.body.readUtf8())
        assertEquals(1L, api.metadataRevision.value)
        assertEquals(1L, api.libraryRevision.value)
        assertNull(api.watchChange.value)
    }

    @Test fun acceptsASavedSuggestionAndOmitsEpisodeFieldsForMovies() = runTest {
        server.enqueue(MockResponse().setBody(fixture("movie")))
        api.acceptMetadata(17, MetadataCandidate("tmdb", "42", "Example", 2024, 0.9, "movie", id = 6), season = 3, episode = 7)
        val request = server.takeRequest()
        assertEquals("/api/movies/17/candidates/6/accept", request.path)
        assertEquals("{}", request.body.readUtf8())
    }

    @Test fun readsSavedCandidatesAndLooksUpImdbForTheSameTitle() = runTest {
        server.enqueue(MockResponse().setBody(fixture("metadata-candidates")))
        server.enqueue(MockResponse().setBody(fixture("movie")))
        assertEquals(7, api.metadataCandidates(17).single().episode)
        assertEquals("/api/movies/17/candidates", server.takeRequest().path)
        api.lookupMetadataImdb(17, " tt1234567 ")
        val request = server.takeRequest()
        assertEquals("/api/movies/17/candidates/from-imdb", request.path)
        assertEquals("""{"imdbId":"tt1234567"}""", request.body.readUtf8())
    }

    @Test fun failedAcceptanceDoesNotPublishChanges() = runTest {
        server.enqueue(MockResponse().setResponseCode(400).setBody("""{"error":"Provide an episode"}"""))
        val result = runCatching { api.acceptMetadata(17, MetadataCandidate("tmdb", "42", "Show", 2024, 0.9, "tv")) }
        assertEquals("Provide an episode", result.exceptionOrNull()?.message)
        assertEquals(0L, api.metadataRevision.value)
        assertEquals(0L, api.libraryRevision.value)
    }
}
