package dev.ottlib.core.model

import kotlinx.serialization.Serializable

/** Mirrors `movieCollectionSchema` in packages/shared/src/collections.ts: the titles of a saga the library owns, and the parts it lacks. */
@Serializable
data class MovieCollection(
    val id: Long,
    val name: String,
    /** Owned titles in year order. */
    val owned: List<MovieListItem>,
    val missing: List<MissingCollectionPart>,
)

/** A part of a collection the library does not have; [posterUrl] is server-relative (resolve it with `OttlibApi.resolve`). */
@Serializable
data class MissingCollectionPart(
    val tmdbId: String,
    val title: String,
    val year: Int?,
    val posterUrl: String?,
)
