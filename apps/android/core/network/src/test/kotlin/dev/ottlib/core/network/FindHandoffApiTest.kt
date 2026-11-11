package dev.ottlib.core.network

import dev.ottlib.core.model.FindHandoffRequest
import dev.ottlib.core.model.FindHandoffResult
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Test

class FindHandoffApiTest {
    private val server = MockWebServer().apply { start() }
    private val api = OttlibApi(OkHttpClient()) { server.url("/") }
    @After fun close() = server.shutdown()

    @Test
    fun postsTheSearchFieldsAsJson() = runTest {
        server.enqueue(MockResponse().setBody("""{"app":"hashlark"}"""))
        assertEquals(FindHandoffResult("hashlark"), api.findHandoff(FindHandoffRequest(title = "Arrival", year = 2016, imdbId = "tt2543164")))
        val request = server.takeRequest()
        assertEquals("POST", request.method)
        assertEquals("/api/find/handoff", request.path)
        assertEquals("""{"title":"Arrival","year":2016,"imdbId":"tt2543164"}""", request.body.readUtf8())
    }

    @Test
    fun leavesOutFieldsThatAreNotSetInsteadOfSendingNull() = runTest {
        server.enqueue(MockResponse().setBody("""{"app":"hashlark"}"""))
        api.findHandoff(FindHandoffRequest(title = "Heat"))
        assertEquals("""{"title":"Heat"}""", server.takeRequest().body.readUtf8())
    }

    @Test
    fun aMissingHashlarkLinkCarriesItsErrorCode() = runTest {
        server.enqueue(MockResponse().setResponseCode(409).setBody("""{"error":"HASHLARK_NOT_FOUND","message":"Hashlark is not installed on the server PC."}"""))
        try {
            api.findHandoff(FindHandoffRequest(title = "Heat"))
            fail("expected ApiException")
        } catch (e: ApiException) {
            assertEquals(409, e.statusCode)
            assertEquals("HASHLARK_NOT_FOUND", e.errorCode)
        }
    }
}
