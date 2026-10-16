package dev.ottlib.core.model

import kotlinx.serialization.Serializable

/** Mirrors `recommendationSchema` in packages/shared/src/index.ts: a title to watch next and why. */
@Serializable
data class Recommendation(
    val movie: MovieListItem,
    val reason: String,
)
