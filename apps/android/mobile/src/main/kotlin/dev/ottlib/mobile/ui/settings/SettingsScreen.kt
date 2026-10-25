package dev.ottlib.mobile.ui.settings

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.ottlib.core.data.PlaybackSettings
import dev.ottlib.core.data.ProfileState
import dev.ottlib.core.data.canSwitchProfile
import dev.ottlib.core.data.current
import dev.ottlib.core.model.PictureMode
import dev.ottlib.core.player.languageName
import dev.ottlib.core.presentation.Choice
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.player.autoPlaySummary
import dev.ottlib.core.presentation.settings.SettingsViewModel
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.mobile.BuildConfig
import dev.ottlib.mobile.ui.components.ChoiceDialog
import kotlinx.coroutines.flow.map

private enum class SettingsDialog { Audio, Subtitles, SkipBack, SkipForward, Picture, AutoPlay }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onOpenHidden: () -> Unit, onChangeServer: () -> Unit, onSwitchProfile: () -> Unit, onManageProfiles: () -> Unit) {
    val container = appContainer()
    val profile by container.profileSession.state.collectAsStateWithLifecycle()
    val viewModel = viewModel { SettingsViewModel(container.connection, container.playbackPreferences, container.api, container.deviceIdentity) }
    val server by viewModel.server.collectAsStateWithLifecycle()
    val playback by viewModel.playback.collectAsStateWithLifecycle()
    val languages by viewModel.languageOptions.collectAsStateWithLifecycle()
    val deviceId by viewModel.deviceId.collectAsStateWithLifecycle()
    var dialog by rememberSaveable { mutableStateOf<SettingsDialog?>(null) }
    val hiddenCount by remember { container.hiddenTitles.titles.map { it.size } }.collectAsStateWithLifecycle(initialValue = 0)

