package dev.ottlib.core.model

import kotlinx.serialization.Serializable

/** Mirrors `playbackSourceSchema` in packages/shared/src/playback.ts. URLs are server-relative. */
@Serializable
data class PlaybackSource(
    val kind: String,
    val streamUrl: String,
    val mimeType: String,
    val durationMs: Long?,
    val resumePositionMs: Long?,
    val subtitles: List<SubtitleSource>,
)

@Serializable
data class SubtitleSource(
    val url: String,
    val language: String?,
    val codec: String?,
    val title: String?,
    val isForced: Boolean,
    val isHearingImpaired: Boolean,
)

@Serializable
data class PlaybackProgressUpdate(val positionMs: Long, val durationMs: Long, val shelfId: Long? = null)

@Serializable
data class PlaybackProgressResult(val resumePositionMs: Long?, val watched: Boolean)

@Serializable
data class WatchStateUpdate(val watched: Boolean)
