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
    // Only present when the request listed capabilities (`kind` is then possibly "hls"); the apps send them only for "Play via server".
    val mode: String? = null,
    val reasons: List<String> = emptyList(),
    val sessionUrl: String? = null,
    val audioTracks: List<AudioTrackSource> = emptyList(),
    val audioOrder: Int? = null,
    val burnInSubtitles: List<BurnInSubtitle> = emptyList(),
    val burnSubtitleOrder: Int? = null,
    // Null when not detected yet, the frame size is unknown, or burned-in subtitles sit in the bars.
    val pictureArea: PictureArea? = null,
)

/** Mirrors `pictureAreaSchema`: the real picture inside the frame as fractions (0..1) of frame width and height. */
@Serializable
data class PictureArea(
    val x: Float,
    val y: Float,
    val width: Float,
    val height: Float,
)

/**
 * Mirrors `playbackRequestSchema`: what this device can play, sent as the query of GET /api/movies/:id/playback.
 * Codec names are the server's vocabulary (`h264`, `hevc`, `aac`, ...); empty lists are left out of the query.
 */
data class PlaybackRequest(
    val containers: List<String> = emptyList(),
    val video: List<String> = emptyList(),
    val audio: List<String> = emptyList(),
    val hdr: Boolean? = null,
    val maxHeight: Int? = null,
    val audioOrder: Int? = null,
    val burnSubtitleOrder: Int? = null,
    val startMs: Long? = null,
)

/** Mirrors `audioTrackSourceSchema`; `order` is the ffprobe stream index. */
@Serializable
data class AudioTrackSource(
    val order: Int,
    val language: String?,
    val title: String?,
    val codec: String?,
    val channels: Int?,
    val isDefault: Boolean,
)

/** Mirrors `burnInSubtitleSchema`: a picture subtitle that can only be shown by burning it into the video. */
@Serializable
data class BurnInSubtitle(
    val order: Int,
    val language: String?,
    val title: String?,
    val codec: String?,
    val isForced: Boolean,
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
