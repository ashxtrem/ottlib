package dev.ottlib.mobile.ui.details

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import dev.ottlib.core.presentation.details.MissingPart
import dev.ottlib.core.presentation.theme.OttlibColors

private val posterShape = RoundedCornerShape(8.dp)

/** A collection part the library doesn't own: dimmed poster, title, year and a "Find" caption; a tap hands it to Hashlark. */
@Composable
fun MissingPartCard(part: MissingPart, onFind: () -> Unit, modifier: Modifier = Modifier) {
    Column(modifier.clickable(role = Role.Button, onClickLabel = "Find in Hashlark", onClick = onFind)) {
        Box(Modifier.fillMaxWidth().aspectRatio(2f / 3f).clip(posterShape).background(OttlibColors.SurfaceRaised)) {
            if (part.posterUrl != null) {
                AsyncImage(model = part.posterUrl, contentDescription = part.title, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize().alpha(0.4f))
            } else {
                Text(
                    part.title,
                    style = MaterialTheme.typography.titleSmall,
                    textAlign = TextAlign.Center,
                    color = OttlibColors.Muted,
                    modifier = Modifier.align(Alignment.Center).padding(8.dp),
                )
            }
        }
        Text(
            part.title,
            style = MaterialTheme.typography.labelMedium,
            color = OttlibColors.Muted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 6.dp, start = 2.dp, end = 2.dp),
        )
        Text(
            listOfNotNull(part.year?.toString(), "Find").joinToString(" · "),
            style = MaterialTheme.typography.labelSmall,
            color = OttlibColors.Accent,
            maxLines = 1,
            modifier = Modifier.padding(horizontal = 2.dp),
        )
    }
}
