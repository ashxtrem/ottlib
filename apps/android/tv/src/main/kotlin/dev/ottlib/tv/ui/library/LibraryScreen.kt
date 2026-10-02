package dev.ottlib.tv.ui.library

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import dev.ottlib.core.network.MovieSort
import dev.ottlib.core.network.MovieQuery
import dev.ottlib.core.presentation.Choice
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.library.LibraryChoices
import dev.ottlib.core.presentation.library.LibraryViewModel
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.tv.ui.components.ChoiceDialog
import dev.ottlib.tv.ui.components.EmptyMessage
import dev.ottlib.tv.ui.components.ErrorMessage
import dev.ottlib.tv.ui.components.FilterButton
import dev.ottlib.tv.ui.components.LoadingMessage
import dev.ottlib.tv.ui.components.PosterGrid
import dev.ottlib.tv.ui.components.ScreenPadding
import dev.ottlib.tv.ui.components.TopDestination
import dev.ottlib.tv.ui.components.TopNavigation
import dev.ottlib.tv.ui.components.tryRequestFocus

private enum class LibraryDialog { Sort, Watched, Genre, Type }

private val sortChoices = LibraryChoices.sort
private val watchedChoices = LibraryChoices.watched
private val typeChoices = LibraryChoices.type

@Composable
fun LibraryScreen(onOpenMovie: (Long) -> Unit, onNavigate: (TopDestination) -> Unit) {
    val container = appContainer()
    val viewModel = viewModel { LibraryViewModel(container.api, container.librarySync) }
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var dialog by remember { mutableStateOf<LibraryDialog?>(null) }
    val firstPoster = remember { FocusRequester() }
    val filters = state.filters

    Column(Modifier.fillMaxSize()) {
        TopNavigation(TopDestination.Library, onNavigate)
        Row(Modifier.padding(horizontal = ScreenPadding, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            FilterButton("Sort", sortChoices.first { it.value == filters.sort }.label, filters.sort != MovieSort.Title, onClick = { dialog = LibraryDialog.Sort })
            FilterButton("Show", watchedChoices.first { it.value == filters.watched }.label, filters.watched != null, onClick = { dialog = LibraryDialog.Watched })
            FilterButton("Genre", filters.genre ?: "Any", filters.genre != null, onClick = { dialog = LibraryDialog.Genre })
            FilterButton("Type", typeChoices.first { it.value == filters.mediaType }.label, filters.mediaType != null, onClick = { dialog = LibraryDialog.Type })
            Spacer(Modifier.width(12.dp))
            state.total?.let { Text("$it titles", style = MaterialTheme.typography.titleSmall, color = OttlibColors.Muted) }
        }
        when {
            state.items.isEmpty() && state.error != null -> ErrorMessage(state.error!!) { viewModel.reload() }
            state.items.isEmpty() && state.loading -> LoadingMessage()
            state.items.isEmpty() -> EmptyMessage("Nothing matches these filters.")
            else -> PosterGrid(
                state.items,
                onOpen = {
                    container.playbackSequence.select(state.items.map { item -> item.id }, source = MovieQuery(watched = filters.watched, genre = filters.genre, mediaType = filters.mediaType, sort = filters.sort), nextCursor = state.nextCursor)
                    onOpenMovie(it.id)
                },
                onNearEnd = viewModel::loadMore,
                onFocused = { viewModel.lastFocusedId = it.id },
                focusItemId = viewModel.lastFocusedId,
                focusRequester = firstPoster,
            )
        }
    }

    LaunchedEffect(filters, state.items.isNotEmpty()) { if (state.items.isNotEmpty()) firstPoster.tryRequestFocus() }

    when (dialog) {
        LibraryDialog.Sort -> ChoiceDialog("Sort by", sortChoices, filters.sort, onSelect = { viewModel.setFilters(filters.copy(sort = it)) }, onDismiss = { dialog = null })
        LibraryDialog.Watched -> ChoiceDialog("Show", watchedChoices, filters.watched, onSelect = { viewModel.setFilters(filters.copy(watched = it)) }, onDismiss = { dialog = null })
        LibraryDialog.Genre -> ChoiceDialog(
            "Genre",
            listOf(Choice<String?>("Any", null)) + state.genres.map { Choice<String?>(it, it) },
            filters.genre,
            onSelect = { viewModel.setFilters(filters.copy(genre = it)) },
            onDismiss = { dialog = null },
        )
        LibraryDialog.Type -> ChoiceDialog("Type", typeChoices, filters.mediaType, onSelect = { viewModel.setFilters(filters.copy(mediaType = it)) }, onDismiss = { dialog = null })
        null -> Unit
    }
}
