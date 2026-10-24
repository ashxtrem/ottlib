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
    // Only present when the request listed capabilities (`kind` is then possibly "hls"); the apps never send them.
    val mode: String? = null,
    val reasons: List<String> = emptyList(),
    val sessionUrl: String? = null,
    val audioTracks: List<AudioTrackSource> = emptyList(),
    val audioOrder: Int? = null,
    val burnInSubtitles: List<BurnInSubtitle> = emptyList(),
    val burnSubtitleOrder: Int? = null,
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
