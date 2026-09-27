package dev.ottlib.core.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

/**
 * Language codes as the server reports them (`eng`, `hin`, …). A null audio language keeps the file's
 * default track; a null subtitle language means subtitles off (forced subtitles still show).
 */
data class PlaybackSettings(val audioLanguage: String? = null, val subtitleLanguage: String? = null)

class PlaybackPreferences(private val context: Context) {
    private val audioKey = stringPreferencesKey("audio_language")
    private val subtitleKey = stringPreferencesKey("subtitle_language")

    val settings: Flow<PlaybackSettings> = context.ottlibPreferences.data.map { PlaybackSettings(it[audioKey], it[subtitleKey]) }

    suspend fun current(): PlaybackSettings = settings.first()

    suspend fun setAudioLanguage(language: String?) = set(audioKey, language)

    suspend fun setSubtitleLanguage(language: String?) = set(subtitleKey, language)

    private suspend fun set(key: androidx.datastore.preferences.core.Preferences.Key<String>, value: String?) {
        context.ottlibPreferences.edit { if (value == null) it.remove(key) else it[key] = value }
    }
}
