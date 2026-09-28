package dev.ottlib.mobile.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.ottlib.core.presentation.PosterItem

/** A poster grid whose column count follows the window width. [onNearEnd] asks for the next page. */
@Composable
fun PosterGrid(items: List<PosterItem>, onOpen: (PosterItem) -> Unit, modifier: Modifier = Modifier, onNearEnd: () -> Unit = {}) {
    val width = windowWidth()
    val state = rememberLazyGridState()
    LazyVerticalGrid(
        columns = GridCells.Adaptive(width.posterWidth),
        state = state,
        contentPadding = PaddingValues(horizontal = width.gutter, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = modifier,
    ) {
        items(items, key = { it.id }) { item -> PosterCard(item, onClick = { onOpen(item) }) }
    }

    val nearEnd by remember(items) {
        derivedStateOf { items.isNotEmpty() && (state.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0) >= items.size - NEAR_END_ITEMS }
    }
    LaunchedEffect(nearEnd) { if (nearEnd) onNearEnd() }
}

private const val NEAR_END_ITEMS = 12
