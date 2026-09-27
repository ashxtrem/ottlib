package dev.ottlib.core.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import dev.ottlib.core.model.PictureMode
import kotlinx.coroutines.flow.first

/** Picture modes remembered per title on this TV ("always Zoom this 4:3 show"). */
class PictureModeStore(private val context: Context) {
    private val key = stringPreferencesKey("picture_mode_overrides")

    suspend fun get(movieId: Long): PictureMode? = PictureModeOverrides.decode(context.ottlibPreferences.data.first()[key])[movieId]

    /** Remembers [mode] for the title, or forgets the title's override when [mode] is null. */
    suspend fun set(movieId: Long, mode: PictureMode?) {
        context.ottlibPreferences.edit { preferences ->
            val overrides = PictureModeOverrides.decode(preferences[key])
            preferences[key] = PictureModeOverrides.encode(PictureModeOverrides.update(overrides, movieId, mode))
        }
    }
}

/** Storage format for [PictureModeStore]: `id=Mode` lines, most recently used last, capped at [MAX_ENTRIES]. */
internal object PictureModeOverrides {
    const val MAX_ENTRIES = 300

    fun decode(stored: String?): LinkedHashMap<Long, PictureMode> {
        val overrides = LinkedHashMap<Long, PictureMode>()
        stored.orEmpty().lineSequence().forEach { line ->
            val id = line.substringBefore('=').toLongOrNull() ?: return@forEach
            val mode = PictureMode.fromName(line.substringAfter('=', "")) ?: return@forEach
            overrides[id] = mode
        }
        return overrides
    }

    fun encode(overrides: Map<Long, PictureMode>): String = overrides.entries.joinToString("\n") { "${it.key}=${it.value.name}" }

    fun update(overrides: LinkedHashMap<Long, PictureMode>, movieId: Long, mode: PictureMode?): LinkedHashMap<Long, PictureMode> {
        overrides.remove(movieId)
        if (mode != null) overrides[movieId] = mode
        while (overrides.size > MAX_ENTRIES) overrides.remove(overrides.keys.first())
        return overrides
    }
}
