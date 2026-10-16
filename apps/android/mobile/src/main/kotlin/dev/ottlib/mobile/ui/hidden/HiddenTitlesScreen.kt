package dev.ottlib.mobile.ui.hidden

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.ottlib.core.presentation.Choice
import dev.ottlib.core.presentation.PosterItem
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.hidden.HiddenTitlesViewModel
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.mobile.ui.components.ChoiceDialog
import dev.ottlib.mobile.ui.components.EmptyMessage
import dev.ottlib.mobile.ui.components.PosterGrid
import dev.ottlib.mobile.ui.components.gutter
import dev.ottlib.mobile.ui.components.windowWidth

private const val UNHIDE = "unhide"
private const val OPEN = "open"

/** Titles hidden on this device. They stay visible on every other device. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HiddenTitlesScreen(onOpenMovie: (Long) -> Unit, onBack: () -> Unit) {
    val container = appContainer()
    val viewModel = viewModel { HiddenTitlesViewModel(container.hiddenTitles, container.api) }
    val items by viewModel.items.collectAsStateWithLifecycle()
    var chosen by remember { mutableStateOf<PosterItem?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Hidden titles") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") } },
                actions = { if ((items?.size ?: 0) > 1) TextButton(onClick = viewModel::unhideAll) { Text("Unhide all") } },
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Text(
                "Hidden only on this device. Other devices still show them.",
                style = MaterialTheme.typography.bodySmall,
                color = OttlibColors.Muted,
                modifier = Modifier.padding(horizontal = windowWidth().gutter, vertical = 4.dp),
            )
            val current = items
            if (current != null && current.isEmpty()) EmptyMessage("Nothing is hidden. Use Hide in a title's menu to keep it out of your lists.")
            else if (current != null) PosterGrid(current, onOpen = { chosen = it })
        }
    }
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
