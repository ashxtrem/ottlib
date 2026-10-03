package dev.ottlib.tv.ui.details

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.tv.material3.Button
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.OutlinedButton
import androidx.tv.material3.Surface
import androidx.tv.material3.SurfaceDefaults
import androidx.tv.material3.Text
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.ottlib.core.model.Movie
import dev.ottlib.core.presentation.metadata.MetadataViewModel
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.tv.ui.components.TvTextField
import dev.ottlib.tv.ui.components.tryRequestFocus

@Composable
fun MetadataDialog(movie: Movie, viewModel: MetadataViewModel, onDismiss: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val refresh by viewModel.refresh.state.collectAsStateWithLifecycle()
    var fixMatch by remember { mutableStateOf(movie.metadataStatus == "suggested") }
    var confirmRefresh by remember { mutableStateOf(false) }
    val first = remember { FocusRequester() }
    val close = remember { FocusRequester() }
    val busy = state.busy || refresh.running
    LaunchedEffect(Unit) { viewModel.loadSuggestions() }
    LaunchedEffect(refresh.running, refresh.movieId) {
        if (!refresh.running && refresh.movieId == movie.id) viewModel.loadSuggestions()
    }
    Dialog(onDismissRequest = {
        when {
            confirmRefresh -> confirmRefresh = false
            state.selected != null -> viewModel.clearSelection()
            else -> onDismiss()
        }
    }) {
        Surface(shape = RoundedCornerShape(16.dp), colors = SurfaceDefaults.colors(containerColor = OttlibColors.Surface)) {
            Column(Modifier.width(640.dp).heightIn(max = 560.dp).verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Manage metadata", style = MaterialTheme.typography.headlineSmall)
                Text("This title only: ${movie.title}", color = OttlibColors.Muted)
                if (refresh.running) Text(if (refresh.movieId == movie.id) "Fetching metadata for this title…" else "Another title's metadata refresh is running.")
                if (refresh.movieId == movie.id) refresh.message?.let { Text(it) }
                state.message?.let { Text(it) }
                if (state.busy) Text("Working…")
                when {
                    confirmRefresh -> {
                        Text("Fetch automatic metadata and artwork for this title? Your manual title override, watched state and playback progress are kept.")
                        Button(onClick = { confirmRefresh = false; viewModel.refreshTitle() }, enabled = !busy, modifier = Modifier.focusRequester(first)) { Text("Refresh metadata") }
                        OutlinedButton(onClick = { confirmRefresh = false }) { Text("Cancel") }
                    }
                    state.selected != null -> {
                        val candidate = requireNotNull(state.selected)
                        Text("Apply ${candidate.title}${candidate.year?.let { " ($it)" }.orEmpty()}?", style = MaterialTheme.typography.titleLarge)
                        if (candidate.mediaType == "tv") {
                            Text("Choose the season and episode for this file.", color = OttlibColors.Muted)
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                TvTextField(state.season, { if (!busy) viewModel.season(it) }, "Season", modifier = Modifier.weight(1f).focusRequester(first), keyboardType = KeyboardType.Number)
                                TvTextField(state.episode, { if (!busy) viewModel.episode(it) }, "Episode", modifier = Modifier.weight(1f), keyboardType = KeyboardType.Number)
                            }
                        }
                        Button(onClick = viewModel::accept, enabled = !busy, modifier = if (candidate.mediaType == "tv") Modifier else Modifier.focusRequester(first)) { Text("Apply match to this title") }
                        OutlinedButton(onClick = viewModel::clearSelection, enabled = !busy) { Text("Back to results") }
                    }
                    fixMatch -> {
                        Text("File: ${movie.rawFilename}", color = OttlibColors.Muted)
                        TvTextField(state.title, { if (!busy) viewModel.title(it) }, "Search title", modifier = Modifier.fillMaxWidth().focusRequester(first), onSubmit = viewModel::search)
                        Button(onClick = viewModel::search, enabled = !busy && state.title.isNotBlank()) { Text("Find matches") }
                        TvTextField(state.imdb, { if (!busy) viewModel.imdb(it) }, "IMDb ID or link", modifier = Modifier.fillMaxWidth(), onSubmit = viewModel::lookupImdb)
                        OutlinedButton(onClick = viewModel::lookupImdb, enabled = !busy && state.imdb.isNotBlank()) { Text("Fetch from IMDb") }
                        if (state.candidates.isNotEmpty()) {
                            Text("Choose the correct match. Details are saved when you apply it.", color = OttlibColors.Muted)
                            state.candidates.forEach { candidate ->
                                OutlinedButton(onClick = { viewModel.select(candidate) }, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                                    Text("${candidate.title}${candidate.year?.let { " ($it)" }.orEmpty()} · ${if (candidate.mediaType == "tv") "TV" else "Movie"} · ${candidate.provider.uppercase()}")
                                }
                            }
                            OutlinedButton(onClick = viewModel::reject, enabled = !busy) { Text("None of these") }
                        }
                        OutlinedButton(onClick = { fixMatch = false }, enabled = !busy) { Text("Back to metadata actions") }
                    }
                    else -> {
                        OutlinedButton(onClick = { confirmRefresh = true }, enabled = !busy, modifier = Modifier.focusRequester(first)) { Text("Refresh metadata") }
                        Text("Refresh updates the current match. Use Fix match to correct the wrong movie or show.", color = OttlibColors.Muted)
                        OutlinedButton(onClick = { fixMatch = true }, enabled = !busy) { Text(if (state.candidates.isNotEmpty()) "Review / fix match" else "Fix match") }
                    }
                }
                OutlinedButton(onClick = onDismiss, modifier = Modifier.focusRequester(close)) { Text("Close") }
            }
        }
    }
    LaunchedEffect(fixMatch, state.selected, confirmRefresh, busy) {
        if (busy) close.tryRequestFocus() else first.tryRequestFocus()
    }
}
