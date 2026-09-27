package dev.ottlib.tv.ui.search

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.ottlib.tv.appContainer
import dev.ottlib.tv.ui.components.EmptyMessage
import dev.ottlib.tv.ui.components.LoadState
import dev.ottlib.tv.ui.components.LoadingMessage
import dev.ottlib.tv.ui.components.PosterGrid
import dev.ottlib.tv.ui.components.ScreenPadding
import dev.ottlib.tv.ui.components.TopDestination
import dev.ottlib.tv.ui.components.TopNavigation
import dev.ottlib.tv.ui.components.TvTextField
import dev.ottlib.tv.ui.components.tryRequestFocus

@Composable
fun SearchScreen(onOpenMovie: (Long) -> Unit, onNavigate: (TopDestination) -> Unit) {
    val container = appContainer()
    val viewModel = viewModel { SearchViewModel(container.api) }
    val text by viewModel.text.collectAsStateWithLifecycle()
    val results by viewModel.results.collectAsStateWithLifecycle()
    val field = remember { FocusRequester() }
    val resultFocus = remember { FocusRequester() }

    Column(Modifier.fillMaxSize()) {
        TopNavigation(TopDestination.Search, onNavigate)
        TvTextField(
            value = text,
            onValueChange = viewModel::onTextChange,
            placeholder = "Search titles or IMDb IDs",
            imeAction = ImeAction.Search,
            modifier = Modifier.padding(horizontal = ScreenPadding, vertical = 12.dp).width(640.dp).focusRequester(field),
        )
        when (val current = results) {
            null -> EmptyMessage("Type a title. The remote's microphone button works here too.")
            LoadState.Loading -> LoadingMessage("Searching…")
            is LoadState.Failed -> EmptyMessage(current.message)
            is LoadState.Loaded -> if (current.value.isEmpty()) EmptyMessage("No titles match “${text.trim()}”.")
            else PosterGrid(current.value, onOpen = { onOpenMovie(it.id) }, onFocused = { viewModel.lastFocusedId = it.id }, focusItemId = viewModel.lastFocusedId, focusRequester = resultFocus)
        }
    }
    // Fresh screen: focus the search box. Returning from a movie: focus the poster the user opened.
    val showingResults = results is LoadState.Loaded
    LaunchedEffect(showingResults) { if (viewModel.lastFocusedId == null) field.tryRequestFocus() else if (showingResults) resultFocus.tryRequestFocus() }
}
