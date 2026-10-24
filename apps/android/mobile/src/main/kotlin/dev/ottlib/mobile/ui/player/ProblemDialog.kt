package dev.ottlib.mobile.ui.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.ottlib.core.presentation.player.PlaybackProblem
import dev.ottlib.core.presentation.player.choices
import dev.ottlib.core.presentation.player.offersServerFallback
import dev.ottlib.core.presentation.theme.OttlibColors

/**
 * Asks the viewer what to do when the built-in player can't play something. AlertDialog has only two button slots, so
 * the choices are a vertical list in the content (scrolls on a short screen such as the cover screen or tabletop half).
 */
@Composable
fun ProblemDialog(problem: PlaybackProblem, onContinue: () -> Unit, onRetry: () -> Unit, onPlayViaServer: () -> Unit, onExternal: () -> Unit, onExit: () -> Unit) {
    val choices = problem.choices
    val viaServer = problem.offersServerFallback
    AlertDialog(
        onDismissRequest = if (choices is PlaybackProblem.Error) onExit else onContinue,
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(problem.message, style = MaterialTheme.typography.titleMedium)
                Text(
                    if (viaServer) "“Play via server” has the server convert the file for this device. “Play in another app” hands the stream to a player like VLC."
                    else "“Play in another app” hands the stream to a player like VLC.",
                    style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Muted,
                )
                val wide = Modifier.fillMaxWidth()
                if (viaServer) Button(onClick = onPlayViaServer, modifier = wide) { Text("Play via server") }
                if (viaServer) OutlinedButton(onClick = onExternal, modifier = wide) { Text("Play in another app") }
                else Button(onClick = onExternal, modifier = wide) { Text("Play in another app") }
                when (choices) {
                    is PlaybackProblem.Error -> OutlinedButton(onClick = onRetry, modifier = wide) { Text("Retry") }
                    is PlaybackProblem.UnsupportedAudio -> OutlinedButton(onClick = onContinue, modifier = wide) { Text("Watch without sound") }
                    is PlaybackProblem.UnsupportedVideo, is PlaybackProblem.ServerUnavailable -> Unit
                }
                TextButton(onClick = onExit, modifier = wide) { Text("Back") }
            }
        },
        confirmButton = {},
    )
}
