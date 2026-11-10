package dev.ottlib.core.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl

/** What the search screen needs from the recent-searches storage; the seam tests fake. */
interface RecentSearches {
    fun flow(scope: String): Flow<List<String>>

    suspend fun add(scope: String, query: String)

    suspend fun remove(scope: String, query: String)
}

/**
 * Recent searches kept on this device, one list per [RecentSearchScope] so another server or profile never sees
 * them. Local preferences only, like [HiddenTitleStore].
 */
class RecentSearchStore(private val context: Context) : RecentSearches {
    private val key = stringPreferencesKey("recent_searches")

    override fun flow(scope: String): Flow<List<String>> =
        context.ottlibPreferences.data.map { RecentSearchLists.decode(it[key])[scope].orEmpty() }.distinctUntilChanged()

    override suspend fun add(scope: String, query: String) = edit { RecentSearchLists.add(it, scope, query) }

    override suspend fun remove(scope: String, query: String) = edit { RecentSearchLists.remove(it, scope, query) }

    private suspend fun edit(change: (Map<String, List<String>>) -> Map<String, List<String>>) {
        context.ottlibPreferences.edit { preferences -> preferences[key] = RecentSearchLists.encode(change(RecentSearchLists.decode(preferences[key]))) }
    }
}

/** Builds the key recents are stored under: the server's host and port plus the profile in use. */
object RecentSearchScope {
    /** Used when the server has no profiles. */
    const val NO_PROFILE = "-"

    /**
     * Null while no server is active, or while the profile is unknown or being picked (so nothing is saved
     * into the wrong list). There is no server id, so the address stands in for it.
     */
    fun of(server: HttpUrl?, profile: ProfileState): String? {
        val profileId = when (profile) {
            is ProfileState.Unsupported -> null
            is ProfileState.Single, is ProfileState.Selected -> profile.current?.id?.toString()
            else -> return null
        }
        return server?.let { of("${it.host}:${it.port}", profileId) }
    }

    fun of(address: String, profileId: String?): String = "$address/${profileId ?: NO_PROFILE}"
}

/** Storage format for [RecentSearchStore]: a JSON map from scope to queries, newest first. */
internal object RecentSearchLists {
    const val MAX_ENTRIES = 8
    private val json = Json { ignoreUnknownKeys = true }
    private val serializer = MapSerializer(String.serializer(), ListSerializer(String.serializer()))

    fun decode(stored: String?): Map<String, List<String>> =
        stored?.let { runCatching { json.decodeFromString(serializer, it) }.getOrNull() }.orEmpty()

    fun encode(lists: Map<String, List<String>>): String = json.encodeToString(serializer, lists)

    /** A repeat (ignoring case) moves to the front and takes the newest spelling. */
    fun add(lists: Map<String, List<String>>, scope: String, query: String): Map<String, List<String>> {
        val term = query.trim()
        if (term.isEmpty()) return lists
        val updated = (listOf(term) + lists[scope].orEmpty().filterNot { it.equals(term, ignoreCase = true) }).take(MAX_ENTRIES)
        return lists + (scope to updated)
    }

    fun remove(lists: Map<String, List<String>>, scope: String, query: String): Map<String, List<String>> {
        val kept = lists[scope].orEmpty().filterNot { it.equals(query.trim(), ignoreCase = true) }
        return if (kept.isEmpty()) lists - scope else lists + (scope to kept)
    }
}
