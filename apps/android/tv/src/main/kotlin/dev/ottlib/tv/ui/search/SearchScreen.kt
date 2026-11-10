package dev.ottlib.tv.ui.search

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.ottlib.core.presentation.LoadState
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.search.SearchViewModel
import dev.ottlib.tv.ui.components.EmptyMessage
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
    val viewModel = viewModel { SearchViewModel(container.api, container.hiddenTitles.keys, container.recentSearches, container.recentSearchScope) }
    val text by viewModel.text.collectAsStateWithLifecycle()
    val results by viewModel.results.collectAsStateWithLifecycle()
    val recents by viewModel.recents.collectAsStateWithLifecycle()
    val field = remember { FocusRequester() }
    val resultFocus = remember { FocusRequester() }
    val firstChip = remember { FocusRequester() }
    // A chip was used: its results take focus when they arrive. The chips stay until then so focus has somewhere to be.
    var awaitingRecent by remember { mutableStateOf(false) }
    val showChips = recents.isNotEmpty() && (text.isEmpty() || awaitingRecent)
    val hasResults = (results as? LoadState.Loaded)?.value?.isNotEmpty() == true

    Column(Modifier.fillMaxSize()) {
        TopNavigation(TopDestination.Search, onNavigate)
        TvTextField(
            value = text,
            onValueChange = viewModel::onTextChange,
            placeholder = "Search titles or IMDb IDs",
            imeAction = ImeAction.Search,
            modifier = Modifier.padding(horizontal = ScreenPadding, vertical = 12.dp).width(640.dp).focusRequester(field)
                // ↓ goes to the recent chips while the box is empty, else to the results.
                .focusProperties {
                    down = when {
                        text.isEmpty() && showChips -> firstChip
                        hasResults -> resultFocus
                        else -> FocusRequester.Default
                    }
                },
        )
        if (showChips) RecentChips(recents, onUse = { awaitingRecent = true; viewModel.useRecent(it) }, onRemove = viewModel::removeRecent, first = firstChip, field = field)
        when (val current = results) {
            null -> EmptyMessage("Type a title. The remote's microphone button works here too.")
            LoadState.Loading -> LoadingMessage("Searching…")
            is LoadState.Failed -> EmptyMessage(current.message)
            is LoadState.Loaded -> if (current.value.isEmpty()) EmptyMessage("No titles match “${text.trim()}”.")
            else PosterGrid(current.value, onOpen = { container.playbackSequence.select(current.value.map { item -> item.id }); onOpenMovie(it.id) }, onFocused = { viewModel.lastFocusedId = it.id }, focusItemId = viewModel.lastFocusedId, focusRequester = resultFocus)
        }
    }
    // Fresh screen: focus the search box. Returning from a movie: focus the poster the user opened.
    // After a chip: the first result once results arrive, or back to the box when nothing matched.
    val settled = results is LoadState.Loaded || results is LoadState.Failed
    LaunchedEffect(settled) {
        when {
            awaitingRecent -> if (settled) {
                awaitingRecent = false
                if (hasResults) resultFocus.tryRequestFocus() else field.tryRequestFocus()
            }
            viewModel.lastFocusedId == null -> field.tryRequestFocus()
            settled -> resultFocus.tryRequestFocus()
        }
    }
}
