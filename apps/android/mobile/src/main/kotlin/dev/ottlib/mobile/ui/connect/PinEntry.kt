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

/** Shown instead of the server picker when the chosen server has an access PIN. Back returns to the picker. */
@Composable
fun PinEntry(server: String, checking: Boolean, error: String?, onSubmit: (String) -> Unit, onCancel: () -> Unit, modifier: Modifier = Modifier) {
    var pin by rememberSaveable(server) { mutableStateOf("") }
    BackHandler(onBack = onCancel)
    LaunchedEffect(error) { if (error != null) pin = "" }

    Column(modifier.widthIn(max = 480.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Enter access PIN", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text(
            "The Ottlib server at $server is protected. Enter the PIN set in the web app under Settings → Access PIN.",
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
            TextButton(onClick = onCancel) { Text("Choose another server") }
        }
        error?.let { Text(it, style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Error) }
    }
}
