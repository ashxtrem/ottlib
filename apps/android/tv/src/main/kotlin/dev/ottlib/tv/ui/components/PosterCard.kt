package dev.ottlib.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Border
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import coil3.compose.AsyncImage
import dev.ottlib.core.presentation.PosterItem
import dev.ottlib.core.presentation.theme.OttlibColors

val PosterWidth: Dp = 124.dp
private val posterShape = RoundedCornerShape(10.dp)

@Composable
fun PosterCard(item: PosterItem, onClick: () -> Unit, modifier: Modifier = Modifier, width: Dp = PosterWidth, onFocused: () -> Unit = {}) {
    var focused by remember { mutableStateOf(false) }
    Column(modifier.width(width)) {
        Card(
            onClick = onClick,
            modifier = Modifier.fillMaxWidth().aspectRatio(2f / 3f).onFocusChanged { state ->
                focused = state.isFocused
                if (state.isFocused) onFocused()
            },
            shape = CardDefaults.shape(posterShape),
            scale = CardDefaults.scale(focusedScale = 1.08f),
            border = CardDefaults.border(focusedBorder = Border(androidx.compose.foundation.BorderStroke(3.dp, OttlibColors.Accent), shape = posterShape)),
            colors = CardDefaults.colors(containerColor = OttlibColors.SurfaceRaised),
        ) {
            Box(Modifier.fillMaxSize()) {
                if (item.posterUrl != null) {
                    AsyncImage(model = item.posterUrl, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                } else {
                    Text(
                        item.title,
                        style = MaterialTheme.typography.titleSmall,
                        textAlign = TextAlign.Center,
                        color = OttlibColors.Foreground,
                        modifier = Modifier.align(Alignment.Center).padding(12.dp),
                    )
                }
                item.badge?.let { Badge(it, Modifier.align(Alignment.TopStart).padding(6.dp)) }
                if (item.watched) WatchedMark(Modifier.align(Alignment.TopEnd).padding(6.dp))
                item.progress?.let { ProgressBar(it, Modifier.align(Alignment.BottomCenter)) }
            }
        }
        Text(
            item.title,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = if (focused) FontWeight.SemiBold else FontWeight.Normal,
            color = if (focused) OttlibColors.Foreground else OttlibColors.Muted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 8.dp, start = 2.dp, end = 2.dp),
        )
    }
}

@Composable
private fun Badge(text: String, modifier: Modifier) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.Bold,
        color = OttlibColors.Foreground,
        modifier = modifier.background(OttlibColors.Canvas.copy(alpha = 0.75f), RoundedCornerShape(4.dp)).padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

@Composable
private fun WatchedMark(modifier: Modifier) {
    Box(modifier.size(24.dp).background(OttlibColors.Success, CircleShape), contentAlignment = Alignment.Center) {
        Icon(Icons.Filled.Check, contentDescription = "Watched", tint = OttlibColors.Canvas, modifier = Modifier.size(16.dp))
    }
}

@Composable
fun ProgressBar(progress: Float, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(5.dp).background(OttlibColors.Canvas.copy(alpha = 0.7f))) {
        Box(Modifier.fillMaxWidth(progress).height(5.dp).background(OttlibColors.Accent))
    }
}
