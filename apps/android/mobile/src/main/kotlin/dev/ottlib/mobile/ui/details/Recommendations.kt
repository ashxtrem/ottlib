package dev.ottlib.mobile.ui.details

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.ottlib.core.presentation.details.RecommendedPoster
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.mobile.ui.components.PosterCard

/** "More like this": switch to another title without going back to the library. */
@Composable
fun RecommendationsRow(items: List<RecommendedPoster>, onOpen: (Long) -> Unit) {
    if (items.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("More like this", style = MaterialTheme.typography.titleMedium)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            items(items, key = { it.poster.id }) { item ->
                Column(Modifier.width(112.dp)) {
                    PosterCard(item.poster, onClick = { onOpen(item.poster.id) })
                    Text(item.reason, style = MaterialTheme.typography.labelSmall, color = OttlibColors.Muted, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}
