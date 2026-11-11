package dev.ottlib.tv.ui.search

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.OutlinedButton
import androidx.tv.material3.Text
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.tv.ui.components.ScreenPadding

/** "No titles match" with a button that hands the typed text to Hashlark's Find. The search field's ↓ lands on the button. */
@Composable
fun NoMatchFind(query: String, onFind: () -> Unit, focusRequester: FocusRequester) {
    Column(
        Modifier.fillMaxSize().padding(ScreenPadding),
        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("No titles match “$query”.", style = MaterialTheme.typography.titleMedium, color = OttlibColors.Muted, textAlign = TextAlign.Center)
        OutlinedButton(onClick = onFind, modifier = Modifier.focusRequester(focusRequester)) {
            Text("Find “$query” in Hashlark", maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}
