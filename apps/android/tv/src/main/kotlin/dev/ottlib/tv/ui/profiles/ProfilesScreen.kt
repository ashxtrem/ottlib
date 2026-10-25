package dev.ottlib.tv.ui.profiles

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import dev.ottlib.core.model.ProfileSummary
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.profiles.ProfilesViewModel
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.tv.ui.components.LoadingMessage
import dev.ottlib.tv.ui.components.ScreenPadding
import dev.ottlib.tv.ui.components.tryRequestFocus
import dev.ottlib.tv.ui.connect.PinEntry

/**
 * "Who's watching?": the server's profiles, then a PIN step for locked ones. [onPicked] once a profile is in use.
 * Back on the list calls [onCancelled] when the picker came from Switch profile (the profile in use stays), else
 * [onExit] (at start, or after the server asked for a profile).
 */
@Composable
fun ProfilesScreen(currentId: Int?, onPicked: () -> Unit, onCancelled: () -> Unit, onExit: () -> Unit) {
    val container = appContainer()
    val viewModel = viewModel { ProfilesViewModel(container.profileSession) }
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    // Back from a PIN step returns focus to the tile it was opened from.
    var chosenId by rememberSaveable { mutableStateOf<Int?>(null) }

    LaunchedEffect(state.done) { if (state.done) onPicked() }

    state.pinFor?.let { profile ->
        PinEntry(
            title = "Enter ${profile.name}'s PIN",
            message = "This profile is protected with a PIN.",
            key = "profile-${profile.id}",
            cancelLabel = "Choose another profile",
            checking = state.busy,
            error = state.error,
            onSubmit = viewModel::submitPin,
            onCancel = viewModel::closePin,
        )
        return
    }

    BackHandler { if (viewModel.cancel()) onCancelled() else onExit() }

    // Until the list arrives: a spinner, never an empty-state message.
    if (state.done || (state.profiles.isEmpty() && state.error == null)) {
        LoadingMessage()
        return
    }

    Column(
        Modifier.fillMaxSize().padding(ScreenPadding),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(32.dp, Alignment.CenterVertically),
    ) {
        Text("Who's watching?", style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold, color = OttlibColors.Foreground)
        ProfileRow(state.profiles, chosenId ?: currentId, enabled = !state.busy, onChoose = { chosenId = it.id; viewModel.choose(it) })
        Text("Add or edit profiles in the web app or the phone app.", style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Muted)
        state.error?.let { Text(it, style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Error) }
    }
}

/** The tiles; focus starts on [focusId] (the tile last chosen, else the profile last in use), else the first. */
@Composable
private fun ProfileRow(profiles: List<ProfileSummary>, focusId: Int?, enabled: Boolean, onChoose: (ProfileSummary) -> Unit) {
    if (profiles.isEmpty()) return
    val initial = remember { FocusRequester() }
    val target = profiles.firstOrNull { it.id == focusId } ?: profiles.first()
    Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
        profiles.forEach { profile ->
            ProfileTile(
                profile = profile,
                enabled = enabled,
                onClick = { onChoose(profile) },
                modifier = if (profile.id == target.id) Modifier.focusRequester(initial) else Modifier,
            )
        }
    }
    LaunchedEffect(target.id) { initial.tryRequestFocus() }
}
