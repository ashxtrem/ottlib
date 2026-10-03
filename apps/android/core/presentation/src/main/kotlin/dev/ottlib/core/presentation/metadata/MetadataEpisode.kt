package dev.ottlib.core.presentation.metadata

import dev.ottlib.core.model.Movie

private val episodePatterns = listOf(
    Regex("s(\\d{1,2})[\\s._-]?e(\\d{1,3})", RegexOption.IGNORE_CASE),
    Regex("\\b(\\d{1,2})x(\\d{2,3})\\b", RegexOption.IGNORE_CASE),
    Regex("season\\s?(\\d{1,2})\\s?episode\\s?(\\d{1,3})", RegexOption.IGNORE_CASE),
)

fun metadataEpisode(movie: Movie): Pair<String, String> {
    val detected = episodePatterns.firstNotNullOfOrNull { it.find(movie.rawFilename) }
    return (movie.season ?: detected?.groupValues?.get(1)?.toIntOrNull())?.toString().orEmpty() to
        (movie.episode ?: detected?.groupValues?.get(2)?.toIntOrNull())?.toString().orEmpty()
}

fun positiveEpisodeNumber(value: String): Int? = value.trim().toIntOrNull()?.takeIf { it > 0 }
