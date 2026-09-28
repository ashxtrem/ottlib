package dev.ottlib.mobile.ui.library

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.ottlib.core.network.MovieSort
import dev.ottlib.core.presentation.Choice
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.library.LibraryChoices
import dev.ottlib.core.presentation.library.LibraryViewModel
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.mobile.ui.components.ChoiceDialog
import dev.ottlib.mobile.ui.components.EmptyMessage
import dev.ottlib.mobile.ui.components.ErrorMessage
import dev.ottlib.mobile.ui.components.LoadingMessage
import dev.ottlib.mobile.ui.components.PosterGrid
import dev.ottlib.mobile.ui.components.gutter
import dev.ottlib.mobile.ui.components.windowWidth

private enum class LibraryDialog { Sort, Watched, Genre, Type }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(onOpenMovie: (Long) -> Unit) {
    val container = appContainer()
    val viewModel = viewModel { LibraryViewModel(container.api) }
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var dialog by rememberSaveable { mutableStateOf<LibraryDialog?>(null) }
    val filters = state.filters

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Library") },
                actions = { state.total?.let { Text("$it titles", style = MaterialTheme.typography.labelLarge, color = OttlibColors.Muted, modifier = Modifier.padding(end = 16.dp)) } },
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Row(
                Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = windowWidth().gutter),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FilterPill("Sort", LibraryChoices.sort.first { it.value == filters.sort }.label, filters.sort != MovieSort.Title) { dialog = LibraryDialog.Sort }
                FilterPill("Show", LibraryChoices.watched.first { it.value == filters.watched }.label, filters.watched != null) { dialog = LibraryDialog.Watched }
                FilterPill("Genre", filters.genre ?: "Any", filters.genre != null) { dialog = LibraryDialog.Genre }
                FilterPill("Type", LibraryChoices.type.first { it.value == filters.mediaType }.label, filters.mediaType != null) { dialog = LibraryDialog.Type }
            }
            when {
                state.items.isEmpty() && state.error != null -> ErrorMessage(state.error!!) { viewModel.reload() }
                state.items.isEmpty() && state.loading -> LoadingMessage()
                state.items.isEmpty() -> EmptyMessage("Nothing matches these filters.")
                else -> PosterGrid(state.items, onOpen = { onOpenMovie(it.id) }, onNearEnd = viewModel::loadMore)
            }
        }
    }

    when (dialog) {
        LibraryDialog.Sort -> ChoiceDialog("Sort by", LibraryChoices.sort, filters.sort, onSelect = { viewModel.setFilters(filters.copy(sort = it)) }, onDismiss = { dialog = null })
        LibraryDialog.Watched -> ChoiceDialog("Show", LibraryChoices.watched, filters.watched, onSelect = { viewModel.setFilters(filters.copy(watched = it)) }, onDismiss = { dialog = null })
        LibraryDialog.Genre -> ChoiceDialog(
            "Genre",
            listOf(Choice<String?>("Any", null)) + state.genres.map { Choice<String?>(it, it) },
            filters.genre,
            onSelect = { viewModel.setFilters(filters.copy(genre = it)) },
            onDismiss = { dialog = null },
        )
        LibraryDialog.Type -> ChoiceDialog("Type", LibraryChoices.type, filters.mediaType, onSelect = { viewModel.setFilters(filters.copy(mediaType = it)) }, onDismiss = { dialog = null })
        null -> Unit
    }
}

@Composable
private fun FilterPill(name: String, value: String, active: Boolean, onClick: () -> Unit) {
    FilterChip(
        selected = active,
        onClick = onClick,
        label = { Text("$name: $value") },
        trailingIcon = { Icon(Icons.Filled.ArrowDropDown, contentDescription = null) },
    )
}
