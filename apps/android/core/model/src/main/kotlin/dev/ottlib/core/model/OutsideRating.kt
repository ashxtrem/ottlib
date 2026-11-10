package dev.ottlib.core.model

import kotlinx.serialization.Serializable

/** Mirrors `outsideRatingSchema` in packages/shared/src/index.ts. [source] is "imdb", "rottenTomatoes" or "metacritic". */
@Serializable
data class OutsideRating(
    val source: String,
    val value: Double,
    val max: Double,
)
