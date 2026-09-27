package dev.ottlib.tv.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.unit.dp

/**
 * A poster grid that asks for more items when focus gets within two rows of the end. [focusRequester]
 * is attached to [focusItemId] (or the first poster), so a screen can put focus back where the user was.
 */
@Composable
fun PosterGrid(
    items: List<PosterItem>,
    onOpen: (PosterItem) -> Unit,
    modifier: Modifier = Modifier,
    onNearEnd: () -> Unit = {},
    onFocused: (PosterItem) -> Unit = {},
    focusItemId: Long? = null,
    focusRequester: FocusRequester? = null,
) {
    val targetId = focusItemId?.takeIf { id -> items.any { it.id == id } } ?: items.firstOrNull()?.id
    LazyVerticalGrid(
        columns = GridCells.Adaptive(PosterWidth),
        state = rememberLazyGridState(),
        modifier = modifier.focusRestorer(),
        contentPadding = PaddingValues(start = ScreenPadding, end = ScreenPadding, top = 16.dp, bottom = 48.dp),
        horizontalArrangement = Arrangement.spacedBy(20.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        itemsIndexed(items, key = { _, item -> item.id }) { index, item ->
            PosterCard(
                item,
                onClick = { onOpen(item) },
                onFocused = {
                    onFocused(item)
                    if (index >= items.size - 14) onNearEnd()
                },
                modifier = if (focusRequester != null && item.id == targetId) Modifier.focusRequester(focusRequester) else Modifier,
            )
        }
    }
}
