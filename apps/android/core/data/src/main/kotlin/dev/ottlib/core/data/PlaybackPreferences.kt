package dev.ottlib.core.data

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import dev.ottlib.core.model.PictureMode
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

/**
 * Per-TV playback preferences. Language codes are as the server reports them (`eng`, `hin`, …): a null audio
 * language keeps the file's default track; a null subtitle language means subtitles off (forced ones still show).
 */
data class PlaybackSettings(
    val audioLanguage: String? = null,
    val subtitleLanguage: String? = null,
    val skipBackSeconds: Int = DEFAULT_SKIP_SECONDS,
    val skipForwardSeconds: Int = DEFAULT_SKIP_SECONDS,
    val defaultPictureMode: PictureMode = PictureMode.Fit,
    val pictureHintShown: Boolean = false,
    /** When on, changing audio/subtitles during playback also updates the language defaults for new titles. */
    val languagesFollowLastChoice: Boolean = false,
) {
    companion object {
        const val DEFAULT_SKIP_SECONDS = 10
        val SKIP_BACK_CHOICES = listOf(5, 10, 15, 30)
        val SKIP_FORWARD_CHOICES = listOf(5, 10, 15, 30, 60)
    }
}

class PlaybackPreferences(private val context: Context) {
    private val audioKey = stringPreferencesKey("audio_language")
    private val subtitleKey = stringPreferencesKey("subtitle_language")
    private val skipBackKey = intPreferencesKey("skip_back_seconds")
    private val skipForwardKey = intPreferencesKey("skip_forward_seconds")
    private val pictureModeKey = stringPreferencesKey("default_picture_mode")
    private val pictureHintKey = booleanPreferencesKey("picture_hint_shown")
    private val followChoiceKey = booleanPreferencesKey("languages_follow_last_choice")

    val settings: Flow<PlaybackSettings> = context.ottlibPreferences.data.map {
        PlaybackSettings(
            audioLanguage = it[audioKey],
            subtitleLanguage = it[subtitleKey],
            skipBackSeconds = it[skipBackKey] ?: PlaybackSettings.DEFAULT_SKIP_SECONDS,
            skipForwardSeconds = it[skipForwardKey] ?: PlaybackSettings.DEFAULT_SKIP_SECONDS,
            defaultPictureMode = PictureMode.fromName(it[pictureModeKey]) ?: PictureMode.Fit,
            pictureHintShown = it[pictureHintKey] ?: false,
            languagesFollowLastChoice = it[followChoiceKey] ?: false,
        )
    }

    suspend fun current(): PlaybackSettings = settings.first()

    suspend fun setAudioLanguage(language: String?) = set(audioKey, language)
    suspend fun setSubtitleLanguage(language: String?) = set(subtitleKey, language)
    suspend fun setSkipBackSeconds(seconds: Int) = set(skipBackKey, seconds)
    suspend fun setSkipForwardSeconds(seconds: Int) = set(skipForwardKey, seconds)
    suspend fun setDefaultPictureMode(mode: PictureMode) = set(pictureModeKey, mode.name)
    suspend fun markPictureHintShown() = set(pictureHintKey, true)
    suspend fun setLanguagesFollowLastChoice(enabled: Boolean) = set(followChoiceKey, enabled)

    private suspend fun <T> set(key: Preferences.Key<T>, value: T?) {
        context.ottlibPreferences.edit { if (value == null) it.remove(key) else it[key] = value }
    }
}
