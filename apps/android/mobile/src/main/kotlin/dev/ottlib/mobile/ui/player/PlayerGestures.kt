package dev.ottlib.mobile.ui.player

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.unit.dp
import kotlin.math.abs

/** Thirds of the video, left to right (mirrored layouts don't apply to video). */
enum class Zone { Start, Center, End }

/**
 * What touch on the video does. Vertical deltas are fractions of the video's height (positive = up); horizontal
 * totals are fractions of its width (positive = right).
 */
class PlayerGestureHandler(
    val onTap: () -> Unit,
    val onDoubleTap: (Zone) -> Unit,
    val onVerticalDragStart: (Zone) -> Unit,
    val onVerticalDrag: (Zone, Float) -> Unit,
    val onHorizontalDrag: (Float) -> Unit,
    val onHorizontalDragEnd: (Float) -> Unit,
    val onPinch: (zoomIn: Boolean) -> Unit,
)

private enum class Gesture { Vertical, Horizontal, Pinch }

/**
 * Tap to show/hide controls, double-tap the sides to skip, swipe up/down on the left half for brightness and the
 * right half for volume, swipe sideways to seek, pinch to zoom. Swipes that start at the top or bottom edge are left
 * alone: those reveal the hidden system bars.
 */
fun Modifier.playerGestures(handler: () -> PlayerGestureHandler): Modifier = this
    .pointerInput(Unit) {
        detectTapGestures(
            onTap = { handler().onTap() },
            onDoubleTap = { handler().onDoubleTap(zoneOf(it.x, size.width.toFloat())) },
        )
    }
    .pointerInput(Unit) {
        val edge = SYSTEM_EDGE.toPx()
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false)
            if (down.position.y < edge || down.position.y > size.height - edge) return@awaitEachGesture
            val side = if (down.position.x < size.width / 2f) Zone.Start else Zone.End
            var gesture: Gesture? = null
            var horizontal = 0f
            var pinchStart = 0f
            var pinchRatio = 1f

            while (true) {
                val event = awaitPointerEvent()
                val pressed = event.changes.filter { it.pressed }
                if (pressed.isEmpty()) break
                // A second finger before a swipe has started turns the gesture into a pinch for the rest of it.
                if (pressed.size >= 2 && (gesture == null || gesture == Gesture.Pinch)) {
                    val distance = (pressed[0].position - pressed[1].position).getDistance()
                    if (gesture == null) {
                        gesture = Gesture.Pinch
                        pinchStart = distance.coerceAtLeast(1f)
                    }
                    pinchRatio = distance / pinchStart
                    event.changes.forEach { it.consume() }
                    continue
                }
                if (gesture == Gesture.Pinch) {
                    event.changes.forEach { it.consume() }
                    continue
                }
                val change = event.changes.firstOrNull { it.id == down.id } ?: break
                if (gesture == null) {
                    val moved = change.position - down.position
                    if (moved.getDistance() < viewConfiguration.touchSlop) continue
                    gesture = if (abs(moved.x) > abs(moved.y)) Gesture.Horizontal else Gesture.Vertical
                    if (gesture == Gesture.Vertical) handler().onVerticalDragStart(side)
                }
                when (gesture) {
                    Gesture.Vertical -> handler().onVerticalDrag(side, -change.positionChange().y / size.height)
                    Gesture.Horizontal -> {
                        horizontal = (change.position.x - down.position.x) / size.width
                        handler().onHorizontalDrag(horizontal)
                    }
                    else -> Unit
                }
                change.consume()
            }

            when (gesture) {
                Gesture.Horizontal -> handler().onHorizontalDragEnd(horizontal)
                Gesture.Pinch -> when {
                    pinchRatio > PINCH_OUT_RATIO -> handler().onPinch(true)
                    pinchRatio < PINCH_IN_RATIO -> handler().onPinch(false)
                }
                else -> Unit
            }
        }
    }

private fun zoneOf(x: Float, width: Float): Zone = when {
    x < width / 3 -> Zone.Start
    x > width * 2 / 3 -> Zone.End
    else -> Zone.Center
}

private val SYSTEM_EDGE = 32.dp
private const val PINCH_OUT_RATIO = 1.15f
private const val PINCH_IN_RATIO = 0.87f
