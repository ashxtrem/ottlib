package dev.ottlib.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import dev.ottlib.core.presentation.PosterItem
import dev.ottlib.core.presentation.theme.OttlibColors

private val posterShape = RoundedCornerShape(8.dp)

@Composable
fun PosterCard(item: PosterItem, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Column(modifier) {
        Box(
            Modifier.fillMaxWidth().aspectRatio(2f / 3f).clip(posterShape).background(OttlibColors.SurfaceRaised).clickable(onClick = onClick),
        ) {
            if (item.posterUrl != null) {
                AsyncImage(model = item.posterUrl, contentDescription = item.title, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            } else {
                Text(
                    item.title,
                    style = MaterialTheme.typography.titleSmall,
                    textAlign = TextAlign.Center,
                    color = OttlibColors.Foreground,
                    modifier = Modifier.align(Alignment.Center).padding(8.dp),
                )
            }
            item.badge?.let { Badge(it, Modifier.align(Alignment.TopStart).padding(4.dp)) }
            if (item.watched) WatchedMark(Modifier.align(Alignment.TopEnd).padding(4.dp))
            item.progress?.let { ProgressBar(it, Modifier.align(Alignment.BottomCenter)) }
        }
        Text(
            item.title,
            style = MaterialTheme.typography.labelMedium,
            color = OttlibColors.Muted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 6.dp, start = 2.dp, end = 2.dp),
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
        modifier = modifier.background(OttlibColors.Canvas.copy(alpha = 0.75f), RoundedCornerShape(4.dp)).padding(horizontal = 5.dp, vertical = 1.dp),
    )
}

@Composable
private fun WatchedMark(modifier: Modifier) {
    Box(modifier.size(20.dp).background(OttlibColors.Success, CircleShape), contentAlignment = Alignment.Center) {
        Icon(Icons.Filled.Check, contentDescription = "Watched", tint = OttlibColors.Canvas, modifier = Modifier.size(14.dp))
    }
}

@Composable
fun ProgressBar(progress: Float, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(4.dp).background(OttlibColors.Canvas.copy(alpha = 0.7f))) {
        Box(Modifier.fillMaxWidth(progress).height(4.dp).background(OttlibColors.Accent))
    }
}
