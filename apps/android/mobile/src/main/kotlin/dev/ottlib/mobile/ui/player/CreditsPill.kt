package dev.ottlib.mobile.ui.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

/**
 * "Skip credits", or the up-next countdown that started at the credits with "Watch credits". Sized to its content
 * (the message wraps under a width cap), so it fits the Fold's cover screen as well as a tablet.
 */
@Composable
fun CreditsPill(upNext: String?, onSkip: () -> Unit, onWatchCredits: () -> Unit, modifier: Modifier = Modifier) {
    Surface(color = Color.Black.copy(alpha = 0.6f), shape = RoundedCornerShape(24.dp), modifier = modifier) {
        Row(
            Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (upNext != null) {
                Text(upNext, style = MaterialTheme.typography.bodyMedium, color = Color.White, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.widthIn(max = 220.dp))
                Button(onClick = onWatchCredits) { Text("Watch credits") }
            } else {
                Button(onClick = onSkip) { Text("Skip credits") }
            }
        }
    }
}
