package dev.ottlib.tv.ui.player

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Button
import androidx.tv.material3.DenseListItem
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.SurfaceDefaults
import androidx.tv.material3.Text
import dev.ottlib.core.presentation.player.SubtitleSearchController
import dev.ottlib.core.presentation.player.SubtitleSearchState
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.tv.ui.components.TvTextField
import dev.ottlib.tv.ui.components.tryRequestFocus

@Composable
fun SubtitlePanel(state: SubtitleSearchState, controller: SubtitleSearchController, onRetry: () -> Unit, onDismiss: () -> Unit, modifier: Modifier = Modifier) {
    val initial = remember { FocusRequester() }
    BackHandler(onBack = onDismiss)
    Surface(modifier.fillMaxHeight().width(520.dp).focusGroup().focusProperties { onExit = { cancelFocusChange() } },
        colors = SurfaceDefaults.colors(containerColor = OttlibColors.Surface.copy(alpha = 0.97f))) {
        Column(Modifier.padding(24.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Find subtitles", style = MaterialTheme.typography.headlineSmall)
            Button(onClick = onDismiss, modifier = Modifier.focusRequester(initial)) { Text("Close") }
            if (state.loading) Text("Loading subtitle services…")
            if (state.options == null && !state.loading) Button(onClick = onRetry) { Text("Retry") }
            if (state.options != null && !state.configured) Text("Add an OpenSubtitles or SubDL API key in the web app’s Settings.")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("auto" to "Auto", "filename" to "Filename", "manual" to "Title").forEach { (mode, label) ->
                    Button(onClick = { controller.edit { it.copy(mode = mode) } }, enabled = !state.busy) {
                        Text(if (state.mode == mode) "✓ $label" else label)
                    }
                }
            }
            if (state.mode == "manual") {
                Text("Title")
                TvTextField(state.query, { value -> controller.edit { it.copy(query = value) } }, "Enter title", Modifier.fillMaxWidth())
            }
            if (state.mode == "filename") Text(state.filename, color = OttlibColors.Muted)
            Text("Year / Season / Episode (optional)")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TvTextField(state.year, { value -> controller.edit { it.copy(year = value) } }, "Year", Modifier.weight(1f))
                TvTextField(state.season, { value -> controller.edit { it.copy(season = value) } }, "Season", Modifier.weight(1f))
                TvTextField(state.episode, { value -> controller.edit { it.copy(episode = value) } }, "Episode", Modifier.weight(1f))
            }
            Text("Languages (comma-separated codes)")
            TvTextField(state.languages, { value -> controller.edit { it.copy(languages = value) } }, "en, hi, ta", Modifier.fillMaxWidth())
            state.options?.languages?.take(8)?.chunked(2)?.forEach { pair ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    pair.forEach { language ->
                        val selected = language.code in state.languageCodes
                        Button(onClick = { controller.edit { it.copy(languages = (if (selected) it.languageCodes - language.code else it.languageCodes + language.code).joinToString(", ")) } }, enabled = !state.busy, modifier = Modifier.weight(1f)) {
                            Text(if (selected) "✓ ${language.name}" else language.name)
                        }
                    }
                }
            }
            Button(onClick = controller::search, enabled = state.configured && !state.busy) { Text(if (state.searching) "Searching…" else "Search subtitles") }
            state.error?.let { Text(it, color = OttlibColors.Error) }
            state.message?.let { Text(it, color = OttlibColors.Accent) }
            state.warnings.forEach { Text(it, color = OttlibColors.Muted) }
            if (state.searched && state.results.isEmpty()) Text("No matching subtitles. Try the filename or enter a title.")
            state.results.forEach { result ->
                DenseListItem(selected = result.downloaded, enabled = !state.busy, onClick = { controller.download(result) },
                    headlineContent = { Text("${state.languageName(result.language)} · ${result.provider}") },
                    supportingContent = { Text(listOf(result.releaseName,
                        listOf(result.format.uppercase(), if (result.hashMatch) "File hash match" else if (result.score >= 0.9) "Release match" else "",
                            if (result.hearingImpaired) "SDH" else "", if (result.forced) "Forced" else "").filter(String::isNotBlank).joinToString(" · "),
                        if (state.downloading == result.id) "Downloading…" else if (result.downloaded) "Use saved subtitle" else "Download & use").joinToString("\n")) })
            }
        }
    }
    LaunchedEffect(Unit) { repeat(10) { withFrameNanos { }; initial.tryRequestFocus() } }
}
