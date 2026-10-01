package dev.ottlib.tv.ui.settings

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.tv.material3.ListItem
import androidx.tv.material3.Text
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.core.presentation.update.AppUpdates
import dev.ottlib.core.presentation.update.UpdateState
import dev.ottlib.core.presentation.update.UpdateText
import dev.ottlib.core.presentation.update.performAction

/** Settings → App updates: the current version and update status, plus the automatic-check switch. */
@Composable
fun UpdateSettingsSection(updates: AppUpdates) {
    val state by updates.state.collectAsStateWithLifecycle()
    val settings by updates.settings.collectAsStateWithLifecycle()
    ListItem(
        selected = false,
        enabled = UpdateText.action(state) != null,
        onClick = updates::performAction,
        headlineContent = { Text(UpdateText.headline(state)) },
        supportingContent = { Text(UpdateText.detail(state) ?: "Ottlib TV ${updates.versionName}") },
        trailingContent = { UpdateText.action(state)?.let { Text(it, color = OttlibColors.Accent) } },
    )
    if (state != UpdateState.LocalBuild) ListItem(
        selected = false,
        onClick = { updates.setAutoCheck(!settings.autoCheck) },
        headlineContent = { Text("Check for updates automatically") },
        supportingContent = { Text("Asks GitHub for a newer release when the app starts") },
        trailingContent = { Text(if (settings.autoCheck) "On" else "Off", color = if (settings.autoCheck) OttlibColors.Accent else OttlibColors.Muted) },
    )
}
