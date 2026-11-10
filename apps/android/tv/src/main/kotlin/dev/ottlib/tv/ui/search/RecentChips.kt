package dev.ottlib.tv.ui.search

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.unit.dp
import androidx.tv.material3.OutlinedButton
import androidx.tv.material3.Text
import dev.ottlib.tv.ui.components.ScreenPadding

/**
 * Recent searches as a row of chips under the search field. [first] is attached to the first chip (↓ from the field lands
 * there); ↑ from any chip returns to [field]. OK runs the search again; a long press on OK removes the chip.
 */
@Composable
fun RecentChips(recents: List<String>, onUse: (String) -> Unit, onRemove: (String) -> Unit, first: FocusRequester, field: FocusRequester) {
    LazyRow(
        modifier = Modifier.focusRestorer(),
        contentPadding = PaddingValues(horizontal = ScreenPadding, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        itemsIndexed(recents, key = { _, term -> term }) { index, term ->
            OutlinedButton(
                onClick = { onUse(term) },
                onLongClick = { onRemove(term) },
                modifier = (if (index == 0) Modifier.focusRequester(first) else Modifier).focusProperties { up = field },
            ) { Text(term) }
        }
    }
}
