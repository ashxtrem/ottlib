package dev.ottlib.tv.ui.player

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.unit.dp
import androidx.tv.material3.DenseListItem
import androidx.tv.material3.Icon
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.SurfaceDefaults
import androidx.tv.material3.Text
import dev.ottlib.core.model.PictureMode
import dev.ottlib.tv.ui.components.tryRequestFocus
import dev.ottlib.tv.ui.theme.OttlibColors

/**
 * Side sheet opened by holding OK during playback. Focusing an option previews it on the live video; OK keeps it,
 * Back restores the previous mode. Focus is trapped inside the sheet while it is open.
 */
@Composable
fun PicturePanel(
    current: PictureMode,
    onPreview: (PictureMode) -> Unit,
    onConfirm: (mode: PictureMode, rememberForTitle: Boolean) -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var rememberForTitle by remember { mutableStateOf(true) }
    var focusInside by remember { mutableStateOf(false) }
    val initialFocus = remember { FocusRequester() }
    BackHandler(onBack = onCancel)

    Surface(
        modifier = modifier.fillMaxHeight().width(360.dp).onFocusChanged { focusInside = it.hasFocus }.focusGroup().focusProperties { onExit = { cancelFocusChange() } },
        shape = RectangleShape,
        colors = SurfaceDefaults.colors(containerColor = OttlibColors.Surface.copy(alpha = 0.95f)),
    ) {
        Column(Modifier.padding(24.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Picture", style = MaterialTheme.typography.headlineSmall, color = OttlibColors.Foreground, modifier = Modifier.padding(bottom = 12.dp))
            PictureMode.entries.forEach { mode ->
                DenseListItem(
                    selected = mode == current,
                    onClick = { onConfirm(mode, rememberForTitle) },
                    headlineContent = { Text(mode.label) },
                    supportingContent = { Text(mode.description) },
                    trailingContent = if (mode == current) ({ Icon(Icons.Filled.Check, contentDescription = "Current") }) else null,
                    modifier = Modifier
                        .onFocusChanged { if (it.isFocused) onPreview(mode) }
                        .then(if (mode == current) Modifier.focusRequester(initialFocus) else Modifier),
                )
            }
            DenseListItem(
                selected = false,
                onClick = { rememberForTitle = !rememberForTitle },
                headlineContent = { Text("Remember for this title") },
                trailingContent = { Text(if (rememberForTitle) "On" else "Off", color = if (rememberForTitle) OttlibColors.Accent else OttlibColors.Muted) },
                modifier = Modifier.padding(top = 12.dp),
            )
        }
    }
    // The video view (or a Media3 control button, when paused) may still hold focus as the panel appears, and the
    // first request can land before the panel is laid out — keep asking for a few frames until focus is inside.
    LaunchedEffect(Unit) {
        repeat(FOCUS_ATTEMPTS) {
            withFrameNanos { }
            if (focusInside) return@LaunchedEffect
            initialFocus.tryRequestFocus()
        }
    }
}

private const val FOCUS_ATTEMPTS = 10
