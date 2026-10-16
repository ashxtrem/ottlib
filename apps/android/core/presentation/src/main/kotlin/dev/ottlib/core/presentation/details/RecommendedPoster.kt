package dev.ottlib.core.presentation.details

import dev.ottlib.core.model.Recommendation
import dev.ottlib.core.presentation.PosterItem
import dev.ottlib.core.presentation.toPosterItem

/** A recommended title as a poster, with the reason it was suggested. */
data class RecommendedPoster(val poster: PosterItem, val reason: String)

fun Recommendation.toRecommendedPoster(resolve: (String?) -> String?) = RecommendedPoster(movie.toPosterItem(resolve), reason)
