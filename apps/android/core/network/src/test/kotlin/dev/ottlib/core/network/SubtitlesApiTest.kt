package dev.ottlib.core.network

import dev.ottlib.core.model.SubtitleSearch
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonObject

class SubtitlesApiTest {
    private val server = MockWebServer().apply { start() }
    private val api = OttlibApi(OkHttpClient()) { server.url("/") }
    @After fun close() = server.shutdown()
    @Test fun manualSearchSendsExplicitNullsToClearLibrarySeasonAndYearDefaults() = runTest {
        server.enqueue(MockResponse().setBody("""{"results":[],"warnings":[]}"""))
        val response = api.searchSubtitles(42, SubtitleSearch(mode = "manual", query = "Another title", languages = listOf("en", "hi")))
        assertEquals(emptyList<Any>(), response.results)
        val request = server.takeRequest()
        assertEquals("POST", request.method)
        assertEquals("/api/movies/42/subtitles/search", request.path)
        val body = OttlibJson.parseToJsonElement(request.body.readUtf8()).jsonObject
        assertEquals(JsonNull, body["year"])
        assertEquals(JsonNull, body["season"])
        assertEquals(JsonNull, body["episode"])
        assertNull(body["imdbId"])
    }
}
