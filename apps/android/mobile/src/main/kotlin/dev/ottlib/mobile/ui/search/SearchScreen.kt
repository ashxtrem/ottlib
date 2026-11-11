package dev.ottlib.mobile.ui.search

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import dev.ottlib.core.presentation.theme.OttlibColors
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.ottlib.core.presentation.LoadState
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.search.SearchViewModel
import dev.ottlib.mobile.ui.components.EmptyMessage
import dev.ottlib.mobile.ui.components.LoadingMessage
import dev.ottlib.mobile.ui.components.PosterGrid
import dev.ottlib.mobile.ui.components.gutter
import dev.ottlib.mobile.ui.components.windowWidth

@Composable
fun SearchScreen(onOpenMovie: (Long) -> Unit) {
    val container = appContainer()
    val viewModel = viewModel { SearchViewModel(container.api, container.hiddenTitles.keys, container.recentSearches, container.recentSearchScope) }
    val text by viewModel.text.collectAsStateWithLifecycle()
    val results by viewModel.results.collectAsStateWithLifecycle()
    val recents by viewModel.recents.collectAsStateWithLifecycle()
    val findAvailable by container.findLauncher.available.collectAsStateWithLifecycle()
    val keyboard = LocalSoftwareKeyboardController.current
    val gutter = windowWidth().gutter
    val field = remember { FocusRequester() }

    Scaffold { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = text,
                onValueChange = viewModel::onTextChange,
                placeholder = { Text("Search your library") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                trailingIcon = {
                    if (text.isNotEmpty()) IconButton(onClick = { viewModel.onTextChange("") }) { Icon(Icons.Filled.Close, contentDescription = "Clear") }
                },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { keyboard?.hide() }),
                modifier = Modifier.fillMaxWidth().padding(horizontal = gutter, vertical = 8.dp).focusRequester(field),
            )
            when (val current = results) {
                null -> if (recents.isEmpty()) EmptyMessage("Type part of a title.")
                else RecentSearches(
                    recents,
                    onUse = { keyboard?.hide(); viewModel.useRecent(it) },
                    onRemove = viewModel::removeRecent,
                    modifier = Modifier.padding(horizontal = gutter, vertical = 8.dp),
                )
                LoadState.Loading -> LoadingMessage(text = "Searching…")
                is LoadState.Failed -> EmptyMessage(current.message)
                is LoadState.Loaded -> if (current.value.isEmpty()) NoMatch(text.trim(), findAvailable, onFind = { container.findLauncher.find(text.trim()) })
                else PosterGrid(current.value, onOpen = { container.playbackSequence.select(current.value.map { item -> item.id }); onOpenMovie(it.id) })
            }
        }
    }

    // Opening Search goes straight to typing; coming back from a result keeps the results and the keyboard closed.
    LaunchedEffect(Unit) { if (text.isEmpty()) field.requestFocus() }
}

/** Nothing in the library matches: the message, and in Hashlark mode a button that hands the typed text to Hashlark. */
@Composable
private fun NoMatch(query: String, findAvailable: Boolean, onFind: () -> Unit) {
    if (!findAvailable) return EmptyMessage("No titles match “$query”.")
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Column(Modifier.widthIn(max = 480.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("No titles match “$query”.", style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Muted, textAlign = TextAlign.Center)
            OutlinedButton(onClick = onFind) {
                Icon(Icons.Filled.Search, contentDescription = null, modifier = Modifier.size(18.dp))
                Text("Find “$query” in Hashlark", modifier = Modifier.padding(start = 6.dp), textAlign = TextAlign.Center)
            }
        }
    }
}
