package dev.ottlib.core.model

import kotlinx.serialization.Serializable

/** Mirrors `movieSchema` in packages/shared/src/index.ts. */
@Serializable
data class Movie(
    val id: Long,
    val title: String,
    val year: Int?,
    val rawFilename: String,
    val filePath: String,
    val titleOverride: String?,
    val overview: String?,
    val posterUrl: String?,
    val backdropUrl: String?,
    val genres: List<String>,
    val cast: List<String>,
    val rating: Double?,
    val runtime: Int?,
    val imdbId: String?,
    val metadataStatus: String,
    val metadataSource: String?,
    val mediaType: String?,
    val season: Int?,
    val episode: Int?,
    val fileSizeBytes: Long,
    val mediaInfo: MediaInfo?,
    val watched: Boolean,
    val resumePositionMs: Long?,
    val missing: Boolean,
    val addedAt: String,
    val shelves: List<ShelfMembership>,
)

@Serializable
data class MediaInfo(
    val container: String?,
    val durationMs: Long?,
    val width: Int?,
    val height: Int?,
    val videoCodec: String?,
    val videoProfile: String?,
    val videoBitRate: Long?,
    val hdrFormat: String?,
    val tracks: List<MediaTrack>,
)

@Serializable
data class MediaTrack(
    val type: String,
    val source: String,
    val order: Int,
    val language: String?,
    val title: String?,
    val codec: String?,
    val channels: Int?,
    val channelLayout: String?,
    val isDefault: Boolean,
    val isForced: Boolean,
    val isHearingImpaired: Boolean,
) {
    val isAudio: Boolean get() = type == "audio"
    val isSubtitle: Boolean get() = type == "subtitle"
}

@Serializable
data class ShelfMembership(val id: Long, val name: String)
