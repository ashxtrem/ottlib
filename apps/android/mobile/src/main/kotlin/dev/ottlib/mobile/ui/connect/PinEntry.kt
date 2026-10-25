package dev.ottlib.mobile.ui.connect

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import dev.ottlib.core.presentation.theme.OttlibColors

/**
 * A PIN step: the server's access PIN (instead of the server picker) or a profile's PIN (instead of the profile
 * tiles). [key] names what the PIN is for, so a new target starts with an empty field. Back calls [onCancel].
 */
@Composable
fun PinEntry(
    title: String,
    message: String,
    key: String,
    checking: Boolean,
    error: String?,
    onSubmit: (String) -> Unit,
    onCancel: () -> Unit,
    cancelLabel: String,
    modifier: Modifier = Modifier,
) {
    var pin by rememberSaveable(key) { mutableStateOf("") }
    BackHandler(onBack = onCancel)
    LaunchedEffect(error) { if (error != null) pin = "" }

    Column(modifier.widthIn(max = 480.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text(
            message,
            style = MaterialTheme.typography.bodyLarge,
            color = OttlibColors.Muted,
        )
        OutlinedTextField(
            value = pin,
            onValueChange = { pin = it.filter(Char::isDigit).take(8) },
            placeholder = { Text("PIN") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Go),
            keyboardActions = KeyboardActions(onGo = { onSubmit(pin) }),
            modifier = Modifier.fillMaxWidth(),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(onClick = { onSubmit(pin) }, enabled = !checking && pin.length >= 4) { Text(if (checking) "Checking…" else "Unlock") }
            TextButton(onClick = onCancel) { Text(cancelLabel) }
        }
        error?.let { Text(it, style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Error) }
    }
}
