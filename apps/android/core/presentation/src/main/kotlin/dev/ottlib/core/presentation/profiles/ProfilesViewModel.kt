package dev.ottlib.core.presentation.profiles

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.ottlib.core.data.ProfileSession
import dev.ottlib.core.data.ProfileState
import dev.ottlib.core.data.profiles
import dev.ottlib.core.model.ProfileSummary
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ProfilesUiState(
    val profiles: List<ProfileSummary> = emptyList(),
    /** The session isn't resolved yet ([ProfileState.Unknown]): show a spinner, not an empty list or an error. */
    val loading: Boolean = true,
    /** The profile whose PIN is being asked for; null shows the list. */
    val pinFor: ProfileSummary? = null,
    val busy: Boolean = false,
    /** "Wrong PIN. Try again.", the server's lockout text, or another server message. */
    val error: String? = null,
    /** Back may leave the picker and keep the profile in use ([ProfilesViewModel.cancel]). */
    val canCancel: Boolean = false,
    /** Set once a profile was picked; the host leaves the picker. */
    val done: Boolean = false,
)

/** The profile picker: the server's profiles, a PIN step for locked ones, then [ProfileSession.select]. */
class ProfilesViewModel(private val session: ProfileSession) : ViewModel() {
    private val state = MutableStateFlow(fromSession(ProfilesUiState(), session.state.value))
    val uiState: StateFlow<ProfilesUiState> = state.asStateFlow()

    init {
        viewModelScope.launch { session.state.collect { profile -> state.update { fromSession(it, profile) } } }
        // The list may be one kept from before a 409, so ask again.
        viewModelScope.launch {
            try { session.refreshProfiles() } catch (error: CancellationException) { throw error } catch (error: Exception) {
                // Before resolve, resolve itself reports the failure; this one would only flash an error.
                if (session.state.value !is ProfileState.Unknown) state.update { it.copy(error = errorMessage(error)) }
            }
        }
    }

    /** A tap on a profile: PIN-less ones are picked at once, locked ones open the PIN step. */
    fun choose(profile: ProfileSummary) {
        if (state.value.busy) return
        if (profile.hasPin) state.update { it.copy(pinFor = profile, error = null) } else pick(profile.id, null)
    }

    fun submitPin(pin: String) {
        val target = state.value.pinFor ?: return
        if (state.value.busy || pin.isBlank()) return
        pick(target.id, pin.trim())
    }

    /** From the PIN step back to the list. */
    fun closePin() {
        state.update { it.copy(pinFor = null, error = null) }
    }

    /** Back on the list: returns to the profile still in use when [ProfilesUiState.canCancel]; false when it can't. */
    fun cancel(): Boolean {
        if (!state.value.canCancel) return false
        session.cancelSwitch()
        return true
    }

    private fun pick(id: Int, pin: String?) {
        state.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                session.select(id, pin)
                state.update { it.copy(busy = false, pinFor = null, done = true) }
            } catch (error: CancellationException) { throw error } catch (error: Exception) {
                state.update { it.copy(busy = false, error = pinErrorMessage(error)) }
            }
        }
    }

    private fun fromSession(ui: ProfilesUiState, profile: ProfileState): ProfilesUiState {
        val pinFor = ui.pinFor?.let { open -> profile.profiles.firstOrNull { it.id == open.id } ?: open }
        return ui.copy(
            profiles = profile.profiles,
            loading = profile is ProfileState.Unknown,
            pinFor = pinFor,
            canCancel = if (profile is ProfileState.NeedsPick) profile.canCancel else ui.canCancel,
        )
    }
}
