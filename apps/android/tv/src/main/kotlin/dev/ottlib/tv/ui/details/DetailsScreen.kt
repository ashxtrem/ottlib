package dev.ottlib.tv.ui.details

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.Button
import androidx.tv.material3.Icon
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.OutlinedButton
import androidx.tv.material3.Text
import dev.ottlib.core.model.Movie
import dev.ottlib.core.presentation.LoadState
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.describe
import dev.ottlib.core.presentation.details.DetailsViewModel
import dev.ottlib.core.presentation.formatPosition
import dev.ottlib.core.presentation.metaLine
import dev.ottlib.core.presentation.openInExternalPlayer
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.tv.ui.components.AmbientBackdrop
import dev.ottlib.tv.ui.components.ErrorMessage
import dev.ottlib.tv.ui.components.LoadingMessage
import dev.ottlib.tv.ui.components.ScreenPadding
import dev.ottlib.tv.ui.components.tryRequestFocus

@Composable
fun DetailsScreen(movieId: Long, onPlay: (id: Long, fromStart: Boolean) -> Unit, onBack: () -> Unit) {
    val container = appContainer()
    val viewModel = viewModel(key = "details-$movieId") { DetailsViewModel(container.api, container.continueWatching, container.appScope, movieId) }
    val state by viewModel.movie.collectAsStateWithLifecycle()
    val busy by viewModel.busy.collectAsStateWithLifecycle()
    LifecycleResumeEffect(viewModel) {
        viewModel.onResume()
        onPauseOrDispose { }
    }

    when (val current = state) {
        LoadState.Loading -> LoadingMessage()
        is LoadState.Failed -> ErrorMessage(current.message, actionLabel = "Back", onAction = onBack)
        is LoadState.Loaded -> MovieDetails(
            movie = current.value,
            busy = busy,
            onPlay = { fromStart -> onPlay(movieId, fromStart) },
            onToggleWatched = viewModel::toggleWatched,
            onClearProgress = viewModel::clearProgress,
            streamUrl = viewModel::streamUrl,
        )
    }
}

@Composable
private fun MovieDetails(movie: Movie, busy: Boolean, onPlay: (fromStart: Boolean) -> Unit, onToggleWatched: () -> Unit, onClearProgress: () -> Unit, streamUrl: () -> String?) {
    val container = appContainer()
    val context = LocalContext.current
    val primary = remember { FocusRequester() }
    val resume = movie.resumePositionMs?.takeIf { it > 0 }

    Box(Modifier.fillMaxSize()) {
        AmbientBackdrop(container.api.resolve(movie.backdropUrl ?: movie.posterUrl), blurred = movie.backdropUrl == null, strength = if (movie.backdropUrl != null) 0.6f else 0.35f)
        Column(
            Modifier.fillMaxHeight().fillMaxWidth(0.62f).padding(horizontal = ScreenPadding, vertical = 32.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(movie.title, style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold, color = OttlibColors.Foreground, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(movie.metaLine(), style = MaterialTheme.typography.titleMedium, color = OttlibColors.Muted)
            if (movie.genres.isNotEmpty()) Text(movie.genres.joinToString("  ·  "), style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Muted)
            movie.overview?.let { Text(it, style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Foreground, maxLines = 4, overflow = TextOverflow.Ellipsis) }

            if (movie.missing) Text("This file is unavailable on the server (it may be on a disconnected drive).", style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Error)

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 8.dp)) {
                Button(onClick = { onPlay(false) }, enabled = !movie.missing, modifier = Modifier.focusRequester(primary)) {
                    Icon(Icons.Filled.PlayArrow, contentDescription = null, modifier = Modifier.size(22.dp))
                    Text(if (resume != null) "Resume from ${formatPosition(resume)}" else "Play", modifier = Modifier.padding(start = 8.dp))
                }
                if (resume != null) OutlinedButton(onClick = { onPlay(true) }, enabled = !movie.missing) { Text("Play from start") }
                OutlinedButton(onClick = onToggleWatched, enabled = !busy) { Text(if (movie.watched) "Mark unwatched" else "Mark watched") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (resume != null) OutlinedButton(onClick = onClearProgress, enabled = !busy) { Text("Remove from Continue watching") }
                OutlinedButton(onClick = {
                    val url = streamUrl()
                    if (url == null || !openInExternalPlayer(context, url, movie.title)) Toast.makeText(context, "No other video player is installed", Toast.LENGTH_LONG).show()
                }, enabled = !movie.missing) { Text("Play in another app") }
            }

            if (movie.cast.isNotEmpty()) Text("Starring ${movie.cast.take(5).joinToString(", ")}", style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            TechnicalDetails(movie)
        }
    }
    LaunchedEffect(movie.id) { primary.tryRequestFocus() }
}

@Composable
private fun TechnicalDetails(movie: Movie) {
    val info = movie.mediaInfo ?: return
    val audio = info.tracks.filter { it.isAudio }
    val subtitles = info.tracks.filter { it.isSubtitle }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        val video = listOfNotNull(info.videoCodec, info.videoProfile, info.width?.let { w -> info.height?.let { h -> "${w}×$h" } }, info.hdrFormat, info.container).joinToString(" · ")
        if (video.isNotEmpty()) DetailLine("Video", video)
        if (audio.isNotEmpty()) DetailLine("Audio", audio.joinToString("   |   ") { it.describe() })
        if (subtitles.isNotEmpty()) DetailLine("Subtitles", subtitles.joinToString("   |   ") { it.describe() })
    }
}

@Composable
private fun DetailLine(label: String, value: String) {
    Text("$label: $value", style = MaterialTheme.typography.bodySmall, color = OttlibColors.Muted, maxLines = 2, overflow = TextOverflow.Ellipsis)
}
