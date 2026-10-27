package dev.ottlib.tv.ui.player

import android.view.KeyEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Button
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import dev.ottlib.tv.ui.components.tryRequestFocus

/**
 * "Skip credits", or the up-next countdown that started at the credits with "Watch credits". It takes focus when it
 * appears with the controls hidden, and again whenever the controls hide; OK presses it. [onFocused] reports whether it
 * holds focus, so the surface can pass D-pad keys on to the player and give focus back when the pill goes.
 */
@Composable
fun CreditsPill(
    upNext: String?,
    controlsVisible: Boolean,
    onFocused: (Boolean) -> Unit,
    onSkip: () -> Unit,
    onWatchCredits: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val focus = remember { FocusRequester() }
    var focused by remember { mutableStateOf(false) }
    val counting = upNext != null
    Column(
        modifier
            .onFocusChanged { focused = it.hasFocus; onFocused(it.hasFocus) }
            .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(16.dp))
            .padding(16.dp),
        horizontalAlignment = Alignment.End,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (upNext != null) {
            Text(upNext, style = MaterialTheme.typography.titleMedium, color = Color.White)
            Button(onClick = onWatchCredits, modifier = Modifier.focusRequester(focus)) { Text("Watch credits") }
        } else {
            Button(onClick = onSkip, modifier = Modifier.focusRequester(focus)) { Text("Skip credits") }
        }
    }
    // The video view may hold focus as the pill appears; keep asking for a few frames until focus is inside.
    LaunchedEffect(controlsVisible, counting) {
        if (controlsVisible) return@LaunchedEffect
        repeat(FOCUS_ATTEMPTS) {
            withFrameNanos { }
            if (focused) return@LaunchedEffect
            focus.tryRequestFocus()
        }
    }
}

/** D-pad directions pressed on the pill go to the player's own handling (seek, or show the controls). */
internal val PILL_PASS_THROUGH_KEYS = setOf(KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_DOWN)

private const val FOCUS_ATTEMPTS = 10
