package dev.ottlib.mobile.ui.details

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.ottlib.core.model.Movie
import dev.ottlib.core.presentation.metadata.MetadataViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MetadataSheet(movie: Movie, viewModel: MetadataViewModel, onDismiss: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val refresh by viewModel.refresh.state.collectAsStateWithLifecycle()
    var fixMatch by remember { mutableStateOf(movie.metadataStatus == "suggested") }
    var confirmRefresh by remember { mutableStateOf(false) }
    val busy = state.busy || refresh.running
    LaunchedEffect(Unit) { viewModel.loadSuggestions() }
    LaunchedEffect(refresh.running, refresh.movieId) {
        if (!refresh.running && refresh.movieId == movie.id) viewModel.loadSuggestions()
    }
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(start = 24.dp, end = 24.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Metadata", style = MaterialTheme.typography.headlineSmall)
            Text("For this title only: ${movie.title}", style = MaterialTheme.typography.bodyMedium)
            if (refresh.running) Text(if (refresh.movieId == movie.id) "Fetching metadata for this title…" else "Another title's metadata refresh is running.")
            if (refresh.movieId == movie.id) refresh.message?.let { Text(it) }
            state.message?.let { Text(it) }
            if (state.busy) Text("Working…")
            OutlinedButton(onClick = { confirmRefresh = true }, enabled = !busy) { Text("Refresh metadata") }
            Text("Refresh updates the current match. To correct the wrong movie or show, use Fix match.", style = MaterialTheme.typography.bodySmall)
            OutlinedButton(onClick = { fixMatch = !fixMatch }, enabled = !busy) { Text(if (fixMatch) "Hide match search" else "Fix match") }
            if (fixMatch) {
                Text("File: ${movie.rawFilename}", style = MaterialTheme.typography.bodySmall)
                OutlinedTextField(state.title, viewModel::title, label = { Text("Search title") }, singleLine = true, enabled = !busy, modifier = Modifier.fillMaxWidth())
                Button(onClick = viewModel::search, enabled = !busy && state.title.isNotBlank()) { Text("Find matches") }
                OutlinedTextField(state.imdb, viewModel::imdb, label = { Text("IMDb ID or link") }, singleLine = true, enabled = !busy, modifier = Modifier.fillMaxWidth())
                OutlinedButton(onClick = viewModel::lookupImdb, enabled = !busy && state.imdb.isNotBlank()) { Text("Fetch from IMDb") }
            }
            if (state.candidates.isNotEmpty()) {
                Text("Choose the correct match", style = MaterialTheme.typography.titleMedium)
                Text("Details are saved when you apply a match.", style = MaterialTheme.typography.bodySmall)
                state.candidates.forEach { candidate ->
                    OutlinedButton(onClick = { viewModel.select(candidate) }, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                        Text("${candidate.title}${candidate.year?.let { " ($it)" }.orEmpty()} · ${if (candidate.mediaType == "tv") "TV" else "Movie"} · ${candidate.provider.uppercase()}")
                    }
                }
                state.selected?.let { candidate ->
                    Text("Apply: ${candidate.title}")
                    if (candidate.mediaType == "tv") {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            OutlinedTextField(state.season, viewModel::season, label = { Text("Season") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, enabled = !busy, modifier = Modifier.weight(1f))
                            OutlinedTextField(state.episode, viewModel::episode, label = { Text("Episode") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, enabled = !busy, modifier = Modifier.weight(1f))
                        }
                    }
                    Button(onClick = viewModel::accept, enabled = !busy) { Text("Apply match to this title") }
                }
                TextButton(onClick = viewModel::reject, enabled = !busy) { Text("None of these") }
            }
            TextButton(onClick = onDismiss) { Text("Close") }
        }
    }
    if (confirmRefresh) AlertDialog(
        onDismissRequest = { confirmRefresh = false },
        title = { Text("Refresh this title?") },
        text = { Text("Fetch automatic metadata and artwork for ${movie.title}. Your manual title override, watched state and playback progress are kept.") },
        confirmButton = { TextButton(onClick = { confirmRefresh = false; viewModel.refreshTitle() }, enabled = !busy) { Text("Refresh metadata") } },
        dismissButton = { TextButton(onClick = { confirmRefresh = false }) { Text("Cancel") } },
    )
}
