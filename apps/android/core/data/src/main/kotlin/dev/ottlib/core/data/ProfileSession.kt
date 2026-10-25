package dev.ottlib.core.data

import dev.ottlib.core.model.ProfileMe
import dev.ottlib.core.model.ProfileSelectResult
import dev.ottlib.core.model.ProfileSummary
import dev.ottlib.core.network.ApiException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.runBlocking
import okhttp3.HttpUrl

/** The profile calls [ProfileSession] needs, against the active server, as functions so they can be faked. */
class ProfileAccess(
    val profiles: suspend () -> List<ProfileSummary>,
    val select: suspend (id: Int, pin: String?) -> ProfileSelectResult,
    /** Ends the session whose token the interceptor sends (the stored one). */
    val deselect: suspend () -> Unit,
    val me: suspend () -> ProfileMe,
)

/**
 * Which profile the active server is used as. [resolve] after connecting; [select] from the picker; [onRequired]
 * from the interceptor when the server answers `409 PROFILE_REQUIRED`. [onProfileChanged] runs when a different
 * profile (or server) than the last one becomes current, so system surfaces like Watch Next can be cleared.
 */
class ProfileSession(
    private val tokens: ProfileTokens,
    private val access: ProfileAccess,
    private val activeServer: () -> HttpUrl?,
    private val onProfileChanged: () -> Unit,
) {
    private val mutableState = MutableStateFlow<ProfileState>(ProfileState.Unknown)
    val state: StateFlow<ProfileState> = mutableState.asStateFlow()

    /** The state before [switch], restored by [cancelSwitch]. */
    @Volatile private var beforeSwitch: ProfileState? = null

    /** Works out the profile for the active server. Throws when the server can't be asked (other than 404). */
    suspend fun resolve(): ProfileState {
        beforeSwitch = null
        val server = activeServer() ?: return set(ProfileState.Unknown)
        val profiles = try { access.profiles() } catch (error: ApiException) {
            if (error.statusCode == 404) return set(ProfileState.Unsupported) else throw error
        }
        if (tokens.tokenBlocking(server) != null) {
            try {
                return current(server, access.me().profile, profiles)
            } catch (error: ApiException) {
                if (error.statusCode != 409) throw error
                tokens.clear(server)
            }
        }
        val sole = profiles.singleOrNull()
        if (sole != null && !sole.hasPin) return select(sole.id, null, profiles)
        return set(ProfileState.NeedsPick(profiles))
    }

    /**
     * Starts a session as profile [id]. A wrong PIN (403) or lockout (429) throws [ApiException] and leaves the
     * current session as it was; on success the previous session is ended, best effort.
     */
    suspend fun select(id: Int, pin: String?): ProfileState = select(id, pin, state.value.profiles)

    private suspend fun select(id: Int, pin: String?, profiles: List<ProfileSummary>): ProfileState {
        val server = activeServer() ?: return set(ProfileState.Unknown)
        val result = access.select(id, pin)
        // The interceptor still sends the old token here, so this ends the old session, not the new one.
        if (tokens.tokenBlocking(server) != null) runCatching { access.deselect() }
        tokens.save(server, result.token)
        beforeSwitch = null
        return current(server, result.profile, profiles)
    }

    /** Shows the picker but keeps the current session until a new pick, so [cancelSwitch] can go back. */
    fun switch() {
        val now = state.value
        if (now.current == null) return
        beforeSwitch = now
        mutableState.value = ProfileState.NeedsPick(now.profiles, canCancel = true)
    }

    fun cancelSwitch() {
        beforeSwitch?.let { mutableState.value = it }
        beforeSwitch = null
    }

    /** From the interceptor (an OkHttp thread): [server] no longer accepts its token. */
    fun onRequired(server: HttpUrl) {
        runBlocking { tokens.clear(server) }
        val active = activeServer() ?: return
        if (ProfileSessionStore.origin(active) != ProfileSessionStore.origin(server)) return
        beforeSwitch = null
        mutableState.value = ProfileState.NeedsPick(state.value.profiles)
    }

    /** Re-lists the profiles (after one was added, renamed or deleted); the current one leaving sends to the picker. */
    suspend fun refreshProfiles(): ProfileState {
        val server = activeServer() ?: return state.value
        val profiles = access.profiles()
        val inUse = (beforeSwitch ?: state.value).current
        if (inUse != null && profiles.none { it.id == inUse.id }) {
            tokens.clear(server)
            beforeSwitch = null
            return set(ProfileState.NeedsPick(profiles))
        }
        beforeSwitch = beforeSwitch?.let { refreshed(it, profiles) }
        return set(refreshed(state.value, profiles))
    }

    private fun refreshed(state: ProfileState, profiles: List<ProfileSummary>): ProfileState {
        val now = state.current ?: return if (state is ProfileState.NeedsPick) state.copy(profiles = profiles) else state
        return stateFor(profiles.first { it.id == now.id }, profiles)
    }

    /** Back to [ProfileState.Unknown], e.g. when the device forgets its server. */
    fun reset() {
        beforeSwitch = null
        mutableState.value = ProfileState.Unknown
    }

    private suspend fun current(server: HttpUrl, profile: ProfileSummary, profiles: List<ProfileSummary>): ProfileState {
        val listed = profiles.map { if (it.id == profile.id) profile else it }.ifEmpty { listOf(profile) }
        val key = "${ProfileSessionStore.origin(server)}#${profile.id}"
        val last = tokens.lastProfile()
        if (last != key) {
            tokens.saveLastProfile(key)
            if (last != null) onProfileChanged()
        }
        return set(stateFor(profile, listed))
    }

    private fun stateFor(profile: ProfileSummary, profiles: List<ProfileSummary>): ProfileState =
        if (profiles.size == 1 && !profile.hasPin) ProfileState.Single(profile) else ProfileState.Selected(profile, profiles)

    private fun set(next: ProfileState): ProfileState = next.also { mutableState.value = it }
}
