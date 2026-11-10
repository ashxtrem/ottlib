package dev.ottlib.mobile.ui.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import coil3.compose.AsyncImage

/**
 * The title's logo art when it has one, else (or when the logo fails to load) the title as text.
 * The logo keeps the title as its content description, so screen readers still hear the name.
 */
@Composable
fun TitleLogo(logoUrl: String?, title: String, maxHeight: Dp, maxWidth: Dp, style: TextStyle, modifier: Modifier = Modifier, maxLines: Int = 2) {
    var failed by remember(logoUrl) { mutableStateOf(false) }
    if (logoUrl != null && !failed) {
        AsyncImage(
            model = logoUrl,
            contentDescription = title,
            contentScale = ContentScale.Fit,
            alignment = Alignment.CenterStart,
            onError = { failed = true },
            modifier = modifier.widthIn(max = maxWidth).fillMaxWidth().height(maxHeight),
        )
    } else {
        Text(title, style = style, fontWeight = FontWeight.Bold, maxLines = maxLines, overflow = TextOverflow.Ellipsis, modifier = modifier)
    }
}
