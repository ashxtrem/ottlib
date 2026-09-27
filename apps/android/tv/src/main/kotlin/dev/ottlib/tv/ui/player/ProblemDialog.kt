package dev.ottlib.tv.ui.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import dev.ottlib.tv.ui.components.tryRequestFocus
import dev.ottlib.tv.ui.theme.OttlibColors

/** Asks the viewer what to do when the built-in player can't play something. */
@Composable
fun ProblemDialog(problem: PlaybackProblem, onContinue: () -> Unit, onRetry: () -> Unit, onExternal: () -> Unit, onExit: () -> Unit) {
    val focus = remember { FocusRequester() }
    Dialog(onDismissRequest = if (problem is PlaybackProblem.Error) onExit else onContinue) {
        Surface(shape = RoundedCornerShape(16.dp), colors = SurfaceDefaults.colors(containerColor = OttlibColors.Surface)) {
            Column(Modifier.width(620.dp).padding(28.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                Text(problem.message, style = MaterialTheme.typography.titleMedium, color = OttlibColors.Foreground)
                Text("“Play in another app” hands the stream to a player like VLC.", style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Muted)
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Button(onClick = onExternal, modifier = Modifier.focusRequester(focus)) { Text("Play in another app") }
                    when (problem) {
                        is PlaybackProblem.Error -> OutlinedButton(onClick = onRetry) { Text("Retry") }
                        is PlaybackProblem.UnsupportedAudio -> OutlinedButton(onClick = onContinue) { Text("Watch without sound") }
                        is PlaybackProblem.UnsupportedVideo -> Unit
                    }
                    OutlinedButton(onClick = onExit) { Text("Back") }
                }
            }
        }
    }
    LaunchedEffect(problem) { focus.tryRequestFocus() }
}
