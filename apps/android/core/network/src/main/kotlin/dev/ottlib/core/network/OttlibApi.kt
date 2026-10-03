package dev.ottlib.core.network

import dev.ottlib.core.model.AuthStatus
import dev.ottlib.core.model.AcceptMetadataRequest
import dev.ottlib.core.model.EpisodeSelection
import dev.ottlib.core.model.ImdbLookupRequest
import dev.ottlib.core.model.MetadataCandidate
import dev.ottlib.core.model.MetadataRefreshRequest
import dev.ottlib.core.model.MetadataSearchRequest
import dev.ottlib.core.model.MetadataSelection
import dev.ottlib.core.model.Movie
import dev.ottlib.core.model.MovieFilterOptions
import dev.ottlib.core.model.MovieListItem
import dev.ottlib.core.model.MovieListPage
import dev.ottlib.core.model.PinLoginRequest
import dev.ottlib.core.model.PinLoginResult
import dev.ottlib.core.model.PlaybackProgressResult
import dev.ottlib.core.model.PlaybackProgressUpdate
import dev.ottlib.core.model.PlaybackSource
import dev.ottlib.core.model.ScanStatus
import dev.ottlib.core.model.ServerInfo
import dev.ottlib.core.model.ShelfDetail
import dev.ottlib.core.model.ShelfSummary
import dev.ottlib.core.model.WatchStateUpdate
import okhttp3.HttpUrl
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
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
    private val changes = MutableStateFlow(0L)
    val libraryRevision = changes.asStateFlow()
    private val metadataChanges = MutableStateFlow(0L)
    val metadataRevision = metadataChanges.asStateFlow()
    fun metadataUpdated() { metadataChanges.update { it + 1 }; changed() }
    private val watchChanges = MutableStateFlow<WatchChange?>(null)
    val watchChange = watchChanges.asStateFlow()
    private fun watched(id: Long, watched: Boolean) { watchChanges.value = WatchChange(id, watched); changed() }
    private fun changed() { changes.update { it + 1 } }
    private val jsonType = "application/json".toMediaType()

    /** Probes an arbitrary server (used before a server is saved as active). */
    suspend fun serverInfo(server: HttpUrl): ServerInfo = get(server.resolve("/api/server-info")!!)

    /** Whether this device's saved session (if any) is still accepted by [server]. */
    suspend fun authStatus(server: HttpUrl): AuthStatus = get(server.resolve("/api/auth/status")!!)

    /** Signs in to [server] with its access PIN and returns the session token. Wrong PINs throw [ApiException] (401, or 429 when locked out). */
    suspend fun login(server: HttpUrl, pin: String): String =
        send<PinLoginResult>("POST", server.resolve("/api/auth/login")!!, OttlibJson.encodeToString(PinLoginRequest.serializer(), PinLoginRequest(pin))).token

    suspend fun movies(query: MovieQuery): MovieListPage = get(query.applyTo(url("/api/movies").newBuilder()).build())
    suspend fun continueWatching(limit: Int = 20): List<MovieListItem> =
        get(url("/api/movies/continue-watching").newBuilder().addQueryParameter("limit", limit.toString()).build())
    suspend fun movie(id: Long): Movie = get(url("/api/movies/$id"))
    suspend fun filterOptions(): MovieFilterOptions = get(url("/api/movies/filter-options"))
    suspend fun shelves(): List<ShelfSummary> = get(url("/api/shelves"))
    suspend fun shelf(id: Long): ShelfDetail = get(url("/api/shelves/$id"))
    suspend fun playbackSource(id: Long): PlaybackSource = get(url("/api/movies/$id/playback"))
    suspend fun nextMovie(id: Long, shelfId: Long? = null): Movie? = get(sequenceUrl(id, "next", shelfId))
    suspend fun complete(id: Long, shelfId: Long? = null): Movie = post<Movie>(sequenceUrl(id, "complete", shelfId)).also { watched(id, true) }
    private fun sequenceUrl(id: Long, action: String, shelfId: Long?): HttpUrl =
        url("/api/movies/$id/$action").newBuilder().apply { shelfId?.let { addQueryParameter("shelfId", it.toString()) } }.build()

    suspend fun setWatched(id: Long, watched: Boolean): Movie =
        send<Movie>("PUT", url("/api/movies/$id/watch-state"), OttlibJson.encodeToString(WatchStateUpdate.serializer(), WatchStateUpdate(watched))).also { watched(id, it.watched) }
    suspend fun saveProgress(id: Long, update: PlaybackProgressUpdate): PlaybackProgressResult =
        send<PlaybackProgressResult>("PUT", url("/api/movies/$id/progress"), OttlibJson.encodeToString(PlaybackProgressUpdate.serializer(), update)).also { if (it.watched) watched(id, true) }
    suspend fun clearProgress(id: Long) {
        client.newCall(Request.Builder().url(url("/api/movies/$id/progress")).delete().build()).awaitBody()
        changed()
    }

    /**
     * Starts a library scan on the server — finds new files and notices removed ones, the same as the web app's Scan
     * button — or returns the scan already running. Refreshing metadata for existing titles is a separate server action
     * and is not started here.
     */
    suspend fun startScan(): ScanStatus = post(url("/api/scan"))
    suspend fun scanStatus(): ScanStatus = get(url("/api/scan/status"))

    /** Always sends exactly one title ID; this client exposes no bulk metadata operation. */
    suspend fun refreshMetadata(id: Long): ScanStatus =
        send("POST", url("/api/movies/metadata-refresh"), OttlibJson.encodeToString(MetadataRefreshRequest.serializer(), MetadataRefreshRequest(listOf(id))))
    suspend fun metadataRefreshStatus(): ScanStatus = get(url("/api/movies/metadata-refresh/status"))
    suspend fun metadataCandidates(id: Long): List<MetadataCandidate> = get(url("/api/movies/$id/candidates"))
    suspend fun searchMetadata(id: Long, title: String): List<MetadataCandidate> =
        send("POST", url("/api/movies/$id/rematch"), OttlibJson.encodeToString(MetadataSearchRequest.serializer(), MetadataSearchRequest(title.trim())))
    suspend fun lookupMetadataImdb(id: Long, imdbId: String): Movie =
        send<Movie>("POST", url("/api/movies/$id/candidates/from-imdb"), OttlibJson.encodeToString(ImdbLookupRequest.serializer(), ImdbLookupRequest(imdbId.trim()))).also { metadataUpdated() }

    suspend fun acceptMetadata(id: Long, candidate: MetadataCandidate, season: Int? = null, episode: Int? = null): Movie {
        val selection = if (candidate.mediaType == "tv") EpisodeSelection(season, episode) else EpisodeSelection()
        return if (candidate.id != null) {
            send<Movie>("POST", url("/api/movies/$id/candidates/${candidate.id}/accept"), OttlibJson.encodeToString(EpisodeSelection.serializer(), selection))
        } else {
            val identity = MetadataSelection(candidate.provider, candidate.providerId, candidate.mediaType, candidate.season, candidate.episode)
            send<Movie>("POST", url("/api/movies/$id/manual-candidates/accept"), OttlibJson.encodeToString(AcceptMetadataRequest.serializer(), AcceptMetadataRequest(identity, selection.season, selection.episode)))
        }.also { metadataUpdated() }
    }
    suspend fun rejectMetadata(id: Long): Movie =
        post<Movie>(url("/api/movies/$id/candidates/reject")).also { metadataUpdated() }

    /** Turns a server-relative path (`/media/posters/x.jpg`, `/api/stream/1`) into an absolute URL on the active server. */
    fun resolve(path: String?): String? = path?.let { baseUrl()?.resolve(it)?.toString() }

    private fun url(path: String): HttpUrl = (baseUrl() ?: throw IllegalStateException("No Ottlib server selected")).resolve(path)!!

    private suspend inline fun <reified T> get(url: HttpUrl): T =
        OttlibJson.decodeFromString(client.newCall(Request.Builder().url(url).get().build()).awaitBody())

    /** A POST with no body and no content type, exactly as the web client sends it (Fastify rejects an empty JSON body). */
    private suspend inline fun <reified T> post(url: HttpUrl): T =
        OttlibJson.decodeFromString(client.newCall(Request.Builder().url(url).post(ByteArray(0).toRequestBody()).build()).awaitBody())

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
