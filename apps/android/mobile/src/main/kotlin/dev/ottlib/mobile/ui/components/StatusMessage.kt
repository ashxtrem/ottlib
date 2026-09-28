package dev.ottlib.mobile.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dev.ottlib.core.presentation.theme.OttlibColors

@Composable
fun LoadingMessage(modifier: Modifier = Modifier, text: String? = null) {
    Centered(modifier) {
        CircularProgressIndicator()
        text?.let { Text(it, style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Muted, textAlign = TextAlign.Center) }
    }
}

@Composable
fun ErrorMessage(message: String, modifier: Modifier = Modifier, actionLabel: String = "Retry", onAction: () -> Unit) {
    Centered(modifier) {
        Text(message, style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Error, textAlign = TextAlign.Center)
        Button(onClick = onAction) { Text(actionLabel) }
    }
}

@Composable
fun EmptyMessage(text: String, modifier: Modifier = Modifier) {
    Centered(modifier) {
        Text(text, style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Muted, textAlign = TextAlign.Center)
    }
}

@Composable
private fun Centered(modifier: Modifier, content: @Composable () -> Unit) {
    Box(modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Column(Modifier.widthIn(max = 480.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) { content() }
    }
}
