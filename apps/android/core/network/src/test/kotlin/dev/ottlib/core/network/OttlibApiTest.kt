package dev.ottlib.core.network

import dev.ottlib.core.model.PlaybackProgressUpdate
import dev.ottlib.core.model.PlaybackRequest
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
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
    fun successfulCompletionProgressNotifiesCachedScreensAndSendsCollectionContext() = runTest {
        server.enqueue(MockResponse().setBody("""{"resumePositionMs":null,"watched":true}"""))
        api.saveProgress(7, PlaybackProgressUpdate(6_960_000, 6_960_000, shelfId = 3))
        assertEquals(WatchChange(7, true), api.watchChange.value)
        assertEquals(1L, api.libraryRevision.value)
        assertEquals("""{"positionMs":6960000,"durationMs":6960000,"shelfId":3}""", server.takeRequest().body.readUtf8())
    }

    @Test
    fun failedProgressDoesNotPublishWatchedChanges() = runTest {
        server.enqueue(MockResponse().setResponseCode(500).setBody("""{"error":"Unavailable"}"""))
        runCatching { api.saveProgress(7, PlaybackProgressUpdate(1_000_000, 1_000_000)) }
        assertNull(api.watchChange.value)
        assertEquals(0L, api.libraryRevision.value)
    }

    @Test
    fun startsAScanWithAnEmptyPostAndFollowsItsStatus() = runTest {
        server.enqueue(MockResponse().setBody("""{"id":7,"kind":"scan","status":"running","startedAt":"a","finishedAt":null,"filesFound":10,"filesProcessed":2,"titlesAdded":0,"errorSummary":null}"""))
        server.enqueue(MockResponse().setBody("""{"id":7,"kind":"scan","status":"completed","startedAt":"a","finishedAt":"b","filesFound":10,"filesProcessed":10,"titlesAdded":2,"errorSummary":null}"""))
        val started = api.startScan()
        val request = server.takeRequest()
        assertEquals("POST", request.method)
        assertEquals("/api/scan", request.path)
        assertEquals(0L, request.bodySize)
        assertNull("an empty body must not claim to be JSON", request.getHeader("Content-Type"))
        assertTrue(started.isRunning)

        val finished = api.scanStatus()
        assertEquals("/api/scan/status", server.takeRequest().path)
        assertFalse(finished.isRunning)
        assertEquals(2, finished.titlesAdded)
    }

    @Test
    fun readsTheIdleStatusOfAServerThatNeverScanned() = runTest {
        server.enqueue(MockResponse().setBody("""{"status":"idle"}"""))
        val status = api.scanStatus()
        assertFalse(status.isRunning)
        assertEquals("idle", status.status)
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
    fun playbackSourceWithCapabilitiesBuildsTheQuery() = runTest {
        server.enqueue(MockResponse().setBody("""{"kind":"hls","streamUrl":"/api/hls/s1/index.m3u8","mimeType":"application/vnd.apple.mpegurl","durationMs":6000000,"resumePositionMs":null,"subtitles":[],"mode":"transcode","reasons":["video-codec"],"sessionUrl":"/api/hls/s1"}"""))
        val source = api.playbackSource(7, PlaybackRequest(video = listOf("h264"), audio = listOf("aac"), hdr = false, maxHeight = 1080, audioOrder = 2, startMs = 61_000))
        val request = server.takeRequest()
        assertEquals("/api/movies/7/playback?video=h264&audio=aac&hdr=false&maxHeight=1080&audioOrder=2&startMs=61000", request.path)
        assertEquals(deviceId, request.getHeader("x-device-id"))
        assertEquals("hls", source.kind)
        assertEquals("/api/hls/s1", source.sessionUrl)

        server.enqueue(MockResponse().setBody("""{"kind":"direct","streamUrl":"/api/stream/7","mimeType":"video/mp4","durationMs":null,"resumePositionMs":null,"subtitles":[]}"""))
        api.playbackSource(7, PlaybackRequest(containers = listOf("mp4", "webm"), video = listOf("h264", "hevc")))
        assertEquals("/api/movies/7/playback?containers=mp4%2Cwebm&video=h264%2Chevc", server.takeRequest().path)
        server.enqueue(MockResponse().setBody("""{"kind":"direct","streamUrl":"/api/stream/7","mimeType":"video/mp4","durationMs":null,"resumePositionMs":null,"subtitles":[]}"""))
        api.playbackSource(7)
        assertEquals("/api/movies/7/playback", server.takeRequest().path)
    }

    @Test
    fun stopsATranscodeSessionWithADelete() = runTest {
        server.enqueue(MockResponse().setResponseCode(204))
        api.stopSession("/api/hls/s1")
        val request = server.takeRequest()
        assertEquals("DELETE", request.method)
        assertEquals("/api/hls/s1", request.path)
    }

    @Test
    fun showsTheMessageOfACodedError() = runTest {
        server.enqueue(MockResponse().setResponseCode(503).setBody("""{"error":"TRANSCODE_BUSY","message":"All transcode sessions are busy"}"""))
        try {
            api.playbackSource(1, PlaybackRequest(video = listOf("h264")))
            fail("expected ApiException")
        } catch (error: ApiException) {
            assertEquals(503, error.statusCode)
            assertEquals("All transcode sessions are busy", error.message)
        }
    }

    @Test
    fun signsInWithThePinAndSendsTheTokenAfterwards() = runTest {
        var token: String? = null
        val signedIn = OttlibApi(OkHttpClient.Builder().addInterceptor(AuthTokenInterceptor { token }).build()) { server.url("/") }
        server.enqueue(MockResponse().setBody("""{"token":"abc123"}"""))
        server.enqueue(MockResponse().setBody("""{"pinEnabled":true,"authenticated":true}"""))

        token = signedIn.login(server.url("/"), "2468")
        val login = server.takeRequest()
        assertEquals("/api/auth/login", login.path)
        assertEquals("""{"pin":"2468"}""", login.body.readUtf8())
        assertNull(login.getHeader("Authorization"))

        assertTrue(signedIn.authStatus(server.url("/")).authenticated)
        assertEquals("Bearer abc123", server.takeRequest().getHeader("Authorization"))
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
