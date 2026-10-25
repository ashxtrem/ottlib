package dev.ottlib.core.network

import kotlinx.coroutines.test.runTest
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class ProfileSessionInterceptorTest {
    private val server = MockWebServer().apply { start() }
    private val other = MockWebServer().apply { start() }
    private val reported = mutableListOf<HttpUrl>()
    private val reportedTokens = mutableListOf<String?>()
    private val client = OkHttpClient.Builder()
        .addInterceptor(ProfileSessionInterceptor({ url -> if (url.port == server.port) "tok-1" else null }) { url, sent ->
            reported += url
            reportedTokens += sent
        })
        .build()

    @After fun tearDown() {
        server.shutdown()
        other.shutdown()
    }

    private fun get(target: MockWebServer) = client.newCall(Request.Builder().url(target.url("/api/x")).build()).execute()

    @Test
    fun sendsTheHeaderOnlyToTheOriginThatHasAToken() {
        server.enqueue(MockResponse().setBody("{}"))
        other.enqueue(MockResponse().setBody("{}"))
        get(server).close()
        get(other).close()
        assertEquals("tok-1", server.takeRequest().getHeader("x-profile-session"))
        assertNull(other.takeRequest().getHeader("x-profile-session"))
    }

    @Test
    fun reportsOnlyA409ProfileRequired() {
        server.enqueue(MockResponse().setResponseCode(409).setBody("""{"error":"PROFILE_REQUIRED","message":"Pick a profile"}"""))
        server.enqueue(MockResponse().setResponseCode(409).setBody("""{"error":"PROFILE_LIMIT","message":"Too many"}"""))
        server.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":"PROFILE_REQUIRED"}"""))
        server.enqueue(MockResponse().setResponseCode(409).setBody("not json"))
        server.enqueue(MockResponse().setBody("""{"error":"PROFILE_REQUIRED"}"""))
        repeat(5) { get(server).close() }
        assertEquals(1, reported.size)
        assertEquals(server.url("/api/x"), reported.single())
        assertEquals(listOf<String?>("tok-1"), reportedTokens)
    }

    @Test
    fun reportsNoTokenWhenTheRequestCarriedNone() {
        other.enqueue(MockResponse().setResponseCode(409).setBody("""{"error":"PROFILE_REQUIRED"}"""))
        get(other).close()
        assertEquals(listOf<String?>(null), reportedTokens)
    }

    @Test
    fun leavesTheBodyReadableAfterThePeek() = runTest {
        server.enqueue(MockResponse().setResponseCode(409).setBody("""{"error":"PROFILE_REQUIRED","message":"Pick a profile"}"""))
        val body = client.newCall(Request.Builder().url(server.url("/api/x")).build()).execute().use { it.body!!.string() }
        assertTrue(body.contains("Pick a profile"))
        assertEquals(1, reported.size)
    }

    @Test
    fun callerStillGetsTheApiExceptionWithTheCode() = runTest {
        server.enqueue(MockResponse().setResponseCode(409).setBody("""{"error":"PROFILE_REQUIRED","message":"Pick a profile"}"""))
        try {
            OttlibApi(client) { server.url("/") }.profileMe()
            fail("expected ApiException")
        } catch (e: ApiException) {
            assertEquals(409, e.statusCode)
            assertEquals("PROFILE_REQUIRED", e.errorCode)
            assertEquals("Pick a profile", e.message)
        }
        assertEquals(1, reported.size)
    }
}
