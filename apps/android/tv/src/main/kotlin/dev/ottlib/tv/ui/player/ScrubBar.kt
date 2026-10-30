package dev.ottlib.tv.ui.player

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import dev.ottlib.core.presentation.formatOffset
import dev.ottlib.core.presentation.formatPosition

/**
 * The TV scrub bar: the server frame above the head (when the source has frames), the target time, its offset from
 * where playback was and the total, then the track with a marker at the base, the fill up to the head and the head.
 * Not focusable: the PlayerView keeps focus and the remote keys drive it.
 */
@Composable
fun ScrubBar(state: ScrubState, frame: String?, modifier: Modifier = Modifier) {
    val total = maxOf(state.durationMs, state.head, 1L).toFloat()
    val head = (state.head / total).coerceIn(0f, 1f)
    val base = (state.base / total).coerceIn(0f, 1f)
    val fill = MaterialTheme.colorScheme.primary
    val dim = Color.White.copy(alpha = 0.8f)
    Column(
        modifier
            .fillMaxWidth()
            .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.75f))))
            .padding(start = 40.dp, end = 40.dp, bottom = 40.dp, top = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (state.framesOn) {
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                // Centred over the head, kept inside the bar's ends.
                val x = (maxWidth * head - FRAME_PREVIEW_WIDTH / 2).coerceIn(0.dp, (maxWidth - FRAME_PREVIEW_WIDTH).coerceAtLeast(0.dp))
                FramePreview(frame, Modifier.offset(x = x))
            }
        }
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(formatPosition(state.head), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = Color.White)
            Text(formatOffset(state.head - state.base), style = MaterialTheme.typography.titleMedium, color = dim)
            Spacer(Modifier.weight(1f))
            if (state.durationMs > 0) Text(formatPosition(state.durationMs), style = MaterialTheme.typography.titleMedium, color = dim)
        }
        Canvas(Modifier.fillMaxWidth().height(20.dp)) {
            val y = size.height / 2
            val track = 6.dp.toPx()
            drawLine(Color.White.copy(alpha = 0.3f), Offset(0f, y), Offset(size.width, y), track, StrokeCap.Round)
            drawLine(fill, Offset(0f, y), Offset(size.width * head, y), track, StrokeCap.Round)
            val marker = size.width * base
            drawLine(Color.White, Offset(marker, y - 9.dp.toPx()), Offset(marker, y + 9.dp.toPx()), 3.dp.toPx())
            drawCircle(Color.White, radius = 9.dp.toPx(), center = Offset(size.width * head, y))
        }
        Text("OK to jump · Back to cancel", style = MaterialTheme.typography.bodySmall, color = dim)
    }
}
