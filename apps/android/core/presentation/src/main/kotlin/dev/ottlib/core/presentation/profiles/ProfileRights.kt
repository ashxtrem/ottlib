package dev.ottlib.core.presentation.profiles

import dev.ottlib.core.model.MAX_PROFILES
import dev.ottlib.core.model.ProfileSummary

/**
 * What one profile may do to another; mirrors packages/client/src/utils/profileRights.ts, which mirrors the server's
 * owner rules (profileService.ts), so screens only offer what the server accepts.
 */
data class ProfileRights(
    /** Rename, recolor and set or change the PIN. */
    val canEdit: Boolean,
    /** Owner only, and never the owner profile itself. */
    val canDelete: Boolean,
    /**
     * A profile changing or removing its own existing PIN must type it first (the server answers 403 otherwise,
     * owner included: the owner can't clear its own PIN without it).
     */
    val needsCurrentPin: Boolean,
    /** The owner clears another profile's PIN without knowing it (how a forgotten PIN is reset). */
    val canClearPinDirectly: Boolean,
) {
    /** A PIN can be removed: another profile's by the owner directly, your own with its current PIN. */
    val canClearPin: Boolean get() = canClearPinDirectly || needsCurrentPin

    companion object {
        val None = ProfileRights(canEdit = false, canDelete = false, needsCurrentPin = false, canClearPinDirectly = false)
    }
}

/** What [me] (the profile in use) may do to [target]. */
fun profileRights(me: ProfileSummary?, target: ProfileSummary): ProfileRights {
    if (me == null) return ProfileRights.None
    val self = me.id == target.id
    return ProfileRights(
        canEdit = self || me.isOwner,
        canDelete = me.isOwner && !target.isOwner,
        needsCurrentPin = self && target.hasPin,
        canClearPinDirectly = me.isOwner && !self && target.hasPin,
    )
}

/** Only the owner adds profiles, up to [MAX_PROFILES]. */
fun canAddProfile(me: ProfileSummary?, count: Int): Boolean = me?.isOwner == true && count < MAX_PROFILES

/** The avatar letter for a profile name. */
fun profileInitial(name: String): String = name.trim().firstOrNull()?.uppercase() ?: "?"
