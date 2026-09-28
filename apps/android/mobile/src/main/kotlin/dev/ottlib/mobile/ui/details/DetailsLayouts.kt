package dev.ottlib.mobile.ui.details

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import dev.ottlib.core.model.Movie
import dev.ottlib.core.presentation.metaLine
import dev.ottlib.core.presentation.theme.OttlibColors

/** Cover screen / portrait phone: backdrop banner, poster overlapping it, then everything in one column. */
@Composable
fun CompactDetails(movie: Movie, imageUrl: String?, posterUrl: String?, busy: Boolean, actions: DetailsActions) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).navigationBarsPadding()) {
        Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f)) {
            AsyncImage(model = imageUrl, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            // Dark at the top so the status bar stays readable over bright artwork, fading into the page at the bottom.
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to OttlibColors.Canvas.copy(alpha = 0.6f), 0.3f to Color.Transparent, 0.5f to Color.Transparent, 1f to OttlibColors.Canvas)))
        }
        Row(Modifier.padding(horizontal = 16.dp).offset(y = (-40).dp), horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.Bottom) {
            Poster(posterUrl, 104.dp)
            TitleBlock(movie, Modifier.padding(bottom = 4.dp))
        }
        Column(Modifier.padding(horizontal = 16.dp).offset(y = (-24).dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            ActionButtons(movie, busy, actions, fillWidth = true)
            MovieInfo(movie)
        }
    }
}

/** Unfolded or landscape: the backdrop fills the screen behind a poster pane and a scrolling info pane. */
@Composable
fun WideDetails(movie: Movie, imageUrl: String?, posterUrl: String?, busy: Boolean, actions: DetailsActions) {
    Box(Modifier.fillMaxSize()) {
        AsyncImage(model = imageUrl, contentDescription = null, contentScale = ContentScale.Crop, alpha = 0.45f, modifier = Modifier.fillMaxSize())
        Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(0f to OttlibColors.Canvas, 0.75f to OttlibColors.Canvas.copy(alpha = 0.7f), 1f to Color.Transparent)))
        Row(Modifier.fillMaxSize().safeDrawingPadding().padding(start = 64.dp, end = 24.dp, top = 24.dp), horizontalArrangement = Arrangement.spacedBy(32.dp)) {
            Poster(posterUrl, 200.dp)
            Column(
                Modifier.weight(1f).widthIn(max = 720.dp).verticalScroll(rememberScrollState()).padding(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                TitleBlock(movie)
                ActionButtons(movie, busy, actions, fillWidth = false)
                MovieInfo(movie)
            }
        }
    }
}

@Composable
private fun Poster(url: String?, width: Dp) {
    AsyncImage(
        model = url,
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = Modifier.width(width).aspectRatio(2f / 3f).clip(RoundedCornerShape(8.dp)).background(OttlibColors.SurfaceRaised),
    )
}

@Composable
private fun TitleBlock(movie: Movie, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(movie.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, maxLines = 3)
        Text(movie.metaLine(), style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Muted)
        if (movie.genres.isNotEmpty()) Text(movie.genres.joinToString("  ·  "), style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Muted)
    }
}
