package dev.ottlib.tv.ui.profiles

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import dev.ottlib.core.data.ProfileState
import dev.ottlib.core.data.canSwitchProfile
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.tv.ui.components.tryRequestFocus

/**
 * Focus for a control that opens the profile picker with [ProfileSession.switch][dev.ottlib.core.data.ProfileSession.switch]:
 * [open] remembers (in the screen's saved state) that the picker was opened from here, and when Back returns to the
 * screen focus goes back to [requester]. Hold it outside any `if` that hides the control while the picker shows.
 */
class SwitchProfileFocus internal constructor(val requester: FocusRequester, private val pending: MutableState<Boolean>, private val onSwitch: () -> Unit) {
    fun open() {
        pending.value = true
        onSwitch()
    }
}

@Composable
fun rememberSwitchProfileFocus(): SwitchProfileFocus {
    val session = appContainer().profileSession
    val requester = remember { FocusRequester() }
    val pending = rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        if (!pending.value) return@LaunchedEffect
        pending.value = false
        // After the screen's own initial focus, which is requested on the first frame.
        withFrameNanos { }
        withFrameNanos { }
        requester.tryRequestFocus()
    }
    return remember(session) { SwitchProfileFocus(requester, pending, session::switch) }
}

/** The profile in use, in the top bar; selecting it opens the picker. Only shown when switching leads somewhere. */
@Composable
fun ProfileChip(focus: SwitchProfileFocus) {
    val state by appContainer().profileSession.state.collectAsStateWithLifecycle()
    val selected = state as? ProfileState.Selected ?: return
    if (!selected.canSwitchProfile) return
    Surface(
        onClick = focus::open,
        modifier = Modifier.focusRequester(focus.requester),
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(50)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = OttlibColors.Canvas.copy(alpha = 0f),
            contentColor = OttlibColors.Muted,
            focusedContainerColor = OttlibColors.Foreground,
            focusedContentColor = OttlibColors.Canvas,
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.05f),
    ) {
        Row(Modifier.padding(start = 6.dp, end = 16.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ProfileAvatar(selected.profile, size = 28.dp)
            Text(selected.profile.name, style = MaterialTheme.typography.labelLarge, maxLines = 1)
        }
    }
}
