package dev.ottlib.core.data

import dev.ottlib.core.model.AuthStatus
import dev.ottlib.core.model.SUPPORTED_API_VERSION
import dev.ottlib.core.model.ServerInfo
import dev.ottlib.core.network.ApiException
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
    /** The server has an access PIN and this device is not signed in; [message] says why the last PIN failed. */
    data class PinRequired(val url: HttpUrl, val message: String? = null) : ConnectResult
}

/** The server calls connecting needs, as functions so they can be faked. */
class ServerAccess(
    val serverInfo: suspend (HttpUrl) -> ServerInfo,
    val authStatus: suspend (HttpUrl) -> AuthStatus,
    val login: suspend (HttpUrl, String) -> String,
)

/** Owns which server is active. Every API call resolves against [activeServer]. */
class ConnectionManager(private val store: ServerStore, private val tokens: AuthTokenStore, private val server: ServerAccess) {
    private val active = MutableStateFlow<HttpUrl?>(null)
    private val info = MutableStateFlow<ServerInfo?>(null)
    val activeServer: StateFlow<HttpUrl?> = active.asStateFlow()
    val serverInfo: StateFlow<ServerInfo?> = info.asStateFlow()

    suspend fun savedServer(): HttpUrl? = store.savedServerUrl()?.toHttpUrlOrNull()

    suspend fun connect(url: HttpUrl): ConnectResult {
        val found = try { server.serverInfo(url) } catch (error: Exception) { return unreachable(url, error) }
        compatibilityProblem(found)?.let { return ConnectResult.Incompatible(found, it) }
        if (found.authRequired) {
            val signedIn = try { server.authStatus(url).authenticated } catch (error: Exception) { return unreachable(url, error) }
            if (!signedIn) return ConnectResult.PinRequired(url)
        }
        store.save(url.toString())
        active.value = url
        info.value = found
        return ConnectResult.Connected(url, found)
    }

    /** Signs in to a PIN-protected server, keeps its session token, then connects. */
    suspend fun signIn(url: HttpUrl, pin: String): ConnectResult {
        val token = try { server.login(url, pin) } catch (error: ApiException) {
            return ConnectResult.PinRequired(url, error.message)
        } catch (error: Exception) { return unreachable(url, error) }
        tokens.save(url, token)
        return connect(url)
    }

    private fun unreachable(url: HttpUrl, error: Exception) =
        ConnectResult.Unreachable(error.message?.takeIf { it.isNotBlank() } ?: "Could not reach ${url.host}:${url.port}")

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
