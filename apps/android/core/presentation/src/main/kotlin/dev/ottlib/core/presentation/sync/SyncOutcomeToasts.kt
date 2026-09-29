package dev.ottlib.core.presentation.sync

import android.widget.Toast
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalContext
import dev.ottlib.core.presentation.appContainer

/**
 * Tells the viewer how a sync ended ("Library synced: 3 new titles"). Place once near the root of an app's UI, so the
 * result shows wherever the viewer is when the sync finishes — not only on the screen with the Sync button.
 */
@Composable
fun SyncOutcomeToasts() {
    val sync = appContainer().librarySync
    val context = LocalContext.current
    LaunchedEffect(sync) {
        sync.outcomes.collect { Toast.makeText(context, it.message(), Toast.LENGTH_LONG).show() }
    }
}
