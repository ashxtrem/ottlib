package dev.ottlib.mobile.ui.profiles

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.ottlib.core.model.ProfileSummary
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.profiles.ProfileManageUiState
import dev.ottlib.core.presentation.profiles.ProfileManageViewModel
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.mobile.ui.components.LoadingMessage

/** The open dialog: a form for a new profile (target null) or an existing one, its PIN, or a delete confirm. */
private sealed interface ManageDialog {
    data class Form(val target: ProfileSummary?) : ManageDialog
    data class Pin(val target: ProfileSummary) : ManageDialog
    data class Delete(val target: ProfileSummary) : ManageDialog
}

/** Settings → Manage profiles: the list with what the profile in use may do to each, and Add profile for the owner. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileManageScreen(onBack: () -> Unit) {
    val container = appContainer()
    val viewModel = viewModel { ProfileManageViewModel(container.api, container.profileSession) }
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var dialog by remember { mutableStateOf<ManageDialog?>(null) }
    val open: (ManageDialog) -> Unit = { viewModel.clearError(); dialog = it }
    // A change the server accepted closes the dialog it came from.
    LaunchedEffect(state.saved) { dialog = null }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Profiles") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") } },
            )
        },
    ) { padding ->
        if (state.loading) {
            LoadingMessage(Modifier.padding(padding))
            return@Scaffold
        }
        Box(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()), contentAlignment = Alignment.TopCenter) {
            Column(Modifier.widthIn(max = 720.dp).fillMaxWidth().padding(bottom = 24.dp)) {
                state.profiles.forEach { profile -> ProfileRow(profile, state, profileActions(viewModel.rightsFor(profile)), open) }
                if (state.canAdd) {
                    TextButton(onClick = { open(ManageDialog.Form(null)) }, modifier = Modifier.padding(horizontal = 8.dp)) {
                        Icon(Icons.Filled.Add, contentDescription = null)
                        Text("Add profile", modifier = Modifier.padding(start = 8.dp))
                    }
                }
                Text(
                    "Profile PINs keep watch lists separate. They don't secure the library.",
                    style = MaterialTheme.typography.bodySmall,
                    color = OttlibColors.Muted,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
                if (dialog == null) state.error?.let { Text(it, color = OttlibColors.Error, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) }
            }
        }
    }

    ManageDialogs(dialog, state, viewModel) { dialog = null }
}

@Composable
private fun ProfileRow(profile: ProfileSummary, state: ProfileManageUiState, actions: List<ProfileAction>, open: (ManageDialog) -> Unit) {
    val details = listOfNotNull(
        "Owner".takeIf { profile.isOwner },
        "PIN".takeIf { profile.hasPin },
        "In use".takeIf { profile.id == state.me?.id },
    ).joinToString("  ·  ")
    ListItem(
        leadingContent = { ProfileAvatar(profile, 40.dp) },
        headlineContent = { Text(profile.name) },
        // Actions sit under the name, not trailing, so a long name still fits on the Fold's cover screen.
        supportingContent = {
            Column {
                if (details.isNotEmpty()) Text(details)
                if (actions.isNotEmpty()) Row {
                    actions.forEach { action ->
                        TextButton(onClick = { open(dialogFor(action, profile)) }, enabled = !state.busy) {
                            Text(action.label, color = if (action == ProfileAction.Delete) OttlibColors.Error else OttlibColors.Accent)
                        }
                    }
                }
            }
        },
    )
}

private fun dialogFor(action: ProfileAction, profile: ProfileSummary): ManageDialog = when (action) {
    ProfileAction.Edit -> ManageDialog.Form(profile)
    ProfileAction.Pin -> ManageDialog.Pin(profile)
    ProfileAction.Delete -> ManageDialog.Delete(profile)
}

@Composable
private fun ManageDialogs(dialog: ManageDialog?, state: ProfileManageUiState, viewModel: ProfileManageViewModel, close: () -> Unit) {
    when (dialog) {
        is ManageDialog.Form -> ProfileFormDialog(
            target = dialog.target,
            initialColor = remember(dialog) { viewModel.nextColor() },
            busy = state.busy,
            error = state.error,
            onSave = { name, color ->
                val target = dialog.target
                if (target == null) {
                    viewModel.create(name, color)
                } else {
                    viewModel.edit(target, name.trim().takeIf { it != target.name }, color.takeIf { !it.equals(target.color, ignoreCase = true) })
                    if (name.trim() == target.name && color.equals(target.color, ignoreCase = true)) close()
                }
            },
            onDismiss = close,
        )
        is ManageDialog.Pin -> {
            // The latest listing, so hasPin is current after a change.
            val target = state.profiles.firstOrNull { it.id == dialog.target.id } ?: dialog.target
            ProfilePinDialog(
                target = target,
                fields = pinDialogFields(target, viewModel.rightsFor(target)),
                busy = state.busy,
                error = state.error,
                onSave = { pin, current -> viewModel.setPin(target, pin, current) },
                onClear = { current -> viewModel.clearPin(target, current) },
                onDismiss = close,
            )
        }
        is ManageDialog.Delete -> ProfileDeleteDialog(dialog.target, state.busy, state.error, onConfirm = { viewModel.delete(dialog.target) }, onDismiss = close)
        null -> Unit
    }
}
