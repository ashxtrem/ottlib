package dev.ottlib.core.model

import kotlinx.serialization.Serializable

/** Mirrors `shelfSummarySchema` in packages/shared/src/index.ts. */
@Serializable
data class ShelfSummary(
    val id: Long,
    val name: String,
    val movieCount: Int,
    val coverMovies: List<ShelfCoverMovie>,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class ShelfCoverMovie(val id: Long, val title: String, val posterUrl: String?)

/** Mirrors `shelfDetailSchema` (a shelf summary plus its full movies). */
@Serializable
data class ShelfDetail(
    val id: Long,
    val name: String,
    val movieCount: Int,
    val coverMovies: List<ShelfCoverMovie>,
    val createdAt: String,
    val updatedAt: String,
    val movies: List<Movie>,
)
