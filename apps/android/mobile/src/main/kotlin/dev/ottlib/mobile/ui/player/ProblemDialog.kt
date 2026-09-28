package dev.ottlib.mobile.ui.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import dev.ottlib.core.presentation.player.PlaybackProblem
import dev.ottlib.core.presentation.theme.OttlibColors

/** Asks the viewer what to do when the built-in player can't play something. */
@Composable
fun ProblemDialog(problem: PlaybackProblem, onContinue: () -> Unit, onRetry: () -> Unit, onExternal: () -> Unit, onExit: () -> Unit) {
    AlertDialog(
        onDismissRequest = if (problem is PlaybackProblem.Error) onExit else onContinue,
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(problem.message, style = MaterialTheme.typography.titleMedium)
                Text("“Play in another app” hands the stream to a player like VLC.", style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Muted)
            }
        },
        confirmButton = { Button(onClick = onExternal) { Text("Play in another app") } },
        dismissButton = {
            when (problem) {
                is PlaybackProblem.Error -> TextButton(onClick = onRetry) { Text("Retry") }
                is PlaybackProblem.UnsupportedAudio -> TextButton(onClick = onContinue) { Text("Watch without sound") }
                is PlaybackProblem.UnsupportedVideo -> TextButton(onClick = onExit) { Text("Back") }
            }
        },
    )
}
