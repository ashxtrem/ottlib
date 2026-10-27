package dev.ottlib.core.network

import dev.ottlib.core.model.AutoSkipDefaults
import dev.ottlib.core.model.Credits
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonObject
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CreditsApiTest {
    private val server = MockWebServer().apply { start() }
    private val api = OttlibApi(OkHttpClient()) { server.url("/") }
    @After fun close() = server.shutdown()

    private fun sentBody() = server.takeRequest().let { Triple(it.method, it.path, OttlibJson.parseToJsonElement(it.body.readUtf8()).jsonObject) }

    @Test fun marksTheCreditsAtAPosition() = runTest {
        server.enqueue(MockResponse().setBody("""{"credits":{"startMs":5400000,"source":"mark"}}"""))
        assertEquals(Credits(5_400_000, "mark"), api.setCreditsMark(42, 5_400_000))
        val (method, path, body) = sentBody()
        assertEquals("PUT", method)
        assertEquals("/api/movies/42/credits", path)
        assertEquals("5400000", body["startMs"].toString())
    }

    @Test fun clearingTheMarkSendsAnExplicitNull() = runTest {
        server.enqueue(MockResponse().setBody("""{"credits":null}"""))
        assertNull(api.setCreditsMark(42, null))
        assertEquals(JsonNull, sentBody().third["startMs"])
    }

    @Test fun setsAndClearsTheAutoSkipOverride() = runTest {
        server.enqueue(MockResponse().setBody("""{"autoSkipCredits":true}"""))
        assertTrue(api.setAutoSkip(42, true))
        val (method, path, body) = sentBody()
        assertEquals("PUT", method)
        assertEquals("/api/movies/42/auto-skip", path)
        assertEquals("true", body["enabled"].toString())

        server.enqueue(MockResponse().setBody("""{"autoSkipCredits":false}"""))
        assertFalse(api.setAutoSkip(42, null))
        assertEquals(JsonNull, sentBody().third["enabled"])
    }

    @Test fun readsAndWritesTheProfileDefaults() = runTest {
        server.enqueue(MockResponse().setBody("""{"movie":false,"tv":true}"""))
        assertEquals(AutoSkipDefaults(movie = false, tv = true), api.autoSkipDefaults())
        assertEquals("/api/profiles/current/auto-skip", server.takeRequest().path)

        server.enqueue(MockResponse().setBody("""{"movie":true,"tv":true}"""))
        assertEquals(AutoSkipDefaults(movie = true, tv = true), api.setAutoSkipDefaults(AutoSkipDefaults(movie = true, tv = true)))
        val (method, path, body) = sentBody()
        assertEquals("PUT", method)
        assertEquals("/api/profiles/current/auto-skip", path)
        assertEquals("true", body["movie"].toString())
    }
}
