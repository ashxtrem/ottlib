package dev.ottlib.core.model

import kotlinx.serialization.Serializable

/** Mirrors `creditsSchema` in packages/shared/src/credits.ts: where the end credits start, and how that is known. */
@Serializable
data class Credits(
    val startMs: Long,
    /** `mark` (a user's "credits start here"), `chapter` (a chapter named for the credits) or `series` (learned from a sibling episode). */
    val source: String,
)

/** Mirrors `autoSkipDefaultsSchema`: GET/PUT /api/profiles/current/auto-skip, the profile's auto-skip default per media type. */
@Serializable
data class AutoSkipDefaults(
    val movie: Boolean,
    val tv: Boolean,
)
