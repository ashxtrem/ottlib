package dev.ottlib.tv.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.unit.dp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import dev.ottlib.tv.ui.theme.OttlibColors

/** A titled horizontal row of posters; D-pad focus returns to the last focused poster when re-entering the row. */
@Composable
fun PosterRow(
    title: String,
    items: List<PosterItem>,
    onOpen: (PosterItem) -> Unit,
    modifier: Modifier = Modifier,
    onFocused: (PosterItem) -> Unit = {},
    itemModifier: @Composable (PosterItem) -> Modifier = { Modifier },
) {
    Column(modifier) {
        Text(
            title,
            style = MaterialTheme.typography.titleMedium,
            color = OttlibColors.Foreground,
            modifier = Modifier.padding(start = ScreenPadding, bottom = 12.dp),
        )
        LazyRow(
            modifier = Modifier.focusRestorer(),
            contentPadding = PaddingValues(horizontal = ScreenPadding, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            items(items, key = { it.id }) { item ->
                PosterCard(item, onClick = { onOpen(item) }, onFocused = { onFocused(item) }, modifier = itemModifier(item))
            }
        }
    }
}

val ScreenPadding = 48.dp
