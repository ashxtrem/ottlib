package dev.ottlib.core.network

import dev.ottlib.core.model.PlaybackProgressUpdate
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.fail
import org.junit.Test

class OttlibApiTest {
    private val server = MockWebServer().apply { start() }
    private val deviceId = "3f1c2a52-8a3b-4f0e-9a51-2d6f0f5d9c11"
    private val api = OttlibApi(OkHttpClient.Builder().addInterceptor(DeviceIdInterceptor { deviceId }).build()) { server.url("/") }

    @After fun tearDown() = server.shutdown()

    @Test
    fun sendsDeviceIdAndQueryParameters() = runTest {
        server.enqueue(MockResponse().setBody("""{"items":[],"nextCursor":null,"total":0}"""))
        api.movies(MovieQuery(search = " arrival ", watched = false, sort = MovieSort.Added, limit = 20))
        val request = server.takeRequest()
        assertEquals(deviceId, request.getHeader("x-device-id"))
        assertEquals("/api/movies?search=arrival&watched=false&availability=available&sort=added&limit=20", request.path)
    }

    @Test
    fun putsProgressAsJson() = runTest {
        server.enqueue(MockResponse().setBody("""{"resumePositionMs":1830000,"watched":false,"futureField":1}"""))
        val result = api.saveProgress(7, PlaybackProgressUpdate(1_830_000, 6_960_000))
        val request = server.takeRequest()
        assertEquals("PUT", request.method)
        assertEquals("/api/movies/7/progress", request.path)
        assertEquals("""{"positionMs":1830000,"durationMs":6960000}""", request.body.readUtf8())
        assertEquals(1_830_000L, result.resumePositionMs)
    }

    @Test
    fun surfacesServerErrorMessages() = runTest {
        server.enqueue(MockResponse().setResponseCode(404).setBody("""{"error":"Movie file is unavailable"}"""))
        try {
            api.playbackSource(1)
            fail("expected ApiException")
        } catch (error: ApiException) {
            assertEquals(404, error.statusCode)
            assertEquals("Movie file is unavailable", error.message)
        }
    }

    @Test
    fun resolvesServerRelativeUrls() {
        assertEquals(server.url("/media/posters/a.jpg").toString(), api.resolve("/media/posters/a.jpg"))
        assertNull(api.resolve(null))
    }

    @Test
    fun parsesTypedServerAddresses() {
        assertEquals("http://192.168.0.75:8081/", OttlibApi.parseServerAddress("192.168.0.75").toString())
        assertEquals("http://192.168.0.75:9000/", OttlibApi.parseServerAddress(" 192.168.0.75:9000/ ").toString())
        assertEquals("http://nas.local:8081/", OttlibApi.parseServerAddress("http://nas.local").toString())
        assertEquals(80, OttlibApi.parseServerAddress("http://nas.local:80")?.port)
        assertNull(OttlibApi.parseServerAddress("  "))
    }
}
