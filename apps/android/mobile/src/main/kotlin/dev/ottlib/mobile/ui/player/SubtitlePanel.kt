package dev.ottlib.mobile.ui.player

import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.ottlib.core.presentation.player.SubtitleSearchController
import dev.ottlib.core.presentation.player.SubtitleSearchState
import dev.ottlib.core.presentation.theme.OttlibColors

@Composable
fun BoxScope.SubtitlePanel(state: SubtitleSearchState, controller: SubtitleSearchController, onRetry: () -> Unit, onDismiss: () -> Unit) {
    PlayerPanel("Find subtitles", onDismiss) {
        item { Button(onClick = onDismiss, modifier = Modifier.padding(horizontal = 16.dp)) { Text("Close") } }
        if (state.loading) item { PanelHeading("Loading subtitle services…") }
        if (state.options == null && !state.loading) item { Button(onClick = onRetry, modifier = Modifier.padding(16.dp)) { Text("Retry") } }
        if (state.options != null && !state.configured) item { Text("Add an OpenSubtitles or SubDL API key in the web app’s Settings.", modifier = Modifier.padding(16.dp)) }
        item {
            Row(Modifier.padding(horizontal = 16.dp).horizontalScroll(rememberScrollState())) {
                listOf("auto" to "Automatic", "filename" to "Filename", "manual" to "Enter title").forEach { (mode, label) ->
                    FilterChip(selected = state.mode == mode, onClick = { controller.edit { it.copy(mode = mode) } }, enabled = !state.busy, label = { Text(label) })
                }
            }
        }
        if (state.mode == "manual") item { SubtitleField("Title", state.query, state.busy) { value -> controller.edit { it.copy(query = value) } } }
        if (state.mode == "filename") item { Text(state.filename, modifier = Modifier.padding(16.dp), color = OttlibColors.Muted) }
        item { SubtitleField("Year (optional)", state.year, state.busy) { value -> controller.edit { it.copy(year = value) } } }
        item { SubtitleField("Season (optional)", state.season, state.busy) { value -> controller.edit { it.copy(season = value) } } }
        item { SubtitleField("Episode (optional)", state.episode, state.busy) { value -> controller.edit { it.copy(episode = value) } } }
        item { SubtitleField("Languages: en, hi, ta…", state.languages, state.busy) { value -> controller.edit { it.copy(languages = value) } } }
        item {
            Row(Modifier.padding(horizontal = 16.dp).horizontalScroll(rememberScrollState())) {
                state.options?.languages?.take(8)?.forEach { language ->
                    val selected = language.code in state.languageCodes
                    FilterChip(selected = selected, enabled = !state.busy, onClick = { controller.edit {
                        it.copy(languages = (if (selected) it.languageCodes - language.code else it.languageCodes + language.code).joinToString(", "))
                    } }, label = { Text(language.name) })
                }
            }
        }
        item { Button(onClick = controller::search, enabled = state.configured && !state.busy, modifier = Modifier.padding(16.dp)) { Text(if (state.searching) "Searching…" else "Search subtitles") } }
        state.error?.let { error -> item { Text(error, color = OttlibColors.Error, modifier = Modifier.padding(16.dp)) } }
        state.message?.let { message -> item { Text(message, color = OttlibColors.Accent, modifier = Modifier.padding(16.dp)) } }
        state.warnings.forEach { warning -> item { Text(warning, modifier = Modifier.padding(16.dp)) } }
        if (state.searched && state.results.isEmpty()) item { Text("No matching subtitles. Try the filename or enter a title.", modifier = Modifier.padding(16.dp)) }
        items(state.results, key = { it.id }) { result ->
            Button(onClick = { controller.download(result) }, enabled = !state.busy, modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp).fillMaxWidth()) {
                Text(listOf(
                    "${state.languageName(result.language)} · ${result.provider}", result.releaseName,
                    listOf(result.format.uppercase(), if (result.hashMatch) "File hash match" else if (result.score >= 0.9) "Release match" else "",
                        if (result.hearingImpaired) "SDH" else "", if (result.forced) "Forced" else "").filter(String::isNotBlank).joinToString(" · "),
                    if (state.downloading == result.id) "Downloading…" else if (result.downloaded) "Use saved subtitle" else "Download & use",
                ).joinToString("\n"))
            }
        }
    }
}

@Composable
private fun SubtitleField(label: String, value: String, busy: Boolean, onChange: (String) -> Unit) {
    OutlinedTextField(value = value, onValueChange = onChange, label = { Text(label) }, singleLine = true,
        enabled = !busy, modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp).fillMaxWidth())
}
