package dev.ottlib.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.tv.material3.Button
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.OutlinedButton
import androidx.tv.material3.Text
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.core.presentation.update.UpdateState
import dev.ottlib.core.presentation.update.UpdateText
import dev.ottlib.core.presentation.update.performAction

/**
 * A strip announcing a new app release, or the progress of one being installed. It never takes initial focus: press
 * ↑ from the first row (or the address field) to reach its buttons.
 */
@Composable
fun UpdateBanner(modifier: Modifier = Modifier) {
    val updates = appContainer().updates
    val state by updates.banner.collectAsStateWithLifecycle()
    LifecycleResumeEffect(updates) {
        updates.onResume()
        onPauseOrDispose { }
    }
    val current = state ?: return
    val shape = RoundedCornerShape(12.dp)
    Row(
        modifier.fillMaxWidth().background(OttlibColors.Surface, shape).border(1.dp, if (current is UpdateState.Failed) OttlibColors.Error else OttlibColors.Accent, shape)
            .padding(horizontal = 20.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(UpdateText.headline(current), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, color = OttlibColors.Foreground)
            UpdateText.detail(current)?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Muted) }
        }
        UpdateText.action(current)?.let { label -> Button(onClick = updates::performAction) { Text(label) } }
        UpdateText.dismiss(current)?.let { label -> OutlinedButton(onClick = updates::later) { Text(label) } }
    }
}
