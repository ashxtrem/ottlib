package dev.ottlib.core.presentation

import dev.ottlib.core.model.Movie
import dev.ottlib.core.model.MovieListItem

/** What a poster card needs, from either a list summary or a full movie. URLs are absolute. */
data class PosterItem(
    val id: Long,
    val title: String,
    val year: Int?,
    val posterUrl: String?,
    val badge: String?,
    val watched: Boolean,
    val resumePositionMs: Long?,
    val durationMs: Long?,
) {
    val progress: Float? get() = resumePositionMs?.let { position -> durationMs?.takeIf { it > 0 }?.let { (position.toFloat() / it).coerceIn(0f, 1f) } }
}

private fun badge(resolution: String?, hdr: String?): String? = listOfNotNull(resolution?.takeIf { it == "4K" }, hdr?.let { if (it.startsWith("Dolby")) "DV" else "HDR" }).joinToString(" ").ifEmpty { null }

fun MovieListItem.toPosterItem(resolve: (String?) -> String?) =
    PosterItem(id, title, year, resolve(posterUrl), badge(resolution, hdrFormat), watched, resumePositionMs, durationMs)

fun Movie.toPosterItem(resolve: (String?) -> String?) =
    PosterItem(id, title, year, resolve(posterUrl), badge(resolutionLabel(mediaInfo?.height), mediaInfo?.hdrFormat), watched, resumePositionMs, mediaInfo?.durationMs)
