package dev.ottlib.mobile.ui.components

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.core.presentation.update.UpdateState
import dev.ottlib.core.presentation.update.UpdateText
import dev.ottlib.core.presentation.update.performAction

/** A card announcing a new app release, or the progress of one being installed. */
@Composable
fun UpdateBanner(modifier: Modifier = Modifier) {
    val updates = appContainer().updates
    val state by updates.banner.collectAsStateWithLifecycle()
    LifecycleResumeEffect(updates) {
        updates.onResume()
        onPauseOrDispose { }
    }
    val current = state ?: return
    val context = LocalContext.current
    Card(modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = OttlibColors.Surface)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(UpdateText.headline(current), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            UpdateText.detail(current)?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = if (current is UpdateState.Failed) OttlibColors.Error else OttlibColors.Muted) }
            if (current is UpdateState.Downloading) {
                val progress = current.progress
                if (progress == null) LinearProgressIndicator(Modifier.fillMaxWidth()) else LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth())
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                UpdateText.action(current)?.let { label -> Button(onClick = updates::performAction) { Text(label) } }
                UpdateText.dismiss(current)?.let { label -> TextButton(onClick = updates::later) { Text(label) } }
                if (current is UpdateState.Available) TextButton(onClick = {
                    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(current.release.pageUrl))) }
                }) { Text("What's new") }
            }
        }
    }
}
