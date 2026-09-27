package dev.ottlib.tv.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.ListItem
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import dev.ottlib.core.player.languageName
import dev.ottlib.tv.BuildConfig
import dev.ottlib.tv.appContainer
import dev.ottlib.tv.ui.components.Choice
import dev.ottlib.tv.ui.components.ChoiceDialog
import dev.ottlib.tv.ui.components.ScreenPadding
import dev.ottlib.tv.ui.components.TopDestination
import dev.ottlib.tv.ui.components.TopNavigation
import dev.ottlib.tv.ui.theme.OttlibColors

private enum class SettingsDialog { Audio, Subtitles }

@Composable
fun SettingsScreen(onNavigate: (TopDestination) -> Unit, onChangeServer: () -> Unit) {
    val container = appContainer()
    val viewModel = viewModel { SettingsViewModel(container.connection, container.playbackPreferences, container.api, container.deviceIdentity) }
    val server by viewModel.server.collectAsStateWithLifecycle()
    val playback by viewModel.playback.collectAsStateWithLifecycle()
    val languages by viewModel.languageOptions.collectAsStateWithLifecycle()
    val deviceId by viewModel.deviceId.collectAsStateWithLifecycle()
    var dialog by remember { mutableStateOf<SettingsDialog?>(null) }

    Column(Modifier.fillMaxSize()) {
        TopNavigation(TopDestination.Settings, onNavigate)
        Column(
            Modifier.width(760.dp).padding(horizontal = ScreenPadding, vertical = 16.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            SectionTitle("Server")
            ListItem(
                selected = false,
                onClick = { viewModel.changeServer(onChangeServer) },
                headlineContent = { Text(server?.name ?: "Not connected") },
                supportingContent = { Text(listOfNotNull(viewModel.serverUrl, server?.version?.let { "server $it" }).joinToString("  ·  ")) },
                trailingContent = { Text("Change", color = OttlibColors.Accent) },
            )

            SectionTitle("Playback")
            ListItem(
                selected = false,
                onClick = { dialog = SettingsDialog.Audio },
                headlineContent = { Text("Preferred audio language") },
                supportingContent = { Text(playback.audioLanguage?.let(::languageName) ?: "File default") },
            )
            ListItem(
                selected = false,
                onClick = { dialog = SettingsDialog.Subtitles },
                headlineContent = { Text("Subtitles") },
                supportingContent = { Text(playback.subtitleLanguage?.let(::languageName) ?: "Off (forced subtitles still show)") },
            )
            Text(
                "You can switch audio and subtitle tracks during playback from the player's settings button.",
                style = MaterialTheme.typography.bodySmall,
                color = OttlibColors.Muted,
                modifier = Modifier.padding(start = 16.dp),
            )

            SectionTitle("About")
            Text("Ottlib TV ${BuildConfig.VERSION_NAME}", style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Muted, modifier = Modifier.padding(start = 16.dp))
            deviceId?.let { Text("Device ID $it", style = MaterialTheme.typography.bodySmall, color = OttlibColors.Muted, modifier = Modifier.padding(start = 16.dp)) }
        }
    }

    val languageChoices = languages.map { Choice<String?>(languageName(it), it) }
    when (dialog) {
        SettingsDialog.Audio -> ChoiceDialog("Preferred audio language", listOf(Choice<String?>("File default", null)) + languageChoices, playback.audioLanguage, onSelect = viewModel::setAudioLanguage, onDismiss = { dialog = null })
        SettingsDialog.Subtitles -> ChoiceDialog("Subtitles", listOf(Choice<String?>("Off", null)) + languageChoices, playback.subtitleLanguage, onSelect = viewModel::setSubtitleLanguage, onDismiss = { dialog = null })
        null -> Unit
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleMedium, color = OttlibColors.Foreground, modifier = Modifier.padding(top = 16.dp, bottom = 4.dp))
}
