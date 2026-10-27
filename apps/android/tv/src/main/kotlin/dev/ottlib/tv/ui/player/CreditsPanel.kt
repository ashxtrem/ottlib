package dev.ottlib.tv.ui.player

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.unit.dp
import androidx.tv.material3.DenseListItem
import androidx.tv.material3.Icon
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.SurfaceDefaults
import androidx.tv.material3.Text
import dev.ottlib.core.presentation.formatPosition
import dev.ottlib.core.presentation.player.AutoSkipChoice
import dev.ottlib.core.presentation.player.CreditsUiState
import dev.ottlib.core.presentation.player.creditsSummary
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.tv.ui.components.tryRequestFocus
import kotlinx.coroutines.delay

/**
 * Side sheet from the controls row: mark where the credits start (at the playhead, read from [position] as it plays),
 * clear the mark, and choose auto-skip for this movie or series. Rows stay focusable while a change saves (presses are
 * ignored), so focus never drops out of the sheet. Back closes it; focus is trapped inside while it is open.
 */
@Composable
fun CreditsPanel(
    state: CreditsUiState,
    position: () -> Long,
    onMark: () -> Unit,
    onClearMark: () -> Unit,
    onAutoSkip: (AutoSkipChoice) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var positionMs by remember { mutableLongStateOf(position()) }
    LaunchedEffect(Unit) {
        while (true) {
            positionMs = position()
            delay(POSITION_TICK_MS)
        }
    }
    var focusInside by remember { mutableStateOf(false) }
    val initialFocus = remember { FocusRequester() }
    BackHandler(onBack = onDismiss)

    Surface(
        modifier = modifier.fillMaxHeight().width(400.dp).onFocusChanged { focusInside = it.hasFocus }.focusGroup().focusProperties { onExit = { cancelFocusChange() } },
        shape = RectangleShape,
        colors = SurfaceDefaults.colors(containerColor = OttlibColors.Surface.copy(alpha = 0.95f)),
    ) {
        Column(Modifier.padding(24.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Credits", style = MaterialTheme.typography.headlineSmall, color = OttlibColors.Foreground)
            Text(creditsSummary(state.credits), color = OttlibColors.Muted, modifier = Modifier.padding(bottom = 12.dp))
            DenseListItem(
                selected = false,
                onClick = { if (!state.saving) onMark() },
                headlineContent = { Text("Credits start here") },
                supportingContent = { Text("At ${formatPosition(positionMs)}, for every profile") },
                modifier = Modifier.focusRequester(initialFocus),
            )
            if (state.credits?.source == "mark") {
                DenseListItem(selected = false, onClick = { if (!state.saving) onClearMark() }, headlineContent = { Text("Clear credits mark") })
            }
            Text(
                "Auto-skip credits  ·  now ${if (state.autoSkip) "on" else "off"}",
                style = MaterialTheme.typography.titleSmall,
                color = OttlibColors.Accent,
                modifier = Modifier.padding(top = 12.dp, bottom = 4.dp),
            )
            AutoSkipChoice.entries.forEach { choice ->
                DenseListItem(
                    selected = choice == state.choice,
                        onClick = { if (!state.saving) onAutoSkip(choice) },
                    headlineContent = { Text(choice.label) },
                    trailingContent = if (choice == state.choice) ({ Icon(Icons.Filled.Check, contentDescription = "Chosen") }) else null,
                )
            }
            state.error?.let { Text(it, color = OttlibColors.Error, modifier = Modifier.padding(top = 8.dp)) }
            Text(
                "Auto-skip starts up next when the credits do; without a next title, a Skip credits button shows.",
                style = MaterialTheme.typography.bodySmall,
                color = OttlibColors.Muted,
                modifier = Modifier.padding(top = 12.dp),
            )
        }
    }
    // The video view (or a control button) may still hold focus as the panel appears; keep asking for a few frames.
    LaunchedEffect(Unit) {
        repeat(FOCUS_ATTEMPTS) {
            withFrameNanos { }
            if (focusInside) return@LaunchedEffect
            initialFocus.tryRequestFocus()
        }
    }
}

private const val FOCUS_ATTEMPTS = 10
private const val POSITION_TICK_MS = 500L
