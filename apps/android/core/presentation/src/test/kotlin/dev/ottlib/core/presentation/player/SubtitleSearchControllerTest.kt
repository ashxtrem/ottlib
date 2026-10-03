package dev.ottlib.core.presentation.player

import dev.ottlib.core.model.Movie
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.network.OttlibJson
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Test
import java.io.File

class SubtitleSearchControllerTest {
    private val server = MockWebServer().apply { start() }
    private val api = OttlibApi(OkHttpClient()) { server.url("/") }
    @After fun close() = server.shutdown()
    private fun movie(): Movie = OttlibJson.decodeFromString(File("../../../../contract/fixtures/movie.json").readText())

    @Test fun usesDeviceSearchLanguagesAndHandlesDownloadFailureWithoutTouchingPlayback() = runTest {
        server.enqueue(MockResponse().setBody("""{"providers":[{"name":"OpenSubtitles","configured":true}],"languages":[{"code":"en","name":"English"}],"preferredLanguages":["en"]}"""))
        server.enqueue(MockResponse().setBody("""{"results":[{"id":"result","provider":"OpenSubtitles","language":"hi","releaseName":"Movie","format":"srt","hearingImpaired":false,"forced":false,"hashMatch":false,"downloads":1,"score":0.0,"downloaded":false}],"warnings":[]}"""))
        var savedLanguages = emptyList<String>(); var applied = false
        val controller = SubtitleSearchController(api, 1, this, { listOf("hi", "ta") }, { savedLanguages = it }, { applied = true })
        controller.open(movie())
        val ready = controller.uiState.first { it.searched }
        assertEquals("hi, ta", ready.languages)
        assertEquals(listOf("hi", "ta"), savedLanguages)
        assertEquals(2, server.requestCount)
        controller.edit { it.copy(mode = "manual", query = "") }
        controller.search()
        assertEquals("Enter a title to search.", controller.uiState.value.error)
        assertEquals(2, server.requestCount)
        server.enqueue(MockResponse().setResponseCode(429).setBody("""{"error":"Quota reached"}"""))
        controller.download(ready.results.single())
        val failed = controller.uiState.first { it.downloading == null }
        assertNotNull(failed.error)
        assertFalse(applied)
    }
}
