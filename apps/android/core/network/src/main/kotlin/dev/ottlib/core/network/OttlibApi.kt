package dev.ottlib.core.network

import dev.ottlib.core.model.Movie
import dev.ottlib.core.model.MovieFilterOptions
import dev.ottlib.core.model.MovieListItem
import dev.ottlib.core.model.MovieListPage
import dev.ottlib.core.model.PlaybackProgressResult
import dev.ottlib.core.model.PlaybackProgressUpdate
import dev.ottlib.core.model.PlaybackSource
import dev.ottlib.core.model.ServerInfo
import dev.ottlib.core.model.ShelfDetail
import dev.ottlib.core.model.ShelfSummary
import dev.ottlib.core.model.WatchStateUpdate
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Typed client for the Ottlib server endpoints the TV app uses. [baseUrl] is read per call so the
 * active server can change (Settings → Change server) without rebuilding the client.
 */
class OttlibApi(private val client: OkHttpClient, private val baseUrl: () -> HttpUrl?) {
    private val jsonType = "application/json".toMediaType()

    /** Probes an arbitrary server (used before a server is saved as active). */
    suspend fun serverInfo(server: HttpUrl): ServerInfo = get(server.resolve("/api/server-info")!!)

    suspend fun movies(query: MovieQuery): MovieListPage = get(query.applyTo(url("/api/movies").newBuilder()).build())
    suspend fun continueWatching(limit: Int = 20): List<MovieListItem> =
        get(url("/api/movies/continue-watching").newBuilder().addQueryParameter("limit", limit.toString()).build())
    suspend fun movie(id: Long): Movie = get(url("/api/movies/$id"))
    suspend fun filterOptions(): MovieFilterOptions = get(url("/api/movies/filter-options"))
    suspend fun shelves(): List<ShelfSummary> = get(url("/api/shelves"))
    suspend fun shelf(id: Long): ShelfDetail = get(url("/api/shelves/$id"))
    suspend fun playbackSource(id: Long): PlaybackSource = get(url("/api/movies/$id/playback"))

    suspend fun setWatched(id: Long, watched: Boolean): Movie =
        send("PUT", url("/api/movies/$id/watch-state"), OttlibJson.encodeToString(WatchStateUpdate.serializer(), WatchStateUpdate(watched)))
    suspend fun saveProgress(id: Long, update: PlaybackProgressUpdate): PlaybackProgressResult =
        send("PUT", url("/api/movies/$id/progress"), OttlibJson.encodeToString(PlaybackProgressUpdate.serializer(), update))
    suspend fun clearProgress(id: Long) {
        client.newCall(Request.Builder().url(url("/api/movies/$id/progress")).delete().build()).awaitBody()
    }

    /** Turns a server-relative path (`/media/posters/x.jpg`, `/api/stream/1`) into an absolute URL on the active server. */
    fun resolve(path: String?): String? = path?.let { baseUrl()?.resolve(it)?.toString() }

    private fun url(path: String): HttpUrl = (baseUrl() ?: throw IllegalStateException("No Ottlib server selected")).resolve(path)!!

    private suspend inline fun <reified T> get(url: HttpUrl): T =
        OttlibJson.decodeFromString(client.newCall(Request.Builder().url(url).get().build()).awaitBody())

    private suspend inline fun <reified T> send(method: String, url: HttpUrl, json: String): T =
        OttlibJson.decodeFromString(client.newCall(Request.Builder().url(url).method(method, json.toRequestBody(jsonType)).build()).awaitBody())

    companion object {
        const val DEFAULT_PORT = 8081
        private val explicitPort = Regex("^[a-zA-Z][a-zA-Z0-9+.-]*://[^/]+:\\d+")

        /** Accepts `192.168.1.10`, `192.168.1.10:8081`, or a full URL; defaults to http and the server's default port. */
        fun parseServerAddress(input: String): HttpUrl? {
            val trimmed = input.trim().trimEnd('/')
            if (trimmed.isEmpty()) return null
            val withScheme = if ("://" in trimmed) trimmed else "http://$trimmed"
            val parsed = withScheme.toHttpUrlOrNull() ?: return null
            val port = if (explicitPort.containsMatchIn(withScheme)) parsed.port else DEFAULT_PORT
            return parsed.newBuilder().port(port).encodedPath("/").query(null).fragment(null).build()
        }
    }
}
