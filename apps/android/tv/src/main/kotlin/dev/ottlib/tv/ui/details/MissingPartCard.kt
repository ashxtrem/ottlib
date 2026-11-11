package dev.ottlib.tv.ui.details

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Border
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import coil3.compose.AsyncImage
import dev.ottlib.core.presentation.details.MissingPart
import dev.ottlib.tv.ui.components.PosterWidth
import dev.ottlib.core.presentation.theme.OttlibColors

private val missingShape = RoundedCornerShape(10.dp)

/** A collection part that isn't in the library: dimmed poster, title, year and a "Find" caption. OK finds it in place. */
@Composable
fun MissingPartCard(part: MissingPart, onFind: () -> Unit, onFocused: () -> Unit, modifier: Modifier = Modifier) {
    var focused by remember { mutableStateOf(false) }
    Column(modifier.width(PosterWidth)) {
        Card(
            onClick = onFind,
            modifier = Modifier.fillMaxWidth().aspectRatio(2f / 3f).onFocusChanged { state ->
                focused = state.isFocused
                if (state.isFocused) onFocused()
            },
            shape = CardDefaults.shape(missingShape),
            scale = CardDefaults.scale(focusedScale = 1.08f),
            border = CardDefaults.border(focusedBorder = Border(BorderStroke(3.dp, OttlibColors.Accent), shape = missingShape)),
            colors = CardDefaults.colors(containerColor = OttlibColors.SurfaceRaised),
        ) {
            Box(Modifier.fillMaxSize()) {
                if (part.posterUrl != null) {
                    AsyncImage(model = part.posterUrl, contentDescription = null, contentScale = ContentScale.Crop, alpha = if (focused) 0.6f else 0.35f, modifier = Modifier.fillMaxSize())
                } else {
                    Text(part.title, style = MaterialTheme.typography.titleSmall, textAlign = TextAlign.Center, color = OttlibColors.Muted, modifier = Modifier.align(Alignment.Center).padding(12.dp))
                }
                Text(
                    "Find",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    color = if (focused) OttlibColors.Accent else OttlibColors.Foreground,
                    modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(vertical = 8.dp),
                )
            }
        }
        Text(
            part.year?.let { "${part.title} ($it)" } ?: part.title,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = if (focused) FontWeight.SemiBold else FontWeight.Normal,
            color = if (focused) OttlibColors.Foreground else OttlibColors.Muted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 8.dp, start = 2.dp, end = 2.dp),
        )
    }
}
