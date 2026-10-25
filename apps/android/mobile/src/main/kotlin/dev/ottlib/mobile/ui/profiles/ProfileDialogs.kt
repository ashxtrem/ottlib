package dev.ottlib.mobile.ui.profiles

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import dev.ottlib.core.model.PROFILE_COLORS
import dev.ottlib.core.model.ProfileSummary
import dev.ottlib.core.presentation.profiles.isCompletePin
import dev.ottlib.core.presentation.profiles.profileColor
import dev.ottlib.core.presentation.theme.OttlibColors

/** Add a profile ([target] null, starting on [initialColor]) or rename / recolour [target]. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ProfileFormDialog(target: ProfileSummary?, initialColor: String, busy: Boolean, error: String?, onSave: (name: String, color: String) -> Unit, onDismiss: () -> Unit) {
    var name by rememberSaveable { mutableStateOf(target?.name ?: "") }
    var color by rememberSaveable { mutableStateOf(target?.color ?: initialColor) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (target == null) "Add profile" else "Edit ${target.name}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it.take(40) }, label = { Text("Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Text("Colour", style = MaterialTheme.typography.labelLarge)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    PROFILE_COLORS.forEach { swatch -> ColorSwatch(swatch, selected = swatch.equals(color, ignoreCase = true)) { color = swatch } }
                }
                DialogError(error)
            }
        },
        confirmButton = { TextButton(onClick = { onSave(name, color) }, enabled = !busy && name.isNotBlank()) { Text(if (busy) "Saving…" else "Save") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun ColorSwatch(hex: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .size(40.dp)
            .border(if (selected) 3.dp else 0.dp, if (selected) Color.White else Color.Transparent, CircleShape)
            .background(profileColor(hex), CircleShape)
            .semantics { this.selected = selected; contentDescription = "Colour $hex" }
            .clickable(role = Role.RadioButton, onClick = onClick),
    )
}

/** Set, change or remove [target]'s PIN; the current PIN is asked first when [fields] say so (your own PIN). */
@Composable
fun ProfilePinDialog(
    target: ProfileSummary,
    fields: PinDialogFields,
    busy: Boolean,
    error: String?,
    onSave: (pin: String, currentPin: String?) -> Unit,
    onClear: (currentPin: String?) -> Unit,
    onDismiss: () -> Unit,
) {
    var current by rememberSaveable { mutableStateOf("") }
    var pin by rememberSaveable { mutableStateOf("") }
    var confirm by rememberSaveable { mutableStateOf("") }
    val currentPin = current.takeIf { fields.askCurrentPin }
    val hasCurrent = !fields.askCurrentPin || current.isNotEmpty()
    val mismatch = confirm.isNotEmpty() && confirm != pin
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(fields.title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (fields.askCurrentPin) PinField("Current PIN", current) { current = it }
                PinField(if (target.hasPin) "New PIN" else "PIN", pin) { pin = it }
                PinField("Confirm PIN", confirm) { confirm = it }
                Text(
                    if (mismatch) "The PINs don't match." else "4 to 8 digits.",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (mismatch) OttlibColors.Error else OttlibColors.Muted,
                )
                DialogError(error)
            }
        },
        confirmButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                if (fields.canClear) TextButton(onClick = { onClear(currentPin) }, enabled = !busy && hasCurrent) { Text("Remove PIN", color = OttlibColors.Error) }
                TextButton(
                    onClick = { onSave(pin, currentPin) },
                    enabled = fields.canSet && !busy && hasCurrent && isCompletePin(pin) && pin == confirm,
                ) { Text(if (busy) "Saving…" else "Save") }
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun PinField(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = { onChange(it.filter(Char::isDigit).take(8)) },
        label = { Text(label) },
        singleLine = true,
        visualTransformation = PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
        modifier = Modifier.fillMaxWidth(),
    )
}

/** Asks before deleting; Cancel is the safe default. */
@Composable
fun ProfileDeleteDialog(target: ProfileSummary, busy: Boolean, error: String?, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Delete ${target.name}?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "This removes the profile with its watch progress, watched titles, hidden titles and play history. Movies, shelves and settings are not touched.",
                    color = OttlibColors.Muted,
                )
                DialogError(error)
            }
        },
        confirmButton = { TextButton(onClick = onConfirm, enabled = !busy) { Text(if (busy) "Deleting…" else "Delete profile", color = OttlibColors.Error) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun DialogError(error: String?) {
    error?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Error) }
}
