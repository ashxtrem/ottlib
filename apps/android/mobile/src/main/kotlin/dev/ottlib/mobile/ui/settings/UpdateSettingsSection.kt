package dev.ottlib.mobile.ui.settings

import androidx.compose.foundation.clickable
import androidx.compose.material3.ListItem
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
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
    val action = UpdateText.action(state)
    ListItem(
        headlineContent = { Text(UpdateText.headline(state)) },
        supportingContent = { Text(UpdateText.detail(state) ?: "Ottlib ${updates.versionName}") },
        trailingContent = action?.let { { Text(it, color = OttlibColors.Accent) } },
        modifier = Modifier.clickable(enabled = action != null, onClick = updates::performAction),
    )
    if (state != UpdateState.LocalBuild) ListItem(
        headlineContent = { Text("Check for updates automatically") },
        supportingContent = { Text("Asks GitHub for a newer release when the app starts") },
        trailingContent = { Switch(checked = settings.autoCheck, onCheckedChange = updates::setAutoCheck) },
        modifier = Modifier.clickable { updates.setAutoCheck(!settings.autoCheck) },
    )
}
