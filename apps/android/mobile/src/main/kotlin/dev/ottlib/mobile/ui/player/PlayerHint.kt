package dev.ottlib.mobile.ui.player

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.BrightnessMedium
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.ottlib.core.presentation.theme.OttlibColors

enum class HintPosition { Start, Center, End }

/** Short-lived feedback drawn over the video: seek targets, brightness/volume levels, picture changes. */
data class PlayerHint(
    val text: String,
    val icon: ImageVector? = null,
    val level: Float? = null,
    val position: HintPosition = HintPosition.Center,
    val visibleMs: Long = 900,
    val id: Long = System.nanoTime(),
) {
    companion object {
        fun brightness(level: Float) = PlayerHint("${(level * 100).toInt()}%", Icons.Filled.BrightnessMedium, level, HintPosition.Start)
        fun volume(level: Float) = PlayerHint(
            "${(level * 100).toInt()}%",
            if (level <= 0f) Icons.AutoMirrored.Filled.VolumeOff else Icons.AutoMirrored.Filled.VolumeUp,
            level,
            HintPosition.End,
        )
    }
}

@Composable
fun BoxScope.PlayerHintOverlay(hint: PlayerHint?) {
    hint ?: return
    val alignment = when (hint.position) {
        HintPosition.Start -> Alignment.CenterStart
        HintPosition.Center -> Alignment.Center
        HintPosition.End -> Alignment.CenterEnd
    }
    Box(Modifier.matchParentSize().padding(horizontal = 48.dp), contentAlignment = alignment) {
        Column(
            Modifier.background(OttlibColors.Surface.copy(alpha = 0.8f), RoundedCornerShape(16.dp)).padding(horizontal = 20.dp, vertical = 14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            hint.icon?.let { Icon(it, contentDescription = null, tint = Color.White, modifier = Modifier.size(28.dp)) }
            hint.level?.let { LinearProgressIndicator(progress = { it }, color = OttlibColors.Accent, trackColor = Color.White.copy(alpha = 0.25f), modifier = Modifier.width(96.dp)) }
            Text(hint.text, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)
        }
    }
}
