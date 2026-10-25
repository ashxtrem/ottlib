package dev.ottlib.tv.ui.settings

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.tv.material3.ListItem
import androidx.tv.material3.Text
import dev.ottlib.core.data.ProfileState
import dev.ottlib.core.data.canSwitchProfile
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.tv.ui.profiles.ProfileAvatar
import dev.ottlib.tv.ui.profiles.SwitchProfileFocus

/** "Profile" with Switch profile; shown under the same rule as the top bar's profile chip. */
@Composable
fun ProfileSettingsSection(focus: SwitchProfileFocus) {
    val state by appContainer().profileSession.state.collectAsStateWithLifecycle()
    val selected = state as? ProfileState.Selected ?: return
    if (!selected.canSwitchProfile) return
    SectionTitle("Profile")
    ListItem(
        selected = false,
        onClick = focus::open,
        modifier = Modifier.focusRequester(focus.requester),
        leadingContent = { ProfileAvatar(selected.profile, size = 32.dp) },
        headlineContent = { Text("Switch profile") },
        supportingContent = { Text("Watching as ${selected.profile.name}") },
        trailingContent = { Text("Switch", color = OttlibColors.Accent) },
    )
}
