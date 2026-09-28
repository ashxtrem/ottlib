package dev.ottlib.core.presentation.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.ottlib.core.data.ConnectionManager
import dev.ottlib.core.data.DeviceIdentity
import dev.ottlib.core.data.PlaybackPreferences
import dev.ottlib.core.data.PlaybackSettings
import dev.ottlib.core.model.PictureMode
import dev.ottlib.core.model.ServerInfo
import dev.ottlib.core.network.OttlibApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class SettingsViewModel(
    private val connection: ConnectionManager,
    private val preferences: PlaybackPreferences,
    private val api: OttlibApi,
    deviceIdentity: DeviceIdentity,
) : ViewModel() {
    val server: StateFlow<ServerInfo?> = connection.serverInfo
    val serverUrl: String? get() = connection.activeServer.value?.toString()
    val playback: StateFlow<PlaybackSettings> = preferences.settings.stateIn(viewModelScope, SharingStarted.Eagerly, PlaybackSettings())

    private val languages = MutableStateFlow(commonLanguages)
    /** Audio languages present in the library first, then common ones. */
    val languageOptions: StateFlow<List<String>> = languages.asStateFlow()
    private val device = MutableStateFlow<String?>(null)
    val deviceId: StateFlow<String?> = device.asStateFlow()

    init {
        viewModelScope.launch { device.value = deviceIdentity.deviceId() }
        viewModelScope.launch {
            runCatching { api.filterOptions().audioLanguages }.onSuccess { library -> languages.value = (library + commonLanguages).distinct() }
        }
    }

    fun setAudioLanguage(language: String?) { viewModelScope.launch { preferences.setAudioLanguage(language) } }
    fun setSubtitleLanguage(language: String?) { viewModelScope.launch { preferences.setSubtitleLanguage(language) } }
    fun setSkipBackSeconds(seconds: Int) { viewModelScope.launch { preferences.setSkipBackSeconds(seconds) } }
    fun setSkipForwardSeconds(seconds: Int) { viewModelScope.launch { preferences.setSkipForwardSeconds(seconds) } }
    fun setDefaultPictureMode(mode: PictureMode) { viewModelScope.launch { preferences.setDefaultPictureMode(mode) } }
    fun setLanguagesFollowLastChoice(enabled: Boolean) { viewModelScope.launch { preferences.setLanguagesFollowLastChoice(enabled) } }

    fun changeServer(onDone: () -> Unit) {
        viewModelScope.launch {
            connection.forget()
            onDone()
        }
    }

    companion object {
        private val commonLanguages = listOf("eng", "hin", "tam", "tel", "mal", "jpn", "kor", "spa", "fra", "deu")
    }
}
