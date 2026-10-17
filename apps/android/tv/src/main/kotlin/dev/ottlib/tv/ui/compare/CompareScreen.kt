package dev.ottlib.tv.ui.compare

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.OutlinedButton
import androidx.tv.material3.Surface
import androidx.tv.material3.SurfaceDefaults
import androidx.tv.material3.Text
import dev.ottlib.core.presentation.LoadState
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.compare.CompareEvent
import dev.ottlib.core.presentation.compare.CompareViewModel
import dev.ottlib.core.presentation.compare.CopyColumn
import dev.ottlib.core.presentation.compare.CopyComparison
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.tv.ui.components.ConfirmDialog
import dev.ottlib.tv.ui.components.EmptyMessage
import dev.ottlib.tv.ui.components.ErrorMessage
import dev.ottlib.tv.ui.components.LoadingMessage
import dev.ottlib.tv.ui.components.ScreenPadding
import dev.ottlib.tv.ui.components.tryRequestFocus

/** The copies of one title side by side, with the better picture marked, and a guarded way to delete one. */
@Composable
fun CompareScreen(movieId: Long, onOpenOther: (Long) -> Unit, onBack: () -> Unit) {
    val container = appContainer()
    val viewModel = viewModel(key = "compare-$movieId") { CompareViewModel(container.api, container.continueWatching, container.appScope, movieId) }
    val state by viewModel.comparison.collectAsStateWithLifecycle()
    val deleting by viewModel.deleting.collectAsStateWithLifecycle()
    val deleteError by viewModel.deleteError.collectAsStateWithLifecycle()
    var pendingDelete by remember { mutableStateOf<CopyColumn?>(null) }

    LaunchedEffect(viewModel) {
        viewModel.events.collect { event ->
            pendingDelete = null
            when (event) {
                is CompareEvent.OpenOther -> onOpenOther(event.movieId)
                CompareEvent.Close -> onBack()
            }
        }
    }

    Column(Modifier.fillMaxSize().padding(top = 24.dp)) {
        Text("Compare copies", style = MaterialTheme.typography.headlineMedium, color = OttlibColors.Foreground, modifier = Modifier.padding(horizontal = ScreenPadding))
        Text("Green marks the stronger picture. Deleting a copy removes its file from disk.", style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Muted, modifier = Modifier.padding(horizontal = ScreenPadding, vertical = 4.dp))
        when (val current = state) {
            LoadState.Loading -> LoadingMessage()
            is LoadState.Failed -> ErrorMessage(current.message, actionLabel = "Back", onAction = onBack)
            is LoadState.Loaded -> if (current.value.columns.size < 2) EmptyMessage("No other copies of this title are in your library.")
            else Copies(current.value, onDelete = { pendingDelete = it })
        }
    }

    pendingDelete?.let { copy ->
        ConfirmDialog(
            title = "Delete this copy from disk?",
            message = "This permanently deletes the video file from the server's drive. It does not go to the Recycle Bin and cannot be undone.",
            details = "${copy.fileName}\n${copy.filePath}\nThe other copies stay in your library. Subtitle files beside the video are not touched.",
            confirmLabel = "Delete file permanently",
            busy = deleting,
            onConfirm = { viewModel.delete(copy.movieId) },
            onDismiss = { pendingDelete = null },
        )
    }
    deleteError?.let { message ->
        ConfirmDialog(title = "Could not delete", message = message, confirmLabel = "OK", onConfirm = viewModel::dismissError, onDismiss = viewModel::dismissError)
    }
}

@Composable
private fun Copies(comparison: CopyComparison, onDelete: (CopyColumn) -> Unit) {
    val firstDelete = remember { FocusRequester() }
    LazyRow(
        modifier = Modifier.focusRestorer(),
        contentPadding = PaddingValues(horizontal = ScreenPadding, vertical = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        itemsIndexed(comparison.columns, key = { _, column -> column.movieId }) { index, column ->
            Surface(shape = RoundedCornerShape(12.dp), colors = SurfaceDefaults.colors(containerColor = OttlibColors.Surface)) {
                Column(Modifier.width(360.dp).padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(column.heading, style = MaterialTheme.typography.labelLarge, color = OttlibColors.Accent)
                    // Directly under the heading, never after the variable-height rows: every column then has its button at the
                    // same height and on screen, so D-pad left/right always finds the neighbouring copy's button.
                    OutlinedButton(onClick = { onDelete(column) }, modifier = Modifier.then(if (index == 0) Modifier.focusRequester(firstDelete) else Modifier)) { Text("Delete this copy…") }
                    Text(column.fileName, style = MaterialTheme.typography.titleSmall, color = OttlibColors.Foreground, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    comparison.rows.forEach { row ->
                        val cell = row.cells[index]
                        Column {
                            Text(row.label, style = MaterialTheme.typography.labelSmall, color = OttlibColors.Muted)
                            Text(
                                cell.text,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = if (cell.best) FontWeight.Bold else FontWeight.Normal,
                                color = if (cell.best) OttlibColors.Success else OttlibColors.Foreground,
                                maxLines = 4,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }
        }
    }
    LaunchedEffect(Unit) { firstDelete.tryRequestFocus() }
}
