package dev.ottlib.mobile.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.ottlib.core.presentation.LoadState
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.home.HomeRow
import dev.ottlib.core.presentation.home.HomeViewModel
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.mobile.ui.components.EmptyMessage
import dev.ottlib.mobile.ui.components.ErrorMessage
import dev.ottlib.mobile.ui.components.LoadingMessage
import dev.ottlib.mobile.ui.components.PosterCard
import dev.ottlib.mobile.ui.components.WindowWidth
import dev.ottlib.mobile.ui.components.gutter
import dev.ottlib.mobile.ui.components.posterWidth
import dev.ottlib.mobile.ui.components.windowWidth

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(onOpenMovie: (Long) -> Unit) {
    val container = appContainer()
    val viewModel = viewModel { HomeViewModel(container.api) }
    val state by viewModel.rows.collectAsStateWithLifecycle()
    LifecycleResumeEffect(viewModel) {
        viewModel.onResume()
        onPauseOrDispose { }
    }
    val width = windowWidth()

    Scaffold(topBar = { TopAppBar(title = { Text("Ottlib", fontWeight = FontWeight.Bold, color = OttlibColors.Accent) }) }) { padding ->
        val content = Modifier.padding(padding)
        when (val current = state) {
            LoadState.Loading -> LoadingMessage(modifier = content)
            is LoadState.Failed -> ErrorMessage(current.message, content) { viewModel.load() }
            is LoadState.Loaded -> if (current.value.isEmpty()) {
                EmptyMessage("Your library is empty.\nAdd folders and run a scan from the Ottlib web app.", content)
            } else {
                LazyColumn(content.fillMaxSize(), contentPadding = PaddingValues(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                    items(current.value, key = { it.key }) { row -> PosterRow(row, width, onOpenMovie) }
                }
            }
        }
    }
}

@Composable
private fun PosterRow(row: HomeRow, width: WindowWidth, onOpenMovie: (Long) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(row.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = width.gutter))
        LazyRow(contentPadding = PaddingValues(horizontal = width.gutter), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            items(row.items, key = { it.id }) { item -> PosterCard(item, onClick = { onOpenMovie(item.id) }, modifier = Modifier.width(width.posterWidth)) }
        }
    }
}
