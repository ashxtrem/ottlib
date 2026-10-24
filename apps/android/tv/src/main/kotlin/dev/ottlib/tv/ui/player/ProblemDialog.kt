package dev.ottlib.tv.ui.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.OutlinedButton
import androidx.tv.material3.Surface
import androidx.tv.material3.SurfaceDefaults
import androidx.tv.material3.Text
import dev.ottlib.core.presentation.player.PlaybackProblem
import dev.ottlib.core.presentation.player.choices
import dev.ottlib.core.presentation.player.offersServerFallback
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.tv.ui.components.tryRequestFocus

/**
 * Asks the viewer what to do when the built-in player can't play something. The choices are a column (D-pad up/down);
 * the first one, "Play via server" when offered, takes focus.
 */
@Composable
fun ProblemDialog(problem: PlaybackProblem, onContinue: () -> Unit, onRetry: () -> Unit, onPlayViaServer: () -> Unit, onExternal: () -> Unit, onExit: () -> Unit) {
    val focus = remember { FocusRequester() }
    val choices = problem.choices
    val viaServer = problem.offersServerFallback
    Dialog(onDismissRequest = if (choices is PlaybackProblem.Error) onExit else onContinue) {
        Surface(shape = RoundedCornerShape(16.dp), colors = SurfaceDefaults.colors(containerColor = OttlibColors.Surface)) {
            Column(Modifier.width(620.dp).padding(28.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                Text(problem.message, style = MaterialTheme.typography.titleMedium, color = OttlibColors.Foreground)
                Text(
                    if (viaServer) "“Play via server” has the server convert the file for this device. “Play in another app” hands the stream to a player like VLC."
                    else "“Play in another app” hands the stream to a player like VLC.",
                    style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Muted,
                )
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    val wide = Modifier.fillMaxWidth()
                    if (viaServer) Button(onClick = onPlayViaServer, modifier = wide.focusRequester(focus)) { Text("Play via server") }
                    val external = if (viaServer) wide else wide.focusRequester(focus)
                    if (viaServer) OutlinedButton(onClick = onExternal, modifier = external) { Text("Play in another app") }
                    else Button(onClick = onExternal, modifier = external) { Text("Play in another app") }
                    when (choices) {
                        is PlaybackProblem.Error -> OutlinedButton(onClick = onRetry, modifier = wide) { Text("Retry") }
                        is PlaybackProblem.UnsupportedAudio -> OutlinedButton(onClick = onContinue, modifier = wide) { Text("Watch without sound") }
                        is PlaybackProblem.UnsupportedVideo, is PlaybackProblem.ServerUnavailable -> Unit
                    }
                    OutlinedButton(onClick = onExit, modifier = wide) { Text("Back") }
                }
            }
        }
    }
    LaunchedEffect(problem) { focus.tryRequestFocus() }
}
