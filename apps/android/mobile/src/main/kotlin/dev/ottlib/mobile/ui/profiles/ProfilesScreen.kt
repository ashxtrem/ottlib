package dev.ottlib.mobile.ui.profiles

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.ottlib.core.model.ProfileSummary
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.profiles.ProfilesUiState
import dev.ottlib.core.presentation.profiles.ProfilesViewModel
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.mobile.ui.components.LoadingMessage
import dev.ottlib.mobile.ui.components.gutter
import dev.ottlib.mobile.ui.components.windowWidth
import dev.ottlib.mobile.ui.connect.PinEntry

/**
 * "Who's watching?". [onPicked] once a profile is in use. Back from a switch ([ProfilesUiState.canCancel]) keeps the
 * profile in use and calls [onCancelled]; otherwise the picker is the only screen and Back leaves the app.
 */
@Composable
fun ProfilesScreen(onPicked: () -> Unit, onCancelled: () -> Unit) {
    val container = appContainer()
    val viewModel = viewModel { ProfilesViewModel(container.profileSession) }
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(state.done) { if (state.done) onPicked() }
    // Enabled only when Back has somewhere to go; at start or after a 409 the system Back closes the app.
    BackHandler(enabled = state.pinFor == null && state.canCancel) { if (viewModel.cancel()) onCancelled() }

    Scaffold { padding ->
        val locked = state.pinFor
        when {
            state.done || state.loading -> LoadingMessage(Modifier.padding(padding))
            locked != null -> Box(Modifier.fillMaxSize().padding(padding).padding(24.dp)) {
                PinEntry(
                    title = "Enter PIN for ${locked.name}",
                    message = "This profile is locked with a PIN.",
                    key = locked.id.toString(),
                    checking = state.busy,
                    error = state.error,
                    onSubmit = viewModel::submitPin,
                    onCancel = viewModel::closePin,
                    cancelLabel = "Choose another profile",
                )
            }
            // Profiles not listed yet: a spinner, never an empty picker.
            state.profiles.isEmpty() -> if (state.error != null) {
                Text(state.error.orEmpty(), color = OttlibColors.Error, modifier = Modifier.padding(padding).padding(24.dp))
            } else {
                LoadingMessage(Modifier.padding(padding))
            }
            else -> ProfileGrid(state, viewModel::choose, Modifier.padding(padding))
        }
    }
}

@Composable
private fun ProfileGrid(state: ProfilesUiState, onChoose: (ProfileSummary) -> Unit, modifier: Modifier = Modifier) {
    val width = windowWidth()
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        LazyVerticalGrid(
            columns = GridCells.Fixed(width.profileColumns),
            contentPadding = PaddingValues(horizontal = width.gutter, vertical = 32.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
            modifier = Modifier.widthIn(max = 840.dp).fillMaxWidth(),
        ) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 12.dp)) {
                    Text("Who's watching?", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                    state.error?.let { Text(it, color = OttlibColors.Error, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
                }
            }
            items(state.profiles, key = { it.id }) { profile -> ProfileTile(profile, enabled = !state.busy) { onChoose(profile) } }
        }
    }
}

@Composable
private fun ProfileTile(profile: ProfileSummary, enabled: Boolean, onClick: () -> Unit) {
    val label = if (profile.hasPin) "${profile.name}, locked with a PIN" else profile.name
    Column(
        Modifier
            .clickable(enabled = enabled, onClick = onClick)
            .semantics(mergeDescendants = true) { contentDescription = label }
            .padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        ProfileAvatar(profile, 88.dp)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(profile.name, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
            if (profile.hasPin) Icon(Icons.Filled.Lock, contentDescription = null, tint = OttlibColors.Muted, modifier = Modifier.size(16.dp))
        }
    }
}
