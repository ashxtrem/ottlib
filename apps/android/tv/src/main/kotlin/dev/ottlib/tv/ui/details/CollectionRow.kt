package dev.ottlib.tv.ui.details

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Border
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import dev.ottlib.core.presentation.details.CollectionSummary
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.tv.ui.components.PosterCard
import dev.ottlib.tv.ui.components.PosterWidth

/** Focus keys of the collection row's cards, recorded in DetailsViewModel.lastFocusedKey. */
fun collectionPosterKey(id: Long) = "collection:$id"
const val COLLECTION_SEE_ALL_KEY = "collection:all"

private val seeAllShape = RoundedCornerShape(10.dp)

/** The saga's other owned titles, a "See all" card that opens the library filtered to the collection, and how many parts are missing. */
@Composable
fun CollectionRow(
    collection: CollectionSummary,
    onOpenMovie: (Long) -> Unit,
    onSeeAll: () -> Unit,
    onFocused: (String) -> Unit,
    restoreKey: String?,
    restore: FocusRequester,
    modifier: Modifier = Modifier,
) {
    fun Modifier.restoring(key: String) = if (key == restoreKey) focusRequester(restore) else this
    Column(modifier) {
        Text(collection.name, style = MaterialTheme.typography.titleMedium, color = OttlibColors.Foreground, modifier = Modifier.padding(bottom = 4.dp))
        LazyRow(
            modifier = Modifier.focusRestorer(),
            contentPadding = PaddingValues(vertical = 8.dp, horizontal = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            items(collection.owned, key = { it.id }) { item ->
                val key = collectionPosterKey(item.id)
                PosterCard(item, onClick = { onOpenMovie(item.id) }, onFocused = { onFocused(key) }, modifier = Modifier.restoring(key))
            }
            item(key = COLLECTION_SEE_ALL_KEY) {
                SeeAllCard(onClick = onSeeAll, onFocused = { onFocused(COLLECTION_SEE_ALL_KEY) }, modifier = Modifier.restoring(COLLECTION_SEE_ALL_KEY))
            }
        }
        if (collection.missingCount > 0) {
            Text("${collection.missingCount} more not in your library", style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Muted)
        }
    }
}

@Composable
private fun SeeAllCard(onClick: () -> Unit, onFocused: () -> Unit, modifier: Modifier) {
    Column(modifier.width(PosterWidth)) {
        Card(
            onClick = onClick,
            modifier = Modifier.fillMaxWidth().aspectRatio(2f / 3f).onFocusChanged { if (it.isFocused) onFocused() },
            shape = CardDefaults.shape(seeAllShape),
            scale = CardDefaults.scale(focusedScale = 1.08f),
            border = CardDefaults.border(focusedBorder = Border(androidx.compose.foundation.BorderStroke(3.dp, OttlibColors.Accent), shape = seeAllShape)),
            colors = CardDefaults.colors(containerColor = OttlibColors.SurfaceRaised),
        ) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("See all", style = MaterialTheme.typography.titleSmall, color = OttlibColors.Foreground, textAlign = TextAlign.Center, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}
