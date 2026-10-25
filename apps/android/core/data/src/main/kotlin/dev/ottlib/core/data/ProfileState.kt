package dev.ottlib.core.data

import dev.ottlib.core.model.ProfileSummary

/** Which profile the active server is used as. */
sealed interface ProfileState {
    /** Before [ProfileSession.resolve] has run for the active server. */
    data object Unknown : ProfileState

    /** The server has no profiles (`GET /api/profiles` is 404): everything works as before profiles. */
    data object Unsupported : ProfileState

    /** The server's only profile, PIN-less, selected without asking. */
    data class Single(val profile: ProfileSummary) : ProfileState

    data class Selected(val profile: ProfileSummary, val profiles: List<ProfileSummary>) : ProfileState

    /**
     * The picker should show. [canCancel] is true when this came from [ProfileSession.switch]: Back returns to the
     * profile still in use through [ProfileSession.cancelSwitch].
     */
    data class NeedsPick(val profiles: List<ProfileSummary>, val canCancel: Boolean = false) : ProfileState
}

/** The profile in use, if any. */
val ProfileState.current: ProfileSummary?
    get() = when (this) {
        is ProfileState.Single -> profile
        is ProfileState.Selected -> profile
        else -> null
    }

/** The server's profiles as last listed (empty when unknown or unsupported). */
val ProfileState.profiles: List<ProfileSummary>
    get() = when (this) {
        is ProfileState.Single -> listOf(profile)
        is ProfileState.Selected -> profiles
        is ProfileState.NeedsPick -> profiles
        else -> emptyList()
    }

/**
 * Whether to show the profile chip / Switch profile: only when switching leads somewhere, i.e. another profile
 * exists or this one is behind a PIN (mirrors the web `canSwitchProfile`).
 */
val ProfileState.canSwitchProfile: Boolean
    get() = current?.let { profiles.size > 1 || it.hasPin } ?: false
