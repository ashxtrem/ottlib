package dev.ottlib.core.update

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import java.security.MessageDigest

/** Downloads a release APK and checks it against the release's SHA256SUMS before anything installs it. */
class ApkDownloader(private val client: OkHttpClient) {

    /** Saves the APK to [target], reporting progress (0–1, or null while the size is unknown). */
    suspend fun download(release: AppRelease, target: File, onProgress: (Float?) -> Unit): File = withContext(Dispatchers.IO) {
        val checksumsUrl = release.checksumsUrl ?: throw IOException("This release has no SHA256SUMS file, so the download can't be verified.")
        val expected = Checksums.parse(fetchText(checksumsUrl))[release.apkName]
            ?: throw IOException("SHA256SUMS doesn't list ${release.apkName}.")

        target.parentFile?.mkdirs()
        val partial = File(target.path + ".part")
        val digest = MessageDigest.getInstance("SHA-256")
        client.newCall(Request.Builder().url(release.apkUrl).build()).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Download failed (HTTP ${response.code}).")
            val body = response.body!!
            val total = body.contentLength().takeIf { it > 0 }
            var read = 0L
            body.byteStream().use { input ->
                partial.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        ensureActive()
                        val count = input.read(buffer)
                        if (count < 0) break
                        output.write(buffer, 0, count)
                        digest.update(buffer, 0, count)
                        read += count
                        onProgress(total?.let { read.toFloat() / it })
                    }
                }
            }
        }
        val actual = digest.digest().joinToString("") { "%02x".format(it) }
        if (!actual.equals(expected, ignoreCase = true)) {
            partial.delete()
            throw IOException("The downloaded APK failed its checksum check and was deleted.")
        }
        target.delete()
        if (!partial.renameTo(target)) throw IOException("Couldn't save the downloaded APK.")
        target
    }

    private fun fetchText(url: String): String = client.newCall(Request.Builder().url(url).build()).execute().use { response ->
        if (!response.isSuccessful) throw IOException("Couldn't download SHA256SUMS (HTTP ${response.code}).")
        response.body!!.string()
    }
}

/** Parses `sha256sum` output: `<hex digest>  <file name>` per line (`*name` in binary mode). */
object Checksums {
    fun parse(text: String): Map<String, String> = text.lineSequence()
        .mapNotNull { line -> Regex("^([0-9a-fA-F]{64})\\s+\\*?(.+)$").matchEntire(line.trim()) }
        .associate { it.groupValues[2].trim() to it.groupValues[1].lowercase() }
}
