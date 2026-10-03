package dev.ottlib.core.model

import kotlinx.serialization.Serializable

/** Mirrors matchCandidateSchema and manualMatchCandidateSchema in packages/shared. */
@Serializable
data class MetadataCandidate(
    val provider: String,
    val providerId: String,
    val title: String,
    val year: Int?,
    val score: Double,
    val mediaType: String,
    val season: Int? = null,
    val episode: Int? = null,
    val id: Long? = null,
)

@Serializable
data class MetadataRefreshRequest(val movieIds: List<Long>)

@Serializable
data class MetadataSearchRequest(val title: String)

@Serializable
data class ImdbLookupRequest(val imdbId: String)

/** Only provider identity is sent when accepting a manual search result. */
@Serializable
data class MetadataSelection(
    val provider: String,
    val providerId: String,
    val mediaType: String,
    val season: Int? = null,
    val episode: Int? = null,
)

@Serializable
data class AcceptMetadataRequest(
    val candidate: MetadataSelection,
    val season: Int? = null,
    val episode: Int? = null,
)

@Serializable
data class EpisodeSelection(val season: Int? = null, val episode: Int? = null)
