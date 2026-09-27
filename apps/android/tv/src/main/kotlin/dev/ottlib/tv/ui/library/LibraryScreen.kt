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
import dev.ottlib.tv.appContainer
import dev.ottlib.tv.ui.components.Choice
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
import dev.ottlib.tv.ui.theme.OttlibColors

private enum class LibraryDialog { Sort, Watched, Genre, Type }

private val sortChoices = listOf(Choice("Title", MovieSort.Title), Choice("Recently added", MovieSort.Added), Choice("Year", MovieSort.Year), Choice("Quality", MovieSort.Quality))
private val watchedChoices: List<Choice<Boolean?>> = listOf(Choice("All", null), Choice("Unwatched", false), Choice("Watched", true))
private val typeChoices: List<Choice<String?>> = listOf(Choice("All", null), Choice("Movies", "movie"), Choice("TV episodes", "tv"))

@Composable
fun LibraryScreen(onOpenMovie: (Long) -> Unit, onNavigate: (TopDestination) -> Unit) {
    val container = appContainer()
    val viewModel = viewModel { LibraryViewModel(container.api) }
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
                onOpen = { onOpenMovie(it.id) },
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
