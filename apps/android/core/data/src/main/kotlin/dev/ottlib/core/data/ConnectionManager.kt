package dev.ottlib.core.data

import dev.ottlib.core.model.SUPPORTED_API_VERSION
import dev.ottlib.core.model.ServerInfo
import dev.ottlib.core.network.OttlibApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

sealed interface ConnectResult {
    data class Connected(val url: HttpUrl, val info: ServerInfo) : ConnectResult
    data class Incompatible(val info: ServerInfo, val message: String) : ConnectResult
    data class Unreachable(val message: String) : ConnectResult
}

/** Owns which server is active. Every API call resolves against [activeServer]. */
class ConnectionManager(private val store: ServerStore, private val probe: suspend (HttpUrl) -> ServerInfo) {
    private val active = MutableStateFlow<HttpUrl?>(null)
    private val info = MutableStateFlow<ServerInfo?>(null)
    val activeServer: StateFlow<HttpUrl?> = active.asStateFlow()
    val serverInfo: StateFlow<ServerInfo?> = info.asStateFlow()

    suspend fun savedServer(): HttpUrl? = store.savedServerUrl()?.toHttpUrlOrNull()

    suspend fun connect(url: HttpUrl): ConnectResult {
        val server = try { probe(url) } catch (error: Exception) {
            return ConnectResult.Unreachable(error.message?.takeIf { it.isNotBlank() } ?: "Could not reach ${url.host}:${url.port}")
        }
        compatibilityProblem(server)?.let { return ConnectResult.Incompatible(server, it) }
        store.save(url.toString())
        active.value = url
        info.value = server
        return ConnectResult.Connected(url, server)
    }

    suspend fun forget() {
        store.clear()
        active.value = null
        info.value = null
    }

    companion object {
        fun compatibilityProblem(server: ServerInfo): String? = when {
            server.apiVersion > SUPPORTED_API_VERSION -> "This server is newer than the TV app (API ${server.apiVersion}). Update the Ottlib TV app."
            server.apiVersion < SUPPORTED_API_VERSION -> "This server is older than the TV app (API ${server.apiVersion}). Update the Ottlib server."
            else -> null
        }

        /** Convenience for callers holding user input. */
        fun parse(input: String): HttpUrl? = OttlibApi.parseServerAddress(input)
    }
}
