package dev.ottlib.core.data

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import okhttp3.HttpUrl

/** Where [ProfileSession] keeps profile session tokens; [ProfileSessionStore] in the app, an in-memory fake in tests. */
interface ProfileTokens {
    /** For the OkHttp interceptor, which runs on background threads. */
    fun tokenBlocking(server: HttpUrl): String?
    suspend fun save(server: HttpUrl, token: String)
    suspend fun clear(server: HttpUrl)
    /** `origin#profileId` of the profile this device last used, to notice a profile change across restarts. */
    suspend fun lastProfile(): String?
    suspend fun saveLastProfile(key: String)
}

/** Profile session tokens, one per server origin (key `profile_session:<scheme://host:port>`), so each server remembers its profile. */
class ProfileSessionStore(private val context: Context) : ProfileTokens {
    @Volatile private var cached: Map<String, String>? = null

    /** Only blocks on the very first request. */
    override fun tokenBlocking(server: HttpUrl): String? = (cached ?: runBlocking { load() })[origin(server)]

    override suspend fun save(server: HttpUrl, token: String) {
        context.ottlibPreferences.edit { it[key(server)] = token }
        load()
    }

    override suspend fun clear(server: HttpUrl) {
        cached = (cached ?: load()) - origin(server)
        context.ottlibPreferences.edit { it.remove(key(server)) }
        load()
    }

    override suspend fun lastProfile(): String? = context.ottlibPreferences.data.first()[LAST_PROFILE]

    override suspend fun saveLastProfile(key: String) {
        context.ottlibPreferences.edit { it[LAST_PROFILE] = key }
    }

    private suspend fun load(): Map<String, String> =
        context.ottlibPreferences.data.first().asMap()
            .mapNotNull { (key, value) -> if (key.name.startsWith(PREFIX) && value is String) key.name.removePrefix(PREFIX) to value else null }
            .toMap().also { cached = it }

    private fun key(server: HttpUrl): Preferences.Key<String> = stringPreferencesKey(PREFIX + origin(server))

    companion object {
        private const val PREFIX = "profile_session:"
        private val LAST_PROFILE = stringPreferencesKey("profile_last_used")
        fun origin(url: HttpUrl) = "${url.scheme}://${url.host}:${url.port}"
    }
}
