package dev.ottlib.core.update

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
import java.io.File
import java.io.IOException
import java.security.MessageDigest

class GitHubReleasesTest {
    private val server = MockWebServer().apply { start() }
    private val client = OkHttpClient()
    private val releases = GitHubReleases(client, apiBase = server.url("/"))

    @After fun tearDown() = server.shutdown()

    private fun release(tag: String = "v0.2.0") = """
        {"tag_name":"$tag","html_url":"https://github.com/ashxtrem/ottlib/releases/tag/$tag","body":"Notes","draft":false,
         "assets":[
           {"name":"ottlib-mobile-0.2.0.apk","browser_download_url":"${server.url("/mobile.apk")}"},
           {"name":"ottlib-tv-0.2.0.apk","browser_download_url":"${server.url("/tv.apk")}"},
           {"name":"SHA256SUMS","browser_download_url":"${server.url("/sums")}"}
         ]}
    """.trimIndent()

    @Test
    fun picksThisAppsApkFromTheLatestRelease() = runTest {
        server.enqueue(MockResponse().setBody(release()))
        val found = releases.latest("ottlib-tv-")!!
        assertEquals("/repos/ashxtrem/ottlib/releases/latest", server.takeRequest().path)
        assertEquals(ReleaseVersion("0.2.0", 200), found.version)
        assertEquals("ottlib-tv-0.2.0.apk", found.apkName)
        assertEquals(server.url("/tv.apk").toString(), found.apkUrl)
        assertEquals(server.url("/sums").toString(), found.checksumsUrl)
    }

    @Test
    fun returnsNullWhenThereIsNoReleaseOrNoMatchingApk() = runTest {
        server.enqueue(MockResponse().setResponseCode(404))
        assertNull(releases.latest("ottlib-tv-"))
        server.enqueue(MockResponse().setBody(release()))
        assertNull(releases.latest("ottlib-desktop-"))
    }

    @Test
    fun downloadsAndVerifiesTheApk() = runTest {
        val apk = "pretend apk bytes".toByteArray()
        val sha = MessageDigest.getInstance("SHA-256").digest(apk).joinToString("") { "%02x".format(it) }
        server.enqueue(MockResponse().setBody(release()))
        val found = releases.latest("ottlib-tv-")!!
        server.enqueue(MockResponse().setBody("$sha  ottlib-tv-0.2.0.apk\n"))
        server.enqueue(MockResponse().setBody(okio.Buffer().write(apk)))

        val target = File.createTempFile("ottlib", ".apk").apply { delete() }
        var lastProgress: Float? = null
        val saved = ApkDownloader(client).download(found, target) { lastProgress = it }
        assertTrue(saved.readBytes().contentEquals(apk))
        assertEquals(1f, lastProgress)
        saved.delete()
    }

    @Test
    fun deletesAnApkThatFailsItsChecksum() = runTest {
        server.enqueue(MockResponse().setBody(release()))
        val found = releases.latest("ottlib-tv-")!!
        server.enqueue(MockResponse().setBody("${"0".repeat(64)}  ottlib-tv-0.2.0.apk\n"))
        server.enqueue(MockResponse().setBody("tampered"))

        val target = File.createTempFile("ottlib", ".apk").apply { delete() }
        try {
            ApkDownloader(client).download(found, target) {}
            fail("expected a checksum failure")
        } catch (error: IOException) {
            assertTrue(error.message!!.contains("checksum"))
        }
        assertFalse(target.exists())
        assertFalse(File(target.path + ".part").exists())
    }
}
