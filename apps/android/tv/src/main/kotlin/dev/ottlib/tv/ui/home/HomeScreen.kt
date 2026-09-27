package dev.ottlib.tv.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.layout.LazyLayoutCacheWindow
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import dev.ottlib.tv.appContainer
import dev.ottlib.tv.ui.components.DefaultScroll
import dev.ottlib.tv.ui.components.EmptyMessage
import dev.ottlib.tv.ui.components.ErrorMessage
import dev.ottlib.tv.ui.components.LoadState
import dev.ottlib.tv.ui.components.LoadingMessage
import dev.ottlib.tv.ui.components.PivotScroll
import dev.ottlib.tv.ui.components.PosterItem
import dev.ottlib.tv.ui.components.PosterRow
import dev.ottlib.tv.ui.components.ScreenPadding
import dev.ottlib.tv.ui.components.TopDestination
import dev.ottlib.tv.ui.components.TopNavigation
import dev.ottlib.tv.ui.components.formatRemaining
import dev.ottlib.tv.ui.components.tryRequestFocus
import dev.ottlib.tv.ui.theme.OttlibColors

/** Distance from the top of the rows list to the focused poster: room for the row title above it. */
private val RowPivot = 60.dp

/**
 * Keeps about one row above and below the viewport composed. Building a row (a LazyRow plus its posters) while the
 * list is animating is what made moving between rows stutter on slow TV chips; sideways movement was already smooth.
 */
@OptIn(ExperimentalFoundationApi::class)
private val RowCacheWindow = LazyLayoutCacheWindow(ahead = 320.dp, behind = 320.dp)

@Composable
fun HomeScreen(onOpenMovie: (Long) -> Unit, onNavigate: (TopDestination) -> Unit) {
    val container = appContainer()
    val viewModel = viewModel { HomeViewModel(container.api) }
    val state by viewModel.rows.collectAsStateWithLifecycle()
    var focused by remember { mutableStateOf<PosterItem?>(null) }

    LifecycleResumeEffect(viewModel) {
        viewModel.onResume()
        onPauseOrDispose { }
    }

    // No full-screen artwork behind the rows: blending it every frame kept TV GPUs (measured on a BenQ GP01) from 60 fps.
    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            TopNavigation(TopDestination.Home, onNavigate)
            when (val current = state) {
                LoadState.Loading -> LoadingMessage()
                is LoadState.Failed -> ErrorMessage(current.message) { viewModel.load() }
                is LoadState.Loaded -> if (current.value.isEmpty()) {
                    EmptyMessage("Your library is empty.\nAdd folders and run a scan from the Ottlib web app.")
                } else {
                    HeroText(focused)
                    HomeRows(current.value, viewModel, onOpenMovie, onFocused = { focused = it })
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun HomeRows(rows: List<HomeRow>, viewModel: HomeViewModel, onOpenMovie: (Long) -> Unit, onFocused: (PosterItem) -> Unit) {
    val restore = remember { FocusRequester() }
    val target = viewModel.lastFocus?.takeIf { focus -> rows.any { row -> row.key == focus.rowKey && row.items.any { it.id == focus.itemId } } }
        ?: FocusTarget(rows.first().key, rows.first().items.first().id)

    // Rows scroll so the focused poster's row title stays just below the top edge; rows scroll sideways normally.
    PivotScroll(pivot = RowPivot) { rowScroll ->
        LazyColumn(state = rememberLazyListState(cacheWindow = RowCacheWindow), contentPadding = PaddingValues(top = 8.dp, bottom = 48.dp), verticalArrangement = Arrangement.spacedBy(28.dp)) {
            items(rows, key = { it.key }) { row ->
                DefaultScroll(rowScroll) {
                    PosterRow(
                        title = row.title,
                        items = row.items,
                        onOpen = { onOpenMovie(it.id) },
                        onFocused = { item ->
                            viewModel.lastFocus = FocusTarget(row.key, item.id)
                            onFocused(item)
                        },
                        itemModifier = { item -> if (row.key == target.rowKey && item.id == target.itemId) Modifier.focusRequester(restore) else Modifier },
                    )
                }
            }
        }
    }
    LaunchedEffect(target) { restore.tryRequestFocus() }
}

@Composable
private fun HeroText(item: PosterItem?) {
    Column(Modifier.padding(horizontal = ScreenPadding).padding(top = 4.dp, bottom = 8.dp).height(84.dp)) {
        if (item == null) return@Column
        Text(item.title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = OttlibColors.Foreground, maxLines = 1, overflow = TextOverflow.Ellipsis)
        val details = listOfNotNull(item.year?.toString(), item.badge, item.resumePositionMs?.let { formatRemaining(it, item.durationMs) }, "Watched".takeIf { item.watched })
        Text(details.joinToString("  ·  "), style = MaterialTheme.typography.titleMedium, color = OttlibColors.Muted, modifier = Modifier.padding(top = 6.dp))
    }
}
