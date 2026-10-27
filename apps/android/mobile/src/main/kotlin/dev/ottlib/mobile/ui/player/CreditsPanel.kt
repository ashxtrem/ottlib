package dev.ottlib.mobile.ui.player

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ListItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import dev.ottlib.core.presentation.formatPosition
import dev.ottlib.core.presentation.player.AutoSkipChoice
import dev.ottlib.core.presentation.player.CreditsUiState
import dev.ottlib.core.presentation.player.creditsSummary
import dev.ottlib.core.presentation.theme.OttlibColors
import kotlinx.coroutines.delay

/**
 * Mark where the credits start (at the playhead, read from [position] as it plays), clear the mark, and choose
 * auto-skip for this movie or series.
 */
@Composable
fun BoxScope.CreditsPanel(
    state: CreditsUiState,
    position: () -> Long,
    onMark: () -> Unit,
    onClearMark: () -> Unit,
    onAutoSkip: (AutoSkipChoice) -> Unit,
    onDismiss: () -> Unit,
) {
    var positionMs by remember { mutableLongStateOf(position()) }
    LaunchedEffect(Unit) {
        while (true) {
            positionMs = position()
            delay(POSITION_TICK_MS)
        }
    }
    PlayerPanel("Credits", onDismiss) {
        item { ListItem(headlineContent = { Text(creditsSummary(state.credits)) }, colors = PanelRowColors) }
        item {
            ListItem(
                headlineContent = { Text("Credits start here") },
                supportingContent = { Text("At ${formatPosition(positionMs)}, for every profile") },
                colors = PanelRowColors,
                modifier = Modifier.clickable(enabled = !state.saving, onClick = onMark),
            )
        }
        if (state.credits?.source == "mark") {
            item {
                ListItem(
                    headlineContent = { Text("Clear credits mark") },
                    colors = PanelRowColors,
                    modifier = Modifier.clickable(enabled = !state.saving, onClick = onClearMark),
                )
            }
        }
        item { PanelHeading("Auto-skip credits  ·  now ${if (state.autoSkip) "on" else "off"}") }
        items(AutoSkipChoice.entries) { choice ->
            PanelOption(choice.label, selected = choice == state.choice) { if (!state.saving) onAutoSkip(choice) }
        }
        state.error?.let { message -> item { ListItem(headlineContent = { Text(message, color = OttlibColors.Error) }, colors = PanelRowColors) } }
        item {
            ListItem(
                headlineContent = { Text("Auto-skip starts up next when the credits do; without a next title, a Skip credits button shows.", color = OttlibColors.Muted) },
                colors = PanelRowColors,
            )
        }
    }
}

private const val POSITION_TICK_MS = 500L
