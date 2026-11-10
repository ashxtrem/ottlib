package dev.ottlib.tv.ui.library

import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import dev.ottlib.core.presentation.library.LibraryPreset
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.tv.ui.components.ScreenPadding

/**
 * The library for one actor or one collection, opened from Details. The filter buttons narrow it further but never drop the
 * actor or collection; focus starts on the first poster and Back returns to Details.
 */
@Composable
fun FilteredLibraryScreen(actor: String?, collectionId: Long?, title: String, onOpenMovie: (Long) -> Unit) {
    val preset = remember(actor, collectionId) { LibraryPreset(actor = actor, collectionId = collectionId) }
    LibraryGrid(onOpenMovie, preset) {
        Text(
            title,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.SemiBold,
            color = OttlibColors.Foreground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(start = ScreenPadding, end = ScreenPadding, top = 28.dp, bottom = 4.dp),
        )
    }
}
