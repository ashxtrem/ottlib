package dev.ottlib.mobile.ui.player

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ListItem
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import dev.ottlib.core.model.PictureMode

/** The touch version of the TV's picture panel: every picture mode, applied to the live video as soon as it's tapped. */
@Composable
fun BoxScope.PicturePanel(current: PictureMode, onChoose: (mode: PictureMode, rememberForTitle: Boolean) -> Unit, onDismiss: () -> Unit) {
    var rememberForTitle by rememberSaveable { mutableStateOf(true) }
    PlayerPanel("Picture", onDismiss) {
        items(PictureMode.entries) { mode ->
            PanelOption(mode.label, mode == current, supporting = mode.description) { onChoose(mode, rememberForTitle) }
        }
        item {
            ListItem(
                headlineContent = { Text("Remember for this title") },
                supportingContent = { Text("Otherwise the default from Settings is used next time") },
                trailingContent = { Switch(checked = rememberForTitle, onCheckedChange = { rememberForTitle = it }) },
                colors = PanelRowColors,
                modifier = Modifier.clickable { rememberForTitle = !rememberForTitle },
            )
        }
    }
}
