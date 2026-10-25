package dev.ottlib.core.presentation.profiles

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.ottlib.core.data.ProfileSession
import dev.ottlib.core.data.ProfileState
import dev.ottlib.core.data.current
import dev.ottlib.core.data.profiles
import dev.ottlib.core.model.ProfileCreateRequest
import dev.ottlib.core.model.ProfilePatch
import dev.ottlib.core.model.ProfilePinUpdate
import dev.ottlib.core.model.ProfileSummary
import dev.ottlib.core.network.OttlibApi
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ProfileManageUiState(
    /** The profile in use; its rights decide what each row offers. */
    val me: ProfileSummary? = null,
    val profiles: List<ProfileSummary> = emptyList(),
    val canAdd: Boolean = false,
    val busy: Boolean = false,
    /** The server's message as is ("Wrong PIN. Try again." for a wrong current PIN). */
    val error: String? = null,
    /** Goes up after each change the server accepted, so an open form can close. */
    val saved: Int = 0,
)

/** Adds, edits, re-PINs and deletes profiles through the server, then re-lists them in [ProfileSession]. */
class ProfileManageViewModel(private val api: OttlibApi, private val session: ProfileSession) : ViewModel() {
    private val state = MutableStateFlow(fromSession(ProfileManageUiState(), session.state.value))
    val uiState: StateFlow<ProfileManageUiState> = state.asStateFlow()

    init {
        viewModelScope.launch { session.state.collect { profile -> state.update { fromSession(it, profile) } } }
        viewModelScope.launch {
            try { session.refreshProfiles() } catch (error: CancellationException) { throw error } catch (error: Exception) {
                state.update { it.copy(error = errorMessage(error)) }
            }
        }
    }

    fun rightsFor(target: ProfileSummary): ProfileRights = profileRights(state.value.me, target)

    /** The colour a new profile starts with: the first one nobody uses. */
    fun nextColor(): String = nextProfileColor(state.value.profiles)

    fun clearError() {
        state.update { it.copy(error = null) }
    }

    fun create(name: String, color: String = nextColor(), pin: String? = null) {
        val ui = state.value
        if (!canAddProfile(ui.me, ui.profiles.size)) return refuse(OWNER_ONLY)
        val trimmed = name.trim().ifEmpty { return refuse(NAME_NEEDED) }
        val newPin = pin?.ifBlank { null }
        if (newPin != null && !isCompletePin(newPin)) return refuse(PIN_FORMAT)
        run(pinCall = false) { api.createProfile(ProfileCreateRequest(trimmed, color, newPin)) }
    }

    /** Renames and/or recolours [target]; only the fields given are sent. */
    fun edit(target: ProfileSummary, name: String? = null, color: String? = null) {
        if (!rightsFor(target).canEdit) return refuse(OWNER_ONLY)
        val trimmed = name?.trim()
        if (trimmed != null && trimmed.isEmpty()) return refuse(NAME_NEEDED)
        if (trimmed == null && color == null) return
        run(pinCall = false) { api.updateProfile(target.id, ProfilePatch(trimmed, color)) }
    }

    /** Sets or changes [target]'s PIN; [currentPin] is required when [ProfileRights.needsCurrentPin]. */
    fun setPin(target: ProfileSummary, pin: String, currentPin: String? = null) {
        val rights = rightsFor(target)
        if (!rights.canEdit) return refuse(OWNER_ONLY)
        if (!isCompletePin(pin)) return refuse(PIN_FORMAT)
        if (rights.needsCurrentPin && currentPin.isNullOrBlank()) return refuse(CURRENT_PIN_NEEDED)
        run(pinCall = true) { api.setProfilePin(target.id, ProfilePinUpdate(currentPin.takeIf { rights.needsCurrentPin }, pin)) }
    }

    /** Removes [target]'s PIN: the owner for another profile directly, a profile for itself with [currentPin]. */
    fun clearPin(target: ProfileSummary, currentPin: String? = null) {
        val rights = rightsFor(target)
        if (!rights.canClearPin) return refuse(OWNER_ONLY)
        if (rights.needsCurrentPin && currentPin.isNullOrBlank()) return refuse(CURRENT_PIN_NEEDED)
        run(pinCall = true) { api.setProfilePin(target.id, ProfilePinUpdate(currentPin.takeIf { rights.needsCurrentPin }, null)) }
    }

    fun delete(target: ProfileSummary) {
        if (!rightsFor(target).canDelete) return refuse(OWNER_ONLY)
        run(pinCall = false) { api.deleteProfile(target.id) }
    }

    private fun refuse(message: String) {
        state.update { it.copy(error = message) }
    }

    private fun run(pinCall: Boolean, call: suspend () -> Unit) {
        if (state.value.busy) return
        state.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                call()
            } catch (error: CancellationException) { throw error } catch (error: Exception) {
                state.update { it.copy(busy = false, error = if (pinCall) pinErrorMessage(error) else errorMessage(error)) }
                return@launch
            }
            // The change is made; a failed re-list only leaves the list stale.
            val refreshError = try { session.refreshProfiles(); null } catch (error: CancellationException) { throw error } catch (error: Exception) { errorMessage(error) }
            state.update { it.copy(busy = false, error = refreshError, saved = it.saved + 1) }
        }
    }

    private fun fromSession(ui: ProfileManageUiState, profile: ProfileState): ProfileManageUiState {
        val me = profile.current
        val profiles = profile.profiles
        return ui.copy(me = me, profiles = profiles, canAdd = canAddProfile(me, profiles.size))
    }

    private companion object {
        // The server's own wording for the owner rule (profileService.ts).
        const val OWNER_ONLY = "Only the owner profile can do that."
        const val NAME_NEEDED = "Enter a name."
        const val PIN_FORMAT = "A PIN is 4 to 8 digits."
        const val CURRENT_PIN_NEEDED = "Enter the current PIN."
    }
}
