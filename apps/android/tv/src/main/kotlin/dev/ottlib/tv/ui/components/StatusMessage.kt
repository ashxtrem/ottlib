package dev.ottlib.tv.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Button
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import dev.ottlib.core.presentation.theme.OttlibColors

@Composable
fun LoadingMessage(text: String = "Loading…", modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(text, style = MaterialTheme.typography.titleMedium, color = OttlibColors.Muted)
    }
}

/** A centered error with one focused action (Retry by default). */
@Composable
fun ErrorMessage(message: String, modifier: Modifier = Modifier, actionLabel: String = "Retry", onAction: () -> Unit) {
    val focus = remember { FocusRequester() }
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp), modifier = Modifier.widthIn(max = 640.dp)) {
            Text(message, style = MaterialTheme.typography.titleMedium, color = OttlibColors.Foreground, textAlign = TextAlign.Center)
            Button(onClick = onAction, modifier = Modifier.focusRequester(focus)) { Text(actionLabel) }
        }
    }
    LaunchedEffect(message) { focus.tryRequestFocus() }
}

@Composable
fun EmptyMessage(text: String, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize().padding(ScreenPadding), contentAlignment = Alignment.Center) {
        Text(text, style = MaterialTheme.typography.titleMedium, color = OttlibColors.Muted, textAlign = TextAlign.Center)
    }
}

/** requestFocus throws if the target has not been laid out yet; on TV a missed initial focus is recoverable. */
fun FocusRequester.tryRequestFocus() {
    runCatching { requestFocus() }
}
