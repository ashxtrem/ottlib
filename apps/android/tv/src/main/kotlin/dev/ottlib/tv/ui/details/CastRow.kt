package dev.ottlib.tv.ui.details

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Border
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import coil3.compose.AsyncImage
import dev.ottlib.core.model.CastMember
import dev.ottlib.core.presentation.theme.OttlibColors

private val PhotoSize = 88.dp

/** Focus key of a cast card, recorded in DetailsViewModel.lastFocusedKey. */
fun castKey(name: String) = "cast:$name"

/** The cast as focusable photo cards; OK on one opens the library filtered to that actor. Photos load lazily as cards scroll in. */
@Composable
fun CastRow(cast: List<CastMember>, onOpen: (String) -> Unit, onFocused: (String) -> Unit, restoreKey: String?, restore: FocusRequester) {
    Column {
        Text("Cast", style = MaterialTheme.typography.titleMedium, color = OttlibColors.Foreground, modifier = Modifier.padding(bottom = 8.dp))
        LazyRow(
            modifier = Modifier.focusRestorer(),
            contentPadding = PaddingValues(vertical = 8.dp, horizontal = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Names key the cards (and the restored focus), so a name listed twice shows once.
            items(cast.distinctBy { it.name }, key = { it.name }) { member ->
                val key = castKey(member.name)
                CastCard(
                    member,
                    onClick = { onOpen(member.name) },
                    onFocused = { onFocused(key) },
                    modifier = if (key == restoreKey) Modifier.focusRequester(restore) else Modifier,
                )
            }
        }
    }
}

@Composable
private fun CastCard(member: CastMember, onClick: () -> Unit, onFocused: () -> Unit, modifier: Modifier) {
    Column(modifier.width(PhotoSize + 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Card(
            onClick = onClick,
            modifier = Modifier.size(PhotoSize).onFocusChanged { if (it.isFocused) onFocused() },
            shape = CardDefaults.shape(CircleShape),
            scale = CardDefaults.scale(focusedScale = 1.08f),
            border = CardDefaults.border(focusedBorder = Border(androidx.compose.foundation.BorderStroke(3.dp, OttlibColors.Accent), shape = CircleShape)),
            colors = CardDefaults.colors(containerColor = OttlibColors.SurfaceRaised),
        ) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                if (member.photoUrl != null) {
                    AsyncImage(model = member.photoUrl, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                } else {
                    Text(member.initials(), style = MaterialTheme.typography.titleLarge, color = OttlibColors.Muted)
                }
            }
        }
        Text(
            member.name,
            style = MaterialTheme.typography.labelMedium,
            color = OttlibColors.Muted,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
        )
    }
}

private fun CastMember.initials() = name.split(' ').filter { it.isNotBlank() }.take(2).joinToString("") { it.first().uppercase() }
