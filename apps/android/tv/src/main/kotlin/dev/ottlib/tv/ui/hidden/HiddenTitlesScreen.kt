package dev.ottlib.tv.ui.hidden

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.OutlinedButton
import androidx.tv.material3.Text
import dev.ottlib.core.presentation.Choice
import dev.ottlib.core.presentation.PosterItem
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.hidden.HiddenTitlesViewModel
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.tv.ui.components.ChoiceDialog
import dev.ottlib.tv.ui.components.EmptyMessage
import dev.ottlib.tv.ui.components.PosterGrid
import dev.ottlib.tv.ui.components.ScreenPadding
import dev.ottlib.tv.ui.components.tryRequestFocus

private const val UNHIDE = "unhide"
private const val OPEN = "open"

/** Titles hidden on this TV. They stay visible on every other device. */
@Composable
fun HiddenTitlesScreen(onOpenMovie: (Long) -> Unit) {
    val container = appContainer()
    val viewModel = viewModel { HiddenTitlesViewModel(container.hiddenTitles, container.api) }
    val items by viewModel.items.collectAsStateWithLifecycle()
    var chosen by remember { mutableStateOf<PosterItem?>(null) }
    val firstPoster = remember { FocusRequester() }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = ScreenPadding, vertical = 20.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column {
                Text("Hidden titles", style = MaterialTheme.typography.headlineMedium, color = OttlibColors.Foreground)
                Text("Hidden only on this TV. Other devices still show them.", style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Muted)
            }
            if ((items?.size ?: 0) > 1) OutlinedButton(onClick = viewModel::unhideAll) { Text("Unhide all") }
        }
        val current = items
        if (current != null && current.isEmpty()) EmptyMessage("Nothing is hidden. Choose Hide on a title's page to keep it out of your lists.")
        else if (current != null) PosterGrid(current, onOpen = { chosen = it }, focusRequester = firstPoster)
    }
    LaunchedEffect(items?.isNotEmpty()) { if (items?.isNotEmpty() == true) firstPoster.tryRequestFocus() }
    chosen?.let { poster ->
        ChoiceDialog(
            poster.title,
            listOf(Choice("Unhide", UNHIDE), Choice("Open details", OPEN)),
            UNHIDE,
            onSelect = { if (it == UNHIDE) viewModel.unhide(poster.hideKey) else onOpenMovie(poster.id) },
            onDismiss = { chosen = null },
        )
    }
}
