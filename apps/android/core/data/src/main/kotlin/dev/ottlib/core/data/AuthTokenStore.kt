package dev.ottlib.core.data

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import okhttp3.HttpUrl

/**
 * Session tokens for servers protected by an access PIN, one per server origin, so switching back to a server
 * does not ask for its PIN again.
 */
class AuthTokenStore(private val context: Context) {
    @Volatile private var cached: Map<String, String>? = null

    /** For the OkHttp interceptor, which runs on background threads; only blocks on the very first request. */
    fun tokenBlocking(url: HttpUrl): String? = (cached ?: runBlocking { load() })[origin(url)]

    suspend fun save(server: HttpUrl, token: String) {
        context.ottlibPreferences.edit { it[key(server)] = token }
        load()
    }

    private suspend fun load(): Map<String, String> =
        context.ottlibPreferences.data.first().asMap()
            .mapNotNull { (key, value) -> if (key.name.startsWith(PREFIX) && value is String) key.name.removePrefix(PREFIX) to value else null }
            .toMap().also { cached = it }

    private fun key(server: HttpUrl): Preferences.Key<String> = stringPreferencesKey(PREFIX + origin(server))

    private companion object {
        const val PREFIX = "auth_token:"
        fun origin(url: HttpUrl) = "${url.scheme}://${url.host}:${url.port}"
    }
}