    Scaffold(topBar = { TopAppBar(title = { Text("Settings") }) }) { padding ->
        // Settings read best as one column, so wide windows centre it instead of stretching rows across the screen.
        Box(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()), contentAlignment = Alignment.TopCenter) {
            Column(Modifier.widthIn(max = 720.dp).fillMaxWidth().padding(bottom = 24.dp)) {
                SectionTitle("Server")
                Setting(server?.name ?: "Not connected", listOfNotNull(viewModel.serverUrl, server?.version?.let { "server $it" }).joinToString("  ·  "), trailing = "Change") {
                    viewModel.changeServer(onChangeServer)
                }

                val current = profile.current
                if (current != null) {
                    SectionTitle("Profiles")
                    if (profile is ProfileState.Selected && profile.canSwitchProfile) {
                        Setting("Switch profile", "Watching as ${current.name}", trailing = "Switch", onClick = onSwitchProfile)
                    }
                    Setting("Manage profiles", "Names, colours and PINs", trailing = "Manage", onClick = onManageProfiles)
                }

                SectionTitle("Playback")
                Setting("Preferred audio language", playback.audioLanguage?.let(::languageName) ?: "File default") { dialog = SettingsDialog.Audio }
                Setting("Subtitles", playback.subtitleLanguage?.let(::languageName) ?: "Off (forced subtitles still show)") { dialog = SettingsDialog.Subtitles }
                ListItem(
                    headlineContent = { Text("New titles use my last track choice") },
                    supportingContent = {
                        Text(
                            if (playback.languagesFollowLastChoice) "Changing audio or subtitles during playback also updates the languages above"
                            else "Track changes are remembered for that title only",
                        )
                    },
                    trailingContent = { Switch(checked = playback.languagesFollowLastChoice, onCheckedChange = viewModel::setLanguagesFollowLastChoice) },
                    modifier = Modifier.clickable { viewModel.setLanguagesFollowLastChoice(!playback.languagesFollowLastChoice) },
                )
                Setting("Skip back", "${playback.skipBackSeconds} seconds  ·  double-tap the left of the video") { dialog = SettingsDialog.SkipBack }
                Setting("Skip forward", "${playback.skipForwardSeconds} seconds  ·  double-tap the right of the video") { dialog = SettingsDialog.SkipForward }
                Setting("Default picture", "${playback.defaultPictureMode.label}  ·  ${playback.defaultPictureMode.description}") { dialog = SettingsDialog.Picture }
                Setting("Auto-play next", autoPlaySummary(playback.autoPlayNextSeconds)) { dialog = SettingsDialog.AutoPlay }
                Text(
                    "During playback: swipe up or down on the left for brightness and on the right for volume, swipe sideways to seek, " +
                        "and pinch to fill the screen. The picture button has every picture option.",
                    style = MaterialTheme.typography.bodySmall,
                    color = OttlibColors.Muted,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )

                SectionTitle("Library")
                Setting("Hidden titles", if (hiddenCount == 0) "Nothing hidden on this device" else "$hiddenCount hidden on this device only", trailing = "Manage", onClick = onOpenHidden)

                SectionTitle("App updates")
                UpdateSettingsSection(container.updates)

                SectionTitle("About")
                Text("Ottlib ${BuildConfig.VERSION_NAME}", style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Muted, modifier = Modifier.padding(horizontal = 16.dp))
                deviceId?.let { Text("Device ID $it", style = MaterialTheme.typography.bodySmall, color = OttlibColors.Muted, modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) }
            }
        }
    }

    val languageChoices = languages.map { Choice<String?>(languageName(it), it) }
    when (dialog) {
        SettingsDialog.Audio -> ChoiceDialog("Preferred audio language", listOf(Choice<String?>("File default", null)) + languageChoices, playback.audioLanguage, onSelect = viewModel::setAudioLanguage, onDismiss = { dialog = null })
        SettingsDialog.Subtitles -> ChoiceDialog("Subtitles", listOf(Choice<String?>("Off", null)) + languageChoices, playback.subtitleLanguage, onSelect = viewModel::setSubtitleLanguage, onDismiss = { dialog = null })
        SettingsDialog.SkipBack -> ChoiceDialog("Skip back", secondsChoices(PlaybackSettings.SKIP_BACK_CHOICES), playback.skipBackSeconds, onSelect = viewModel::setSkipBackSeconds, onDismiss = { dialog = null })
        SettingsDialog.SkipForward -> ChoiceDialog("Skip forward", secondsChoices(PlaybackSettings.SKIP_FORWARD_CHOICES), playback.skipForwardSeconds, onSelect = viewModel::setSkipForwardSeconds, onDismiss = { dialog = null })
        SettingsDialog.Picture -> ChoiceDialog("Default picture", PictureMode.entries.map { Choice("${it.label} — ${it.description}", it) }, playback.defaultPictureMode, onSelect = viewModel::setDefaultPictureMode, onDismiss = { dialog = null })
        SettingsDialog.AutoPlay -> ChoiceDialog("Auto-play next", autoPlayChoices(), playback.autoPlayNextSeconds, onSelect = viewModel::setAutoPlayNextSeconds, onDismiss = { dialog = null })
        null -> Unit
    }
}

private fun secondsChoices(values: List<Int>) = values.map { Choice("$it seconds", it) }
private fun autoPlayChoices() = PlaybackSettings.AUTO_PLAY_CHOICES.map { Choice(if (it == 0) "Off" else "After $it seconds", it) }

@Composable
private fun Setting(title: String, value: String, trailing: String? = null, onClick: () -> Unit) {
    ListItem(
        headlineContent = { Text(title) },
        supportingContent = { Text(value) },
        trailingContent = trailing?.let { { Text(it, color = OttlibColors.Accent) } },
        modifier = Modifier.clickable(onClick = onClick),
    )
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleSmall, color = OttlibColors.Accent, modifier = Modifier.padding(start = 16.dp, top = 20.dp, bottom = 4.dp))
}
