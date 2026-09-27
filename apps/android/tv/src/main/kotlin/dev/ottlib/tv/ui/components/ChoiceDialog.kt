package dev.ottlib.tv.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.tv.material3.Icon
import androidx.tv.material3.ListItem
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.SurfaceDefaults
import androidx.tv.material3.Text
import dev.ottlib.tv.ui.theme.OttlibColors

data class Choice<T>(val label: String, val value: T)

/** A single-choice list in a dialog; focus starts on the current selection. */
@Composable
fun <T> ChoiceDialog(title: String, choices: List<Choice<T>>, selected: T, onSelect: (T) -> Unit, onDismiss: () -> Unit) {
    val focus = remember { FocusRequester() }
    val selectedIndex = choices.indexOfFirst { it.value == selected }.coerceAtLeast(0)
    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(16.dp), colors = SurfaceDefaults.colors(containerColor = OttlibColors.Surface)) {
            Column(Modifier.width(520.dp).padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(title, style = MaterialTheme.typography.headlineSmall, color = OttlibColors.Foreground)
                LazyColumn(Modifier.heightIn(max = 480.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    itemsIndexed(choices) { index, choice ->
                        ListItem(
                            selected = index == selectedIndex,
                            onClick = { onSelect(choice.value); onDismiss() },
                            headlineContent = { Text(choice.label) },
                            trailingContent = if (index == selectedIndex) ({ Icon(Icons.Filled.Check, contentDescription = "Selected") }) else null,
                            modifier = if (index == selectedIndex) Modifier.focusRequester(focus) else Modifier,
                        )
                    }
                }
            }
        }
    }
    LaunchedEffect(Unit) { focus.tryRequestFocus() }
}
