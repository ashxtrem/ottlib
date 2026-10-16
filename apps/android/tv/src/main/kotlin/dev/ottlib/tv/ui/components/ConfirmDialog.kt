package dev.ottlib.tv.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.tv.material3.Button
import androidx.tv.material3.ButtonDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.OutlinedButton
import androidx.tv.material3.Surface
import androidx.tv.material3.SurfaceDefaults
import androidx.tv.material3.Text
import dev.ottlib.core.presentation.theme.OttlibColors

/**
 * A yes/no question for something that cannot be undone. Focus starts on Cancel, so pressing OK on the
 * remote without looking never confirms; [onDismiss] (Back) is also a cancel.
 */
@Composable
fun ConfirmDialog(title: String, message: String, confirmLabel: String, onConfirm: () -> Unit, onDismiss: () -> Unit, details: String? = null, busy: Boolean = false) {
    val cancelFocus = remember { FocusRequester() }
    Dialog(onDismissRequest = { if (!busy) onDismiss() }) {
        Surface(shape = RoundedCornerShape(16.dp), colors = SurfaceDefaults.colors(containerColor = OttlibColors.Surface)) {
            Column(Modifier.width(620.dp).padding(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(title, style = MaterialTheme.typography.headlineSmall, color = OttlibColors.Foreground)
                Text(message, style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Error)
                details?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Muted) }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 8.dp)) {
                    OutlinedButton(onClick = onDismiss, enabled = !busy, modifier = Modifier.focusRequester(cancelFocus)) { Text("Cancel") }
                    Button(
                        onClick = onConfirm,
                        enabled = !busy,
                        colors = ButtonDefaults.colors(containerColor = OttlibColors.Error, contentColor = OttlibColors.Canvas, focusedContainerColor = OttlibColors.Error, focusedContentColor = OttlibColors.Canvas),
                    ) { Text(if (busy) "Deleting…" else confirmLabel) }
                }
            }
        }
    }
    LaunchedEffect(Unit) { cancelFocus.tryRequestFocus() }
}
