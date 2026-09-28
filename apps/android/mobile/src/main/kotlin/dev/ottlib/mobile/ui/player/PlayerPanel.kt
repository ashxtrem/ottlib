package dev.ottlib.mobile.ui.player

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import dev.ottlib.core.presentation.theme.OttlibColors

/**
 * A side panel drawn inside the player rather than as a separate window, so the system bars stay hidden and the
 * video stays visible beside it (picture modes preview live). Tapping outside or Back closes it.
 */
@Composable
fun BoxScope.PlayerPanel(title: String, onDismiss: () -> Unit, content: LazyListScope.() -> Unit) {
    BackHandler(onBack = onDismiss)
    Box(Modifier.matchParentSize().pointerInput(Unit) { detectTapGestures { onDismiss() } })
    Surface(
        color = OttlibColors.Surface.copy(alpha = 0.96f),
        modifier = Modifier.align(Alignment.CenterEnd).fillMaxHeight().widthIn(max = PANEL_WIDTH).fillMaxWidth(),
    ) {
        LazyColumn(
            Modifier.windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.End + WindowInsetsSides.Vertical)),
            contentPadding = PaddingValues(vertical = 8.dp),
        ) {
            item { ListItem(headlineContent = { Text(title, style = MaterialTheme.typography.titleLarge) }, colors = PanelRowColors) }
            content()
        }
    }
}

@Composable
fun PanelHeading(text: String) {
    ListItem(headlineContent = { Text(text, style = MaterialTheme.typography.titleSmall, color = OttlibColors.Accent) }, colors = PanelRowColors)
}

@Composable
fun PanelOption(label: String, selected: Boolean, supporting: String? = null, onClick: () -> Unit) {
    ListItem(
        headlineContent = { Text(label) },
        supportingContent = supporting?.let { { Text(it) } },
        leadingContent = { RadioButton(selected = selected, onClick = null) },
        colors = PanelRowColors,
        modifier = Modifier.selectable(selected = selected, role = Role.RadioButton, onClick = onClick),
    )
}

/** Rows sit directly on the panel's surface. */
val PanelRowColors @Composable get() = ListItemDefaults.colors(containerColor = Color.Transparent)

private val PANEL_WIDTH = 380.dp
