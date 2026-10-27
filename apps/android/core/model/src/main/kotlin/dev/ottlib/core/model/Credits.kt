package dev.ottlib.core.model

import kotlinx.serialization.Serializable

/** Mirrors `creditsSchema` in packages/shared/src/credits.ts: where the end credits start, and how that is known. */
@Serializable
data class Credits(
    val startMs: Long,
    /** `mark` (a user's "credits start here"), `chapter` (a chapter named for the credits) or `series` (learned from a sibling episode). */
    val source: String,
)

/** Body of PUT /api/movies/:id/credits: the "credits start here" mark, or null to clear it (always sent, null included). */
@Serializable
data class CreditsMarkRequest(val startMs: Long?)

/** Answer of PUT /api/movies/:id/credits: the credits the title resolves to after the change. */
@Serializable
data class CreditsMarkResult(val credits: Credits? = null)

/** Body of PUT /api/movies/:id/auto-skip: this profile's override for the movie (an episode: its series); null clears it. */
@Serializable
data class AutoSkipOverrideRequest(val enabled: Boolean?)

/** Answer of PUT /api/movies/:id/auto-skip: whether credits are now skipped for the title, override or default. */
@Serializable
data class AutoSkipOverrideResult(val autoSkipCredits: Boolean)

/** Mirrors `autoSkipDefaultsSchema`: GET/PUT /api/profiles/current/auto-skip, the profile's auto-skip default per media type. */
@Serializable
data class AutoSkipDefaults(
    val movie: Boolean,
    val tv: Boolean,
)
