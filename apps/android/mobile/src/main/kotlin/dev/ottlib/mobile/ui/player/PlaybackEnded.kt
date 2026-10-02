package dev.ottlib.mobile.ui.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import dev.ottlib.core.model.Movie
import dev.ottlib.core.presentation.player.nextLabel
import dev.ottlib.core.presentation.theme.OttlibColors

@Composable
fun PlaybackEnded(next: Movie?, posterUrl: String?, warning: String?, error: String?, onRetry: () -> Unit, onPlay: (Long) -> Unit, onDetails: (Long) -> Unit, onClose: () -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically)) {
        Text("Playback finished", color = OttlibColors.Foreground)
        if (next != null) {
            AsyncImage(posterUrl, contentDescription = null, modifier = Modifier.height(160.dp))
            Text(next.nextLabel(), color = OttlibColors.Muted)
            Text(next.title, color = OttlibColors.Foreground)
            warning?.let { Text(it, color = OttlibColors.Muted) }
            Button(onClick = { onPlay(next.id) }) { Text(if ((next.resumePositionMs ?: 0) > 0) "Resume next" else "Play next") }
            OutlinedButton(onClick = { onDetails(next.id) }) { Text("View details") }
        }
        if (error != null) {
            Text(error, color = OttlibColors.Error)
            Button(onClick = onRetry) { Text("Retry saving") }
        }
        OutlinedButton(onClick = onClose) { Text("Close") }
    }
}
