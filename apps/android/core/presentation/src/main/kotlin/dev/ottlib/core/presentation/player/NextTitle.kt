package dev.ottlib.core.presentation.player

import dev.ottlib.core.model.Movie

fun Movie.nextLabel(): String = if (mediaType == "tv") "Next episode" else "Up next"

fun Movie.episodeGapAfter(current: Movie): String? {
    if (mediaType != "tv" || current.mediaType != "tv") return null
    val currentSeason = current.season ?: return null
    val currentEpisode = current.episode ?: return null
    val nextSeason = season ?: return null
    val nextEpisode = episode ?: return null
    return if ((nextSeason == currentSeason && nextEpisode > currentEpisode + 1) ||
        (nextSeason > currentSeason && (nextSeason > currentSeason + 1 || nextEpisode > 1)))
        "Some episodes are unavailable. Next available: S${nextSeason}E${nextEpisode}." else null
}
