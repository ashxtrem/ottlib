package dev.ottlib.mobile.ui.details

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Replay
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import dev.ottlib.core.model.Movie
import dev.ottlib.core.presentation.player.nextLabel
import dev.ottlib.core.presentation.player.episodeGapAfter
import dev.ottlib.core.presentation.describe
import dev.ottlib.core.presentation.formatPosition
import dev.ottlib.core.presentation.formatRemaining
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.mobile.ui.components.ProgressBar

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ActionButtons(movie: Movie, busy: Boolean, actions: DetailsActions, fillWidth: Boolean) {
    val resume = movie.resumePositionMs?.takeIf { it > 0 }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Button(onClick = { actions.onPlay(false) }, enabled = !movie.missing, modifier = if (fillWidth) Modifier.fillMaxWidth() else Modifier) {
            Icon(Icons.Filled.PlayArrow, contentDescription = null)
            Text(if (resume != null) "Resume from ${formatPosition(resume)}" else "Play", modifier = Modifier.padding(start = 8.dp))
        }
        if (resume != null) {
            val duration = movie.mediaInfo?.durationMs
            duration?.takeIf { it > 0 }?.let { ProgressBar((resume.toFloat() / it).coerceIn(0f, 1f), Modifier.padding(horizontal = 2.dp)) }
            formatRemaining(resume, duration)?.let { Text(it, style = MaterialTheme.typography.labelMedium, color = OttlibColors.Muted) }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            if (resume != null) SecondaryButton("From start", Icons.Filled.Replay, enabled = !movie.missing) { actions.onPlay(true) }
            SecondaryButton(
                if (movie.watched) "Watched" else "Mark watched",
                if (movie.watched) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked,
                enabled = !busy,
                onClick = actions.onToggleWatched,
            )
            SecondaryButton("Other app", Icons.AutoMirrored.Filled.OpenInNew, enabled = !movie.missing, onClick = actions.onPlayElsewhere)
        }
        if (movie.resumePositionMs != null) TextButton(onClick = actions.onClearProgress, enabled = !busy) { Text("Remove from Continue watching") }
        actions.nextMovie?.let { next ->
            Text("${next.nextLabel()}: ${next.title}", style = MaterialTheme.typography.titleMedium)
            next.episodeGapAfter(movie)?.let { Text(it, color = OttlibColors.Muted) }
            OutlinedButton(onClick = actions.onPlayNext) { Text("Play next") }
        }
        if (movie.missing) Text("This file is unavailable on the server (it may be on a disconnected drive).", style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Error)
    }
}

@Composable
private fun SecondaryButton(label: String, icon: ImageVector, enabled: Boolean, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, enabled = enabled) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
        Text(label, modifier = Modifier.padding(start = 6.dp))
    }
}

@Composable
fun MovieInfo(movie: Movie) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        movie.overview?.let { Text(it, style = MaterialTheme.typography.bodyLarge) }
        if (movie.cast.isNotEmpty()) Text("Starring ${movie.cast.take(6).joinToString(", ")}", style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Muted)
        TechnicalDetails(movie)
    }
}

@Composable
private fun TechnicalDetails(movie: Movie) {
    val info = movie.mediaInfo ?: return
    val audio = info.tracks.filter { it.isAudio }
    val subtitles = info.tracks.filter { it.isSubtitle }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        val video = listOfNotNull(info.videoCodec, info.videoProfile, info.width?.let { w -> info.height?.let { h -> "${w}×$h" } }, info.hdrFormat, info.container).joinToString(" · ")
        if (video.isNotEmpty()) DetailLine("Video", video)
        if (audio.isNotEmpty()) DetailLine("Audio", audio.joinToString("\n") { it.describe() })
        if (subtitles.isNotEmpty()) DetailLine("Subtitles", subtitles.joinToString("\n") { it.describe() })
    }
}

@Composable
private fun DetailLine(label: String, value: String) {
    Column {
        Text(label, style = MaterialTheme.typography.labelMedium, color = OttlibColors.Foreground)
        Text(value, style = MaterialTheme.typography.bodySmall, color = OttlibColors.Muted)
    }
}
