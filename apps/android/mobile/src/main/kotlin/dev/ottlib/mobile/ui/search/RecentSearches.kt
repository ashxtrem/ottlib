package dev.ottlib.mobile.ui.search

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import dev.ottlib.core.presentation.theme.OttlibColors

/** Recent searches for an empty query: a tap searches again, a long press offers Remove. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun RecentSearches(recents: List<String>, onUse: (String) -> Unit, onRemove: (String) -> Unit, modifier: Modifier = Modifier) {
    Column(modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Recent", style = MaterialTheme.typography.titleSmall, color = OttlibColors.Muted)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            recents.forEach { term -> RecentChip(term, onUse = { onUse(term) }, onRemove = { onRemove(term) }) }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun RecentChip(term: String, onUse: () -> Unit, onRemove: () -> Unit) {
    var menuOpen by remember { mutableStateOf(false) }
    Box {
        Surface(shape = RoundedCornerShape(8.dp), border = BorderStroke(1.dp, OttlibColors.Muted.copy(alpha = 0.5f)), color = OttlibColors.SurfaceRaised) {
            Row(
                Modifier.combinedClickable(onClickLabel = "Search again", onLongClickLabel = "Remove", onClick = onUse, onLongClick = { menuOpen = true })
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(Icons.Filled.History, contentDescription = null, tint = OttlibColors.Muted, modifier = Modifier.size(16.dp))
                Text(term, style = MaterialTheme.typography.labelLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
            DropdownMenuItem(text = { Text("Remove") }, onClick = { menuOpen = false; onRemove() })
        }
    }
}
