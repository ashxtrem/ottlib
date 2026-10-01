package dev.ottlib.tv.ui.connect

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Button
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.tv.ui.components.ScreenPadding
import dev.ottlib.tv.ui.components.TvTextField
import dev.ottlib.tv.ui.components.tryRequestFocus

/** Shown instead of the server picker when the chosen server has an access PIN. Back returns to the picker. */
@Composable
fun PinEntry(server: String, checking: Boolean, error: String?, onSubmit: (String) -> Unit, onCancel: () -> Unit) {
    var pin by rememberSaveable(server) { mutableStateOf("") }
    val focus = remember { FocusRequester() }
    BackHandler(onBack = onCancel)
    LaunchedEffect(error) { if (error != null) pin = "" }

    Column(Modifier.fillMaxSize().padding(ScreenPadding), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Text("Enter access PIN", style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold, color = OttlibColors.Foreground)
        Text(
            "The Ottlib server at $server is protected. Enter the PIN set in the web app under Settings → Access PIN.",
            style = MaterialTheme.typography.bodyLarge,
            color = OttlibColors.Muted,
        )
        TvTextField(
            value = pin,
            onValueChange = { pin = it.filter(Char::isDigit).take(8) },
            placeholder = "PIN",
            keyboardType = KeyboardType.NumberPassword,
            imeAction = ImeAction.Go,
            onSubmit = { onSubmit(pin) },
            secret = true,
            modifier = Modifier.width(420.dp).focusRequester(focus),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Button(onClick = { onSubmit(pin) }, enabled = !checking && pin.length >= 4) { Text("Unlock") }
            Button(onClick = onCancel) { Text("Choose another server") }
        }
        if (checking) Text("Checking…", style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Accent)
        error?.let { Text(it, style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Error) }
    }

    LaunchedEffect(Unit) { focus.tryRequestFocus() }
}
