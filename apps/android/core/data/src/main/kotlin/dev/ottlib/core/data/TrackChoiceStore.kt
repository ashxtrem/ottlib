package dev.ottlib.core.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import dev.ottlib.core.model.TrackChoice
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

/** Audio/subtitle choices remembered per title on this TV. */
class TrackChoiceStore(private val context: Context) {
    private val key = stringPreferencesKey("track_choices")

    suspend fun get(movieId: Long): TrackChoice? = TrackChoices.decode(context.ottlibPreferences.data.first()[key])[movieId]

    suspend fun set(movieId: Long, choice: TrackChoice) {
        context.ottlibPreferences.edit { preferences ->
            preferences[key] = TrackChoices.encode(TrackChoices.update(TrackChoices.decode(preferences[key]), movieId, choice))
        }
    }
}

/** Storage format for [TrackChoiceStore]: a JSON object keyed by movie id, most recently used last, capped. */
internal object TrackChoices {
    const val MAX_ENTRIES = 300
    private val json = Json { ignoreUnknownKeys = true }

    fun decode(stored: String?): LinkedHashMap<Long, TrackChoice> {
        val choices = LinkedHashMap<Long, TrackChoice>()
        val entries = stored?.let { runCatching { json.parseToJsonElement(it).jsonObject }.getOrNull() } ?: return choices
        entries.forEach { (id, value) ->
            val movieId = id.toLongOrNull() ?: return@forEach
            runCatching { json.decodeFromJsonElement(TrackChoice.serializer(), value) }.onSuccess { choices[movieId] = it }
        }
        return choices
    }

    fun encode(choices: Map<Long, TrackChoice>): String =
        JsonObject(choices.entries.associate { (id, choice) -> id.toString() to json.encodeToJsonElement(TrackChoice.serializer(), choice) }).toString()

    fun update(choices: LinkedHashMap<Long, TrackChoice>, movieId: Long, choice: TrackChoice): LinkedHashMap<Long, TrackChoice> {
        choices.remove(movieId)
        choices[movieId] = choice
        while (choices.size > MAX_ENTRIES) choices.remove(choices.keys.first())
        return choices
    }
}
