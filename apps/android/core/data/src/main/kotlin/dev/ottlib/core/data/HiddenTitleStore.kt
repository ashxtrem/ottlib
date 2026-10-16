package dev.ottlib.core.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import dev.ottlib.core.model.HiddenTitle
import dev.ottlib.core.model.toHiddenTitle
import dev.ottlib.core.model.Movie
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

/**
 * Titles the viewer hid on this device. Kept in local preferences only, so hiding on the TV never changes
 * what the phone shows. Like [TrackChoiceStore] it is not keyed by server: a device normally talks to one.
 */
class HiddenTitleStore(private val context: Context) {
    private val key = stringPreferencesKey("hidden_titles")

    val titles: Flow<List<HiddenTitle>> = context.ottlibPreferences.data.map { HiddenTitles.decode(it[key]) }.distinctUntilChanged()
    val keys: Flow<Set<String>> = titles.map { list -> list.mapTo(HashSet()) { it.key } }.distinctUntilChanged()

    suspend fun hide(movie: Movie) = edit { HiddenTitles.with(it, movie.toHiddenTitle()) }

    suspend fun unhide(key: String) = edit { HiddenTitles.without(it, key) }

    suspend fun unhideAll() = edit { emptyList() }

    private suspend fun edit(change: (List<HiddenTitle>) -> List<HiddenTitle>) {
        context.ottlibPreferences.edit { preferences -> preferences[key] = HiddenTitles.encode(change(HiddenTitles.decode(preferences[key]))) }
    }
}

/** Storage format for [HiddenTitleStore]: a JSON list, oldest first, capped. */
internal object HiddenTitles {
    const val MAX_ENTRIES = 2000
    private val json = Json { ignoreUnknownKeys = true }
    private val serializer = ListSerializer(HiddenTitle.serializer())

    fun decode(stored: String?): List<HiddenTitle> =
        stored?.let { runCatching { json.decodeFromString(serializer, it) }.getOrNull() }.orEmpty()

    fun encode(titles: List<HiddenTitle>): String = json.encodeToString(serializer, titles)

    /** Re-hiding a title moves it to the end; every episode of a show maps to the same entry. */
    fun with(titles: List<HiddenTitle>, title: HiddenTitle): List<HiddenTitle> =
        (titles.filterNot { it.key == title.key } + title).takeLast(MAX_ENTRIES)

    fun without(titles: List<HiddenTitle>, key: String): List<HiddenTitle> = titles.filterNot { it.key == key }
}
