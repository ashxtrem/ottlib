package dev.ottlib.core.update

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException

/** A published release that contains this app's APK. */
data class AppRelease(
    val version: ReleaseVersion,
    val notes: String,
    val pageUrl: String,
    val apkName: String,
    val apkUrl: String,
    val checksumsUrl: String?,
)

@Serializable
internal data class GitHubRelease(
    @SerialName("tag_name") val tagName: String,
    @SerialName("html_url") val htmlUrl: String,
    val body: String? = null,
    val assets: List<GitHubAsset> = emptyList(),
)

@Serializable
internal data class GitHubAsset(val name: String, @SerialName("browser_download_url") val downloadUrl: String)

/**
 * Reads the latest published release from GitHub's public API (no token; 60 requests an hour per address).
 * GitHub's "latest" already skips drafts and prereleases.
 */
class GitHubReleases(
    private val client: OkHttpClient,
    private val repository: String = "ashxtrem/ottlib",
    private val apiBase: HttpUrl = "https://api.github.com/".toHttpUrl(),
) {
    private val json = Json { ignoreUnknownKeys = true }

    /** The latest release's APK whose file name starts with [apkPrefix] (`ottlib-tv-`), or null if it has none. */
    suspend fun latest(apkPrefix: String): AppRelease? = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url(apiBase.resolve("repos/$repository/releases/latest")!!)
            .header("Accept", "application/vnd.github+json")
            .build()
        val release = client.newCall(request).execute().use { response ->
            if (response.code == 404) return@withContext null
            if (!response.isSuccessful) throw IOException("GitHub returned HTTP ${response.code}")
            json.decodeFromString(GitHubRelease.serializer(), response.body!!.string())
        }
        val version = ReleaseVersion.fromTag(release.tagName) ?: return@withContext null
        val apk = release.assets.firstOrNull { it.name.startsWith(apkPrefix) && it.name.endsWith(".apk") } ?: return@withContext null
        AppRelease(
            version = version,
            notes = release.body.orEmpty(),
            pageUrl = release.htmlUrl,
            apkName = apk.name,
            apkUrl = apk.downloadUrl,
            checksumsUrl = release.assets.firstOrNull { it.name == "SHA256SUMS" }?.downloadUrl,
        )
    }
}
