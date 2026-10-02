package dev.ottlib.core.model

import kotlinx.serialization.Serializable

/** Mirrors `movieListItemSchema` in packages/shared/src/index.ts. */
@Serializable
data class MovieListItem(
    val id: Long,
    val title: String,
    val year: Int?,
    val posterUrl: String?,
    val resolution: String?,
    val hdrFormat: String?,
    val watched: Boolean,
    val resumePositionMs: Long?,
    val durationMs: Long?,
    val missing: Boolean,
    val metadataStatus: String,
    val shelves: List<ShelfMembership>,
    val nextUp: String? = null,
)

@Serializable
data class MovieListPage(
    val items: List<MovieListItem>,
    val nextCursor: String?,
    val total: Int,
)

@Serializable
data class MovieFilterOptions(
    val genres: List<String>,
    val actors: List<String>,
    val resolutions: List<String>,
    val audioLanguages: List<String>,
)
