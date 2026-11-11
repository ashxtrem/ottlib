package dev.ottlib.mobile.ui.details

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.ottlib.core.presentation.details.CollectionSummary
import dev.ottlib.core.presentation.details.MissingPart
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.mobile.ui.components.PosterCard

/**
 * The saga this title belongs to: the other parts the library owns, "See all" for the whole collection, and what is missing.
 * In Hashlark mode ([findAvailable]) the missing parts are cards a tap hands to Hashlark; otherwise just a count.
 */
@Composable
fun CollectionRow(
    collection: CollectionSummary?,
    onOpenMovie: (Long) -> Unit,
    onSeeAll: (id: Long, name: String) -> Unit,
    findAvailable: Boolean = false,
    onFindMissing: (MissingPart) -> Unit = {},
) {
    if (collection == null || !collection.hasAnythingToShow(findAvailable)) return
    val missingCards = collection.missingCards(findAvailable)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(collection.name.ifBlank { "Collection" }, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            TextButton(onClick = { onSeeAll(collection.id, collection.name.ifBlank { "Collection" }) }) { Text("See all") }
        }
        if (collection.owned.isNotEmpty() || missingCards.isNotEmpty()) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                items(collection.owned, key = { it.id }) { item -> PosterCard(item, onClick = { onOpenMovie(item.id) }, modifier = Modifier.width(112.dp)) }
                items(missingCards) { part -> MissingPartCard(part, onFind = { onFindMissing(part) }, modifier = Modifier.width(112.dp)) }
            }
        }
        if (collection.showsMissingCount(findAvailable)) {
            Text("${collection.missingCount} more not in your library", style = MaterialTheme.typography.bodySmall, color = OttlibColors.Muted)
        }
    }
}

/** Missing parts become cards only in Hashlark mode; otherwise there is nothing to tap. */
internal fun CollectionSummary.missingCards(findAvailable: Boolean): List<MissingPart> = if (findAvailable) missing else emptyList()

/** The "N more not in your library" line stays whenever the missing parts aren't shown as cards. */
internal fun CollectionSummary.showsMissingCount(findAvailable: Boolean): Boolean = missingCards(findAvailable).isEmpty() && missingCount > 0

internal fun CollectionSummary.hasAnythingToShow(findAvailable: Boolean): Boolean =
    owned.isNotEmpty() || missingCards(findAvailable).isNotEmpty() || missingCount > 0
