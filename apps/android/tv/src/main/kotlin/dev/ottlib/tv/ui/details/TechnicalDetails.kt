package dev.ottlib.tv.ui.details

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import dev.ottlib.core.model.Movie
import dev.ottlib.core.presentation.describe
import dev.ottlib.core.presentation.theme.OttlibColors

/** Video, audio and subtitle tracks of the file, one muted line each. */
@Composable
fun TechnicalDetails(movie: Movie) {
    val info = movie.mediaInfo ?: return
    val audio = info.tracks.filter { it.isAudio }
    val subtitles = info.tracks.filter { it.isSubtitle }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        val video = listOfNotNull(info.videoCodec, info.videoProfile, info.width?.let { w -> info.height?.let { h -> "${w}×$h" } }, info.hdrFormat, info.container).joinToString(" · ")
        if (video.isNotEmpty()) DetailLine("Video", video)
        if (audio.isNotEmpty()) DetailLine("Audio", audio.joinToString("   |   ") { it.describe() })
        if (subtitles.isNotEmpty()) DetailLine("Subtitles", subtitles.joinToString("   |   ") { it.describe() })
    }
}

@Composable
private fun DetailLine(label: String, value: String) {
    Text("$label: $value", style = MaterialTheme.typography.bodySmall, color = OttlibColors.Muted, maxLines = 2, overflow = TextOverflow.Ellipsis)
}
