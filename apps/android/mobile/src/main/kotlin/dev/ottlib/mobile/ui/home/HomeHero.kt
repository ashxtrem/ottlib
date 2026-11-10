package dev.ottlib.mobile.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import dev.ottlib.core.presentation.formatRuntime
import dev.ottlib.core.presentation.home.HeroItem
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.mobile.ui.components.TitleLogo
import dev.ottlib.mobile.ui.components.WindowWidth
import dev.ottlib.mobile.ui.components.gutter

/** Wider windows cap the banner here so the rows below stay in view. */
private val WIDE_HERO_HEIGHT = 320.dp

/** The featured title at the top of Home; it scrolls away with the rows. */
@Composable
fun HomeHero(hero: HeroItem, width: WindowWidth, onPlay: () -> Unit, onDetails: () -> Unit) {
    if (width == WindowWidth.Compact) CompactHero(hero, width, onPlay, onDetails) else WideHero(hero, width, onPlay, onDetails)
}

/** Phone portrait / cover screen: a 16:9 banner, then the title, one meta line and the buttons below it. */
@Composable
private fun CompactHero(hero: HeroItem, width: WindowWidth, onPlay: () -> Unit, onDetails: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(OttlibColors.SurfaceRaised)) {
            HeroImage(hero)
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.55f to Color.Transparent, 1f to OttlibColors.Canvas)))
        }
        Column(Modifier.padding(horizontal = width.gutter), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            TitleLogo(hero.logoUrl, hero.item.title, maxHeight = 56.dp, maxWidth = 260.dp, style = MaterialTheme.typography.headlineSmall)
            MetaLine(hero)
            HeroButtons(hero, onPlay, onDetails, fillWidth = true)
        }
    }
}

/** Unfolded or landscape: a capped banner with the text on the left over a scrim. */
@Composable
private fun WideHero(hero: HeroItem, width: WindowWidth, onPlay: () -> Unit, onDetails: () -> Unit) {
    Box(Modifier.fillMaxWidth().height(WIDE_HERO_HEIGHT).background(OttlibColors.SurfaceRaised)) {
        HeroImage(hero)
        Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(0f to OttlibColors.Canvas, 0.45f to OttlibColors.Canvas.copy(alpha = 0.75f), 0.8f to Color.Transparent)))
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.7f to Color.Transparent, 1f to OttlibColors.Canvas)))
        Column(
            Modifier.fillMaxHeight().widthIn(max = 480.dp).padding(horizontal = width.gutter, vertical = 20.dp).align(Alignment.CenterStart),
            verticalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterVertically),
        ) {
            TitleLogo(hero.logoUrl, hero.item.title, maxHeight = 72.dp, maxWidth = 320.dp, style = MaterialTheme.typography.headlineMedium)
            MetaLine(hero)
            hero.overview?.let { Text(it, style = MaterialTheme.typography.bodyMedium, maxLines = 3, overflow = TextOverflow.Ellipsis) }
            HeroButtons(hero, onPlay, onDetails, fillWidth = false)
        }
    }
}

@Composable
private fun HeroImage(hero: HeroItem) {
    AsyncImage(model = hero.backdropUrl ?: hero.item.posterUrl, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
}

@Composable
private fun MetaLine(hero: HeroItem) {
    val line = listOfNotNull(hero.item.year?.toString(), formatRuntime(null, hero.item.durationMs), hero.item.badge).joinToString("  ·  ")
    if (line.isNotEmpty()) Text(line, style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
}

@Composable
private fun HeroButtons(hero: HeroItem, onPlay: () -> Unit, onDetails: () -> Unit, fillWidth: Boolean) {
    Row(if (fillWidth) Modifier.fillMaxWidth() else Modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        val fill = if (fillWidth) Modifier.weight(1f) else Modifier
        Button(onClick = onPlay, modifier = fill) {
            Icon(Icons.Filled.PlayArrow, contentDescription = null)
            Text(hero.resumeLabel ?: "Play", maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(start = 6.dp))
        }
        OutlinedButton(onClick = onDetails, modifier = fill) {
            Icon(Icons.Filled.Info, contentDescription = null)
            Text("Details", modifier = Modifier.padding(start = 6.dp))
        }
    }
}
