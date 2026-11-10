package dev.ottlib.tv.ui.details

import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import coil3.compose.AsyncImage
import dev.ottlib.core.presentation.theme.OttlibColors

/** The title's logo when it has one that loads; otherwise the title as text. */
@Composable
fun TitleLogo(logoUrl: String?, title: String) {
    var failed by remember(logoUrl) { mutableStateOf(false) }
    if (logoUrl != null && !failed) {
        AsyncImage(
            model = logoUrl,
            contentDescription = title,
            contentScale = ContentScale.Fit,
            alignment = Alignment.CenterStart,
            onError = { failed = true },
            modifier = Modifier.heightIn(max = 110.dp).widthIn(max = 460.dp),
        )
    } else {
        Text(title, style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold, color = OttlibColors.Foreground, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}
