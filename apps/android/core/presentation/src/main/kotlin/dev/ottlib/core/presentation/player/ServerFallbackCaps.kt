package dev.ottlib.core.presentation.player

import dev.ottlib.core.model.PlaybackRequest
import dev.ottlib.core.model.PlaybackSource

/**
 * What "Play via server" asks the server for after [problem], starting at [startMs]; null when it isn't offered.
 * No container is listed, so the answer is never the same direct file again.
 * - Unsupported audio: the video already decodes here (every codec the server names, HDR as it is) with AAC audio,
 *   so the server only repackages the video (a cheap remux).
 * - Unsupported video or a playback error: H.264 up to 1080p with AAC, which every Android device decodes (a transcode).
 */
fun serverFallbackRequest(problem: PlaybackProblem, startMs: Long): PlaybackRequest? = when (problem) {
    is PlaybackProblem.UnsupportedAudio -> PlaybackRequest(video = REMUX_VIDEO, audio = SAFE_AUDIO, hdr = true, startMs = startMs)
    is PlaybackProblem.UnsupportedVideo, is PlaybackProblem.Error ->
        PlaybackRequest(video = SAFE_VIDEO, audio = SAFE_AUDIO, hdr = false, maxHeight = TRANSCODE_MAX_HEIGHT, startMs = startMs)
    is PlaybackProblem.ServerUnavailable -> null
}

/** Whether the problem dialog offers "Play via server". */
val PlaybackProblem.offersServerFallback: Boolean get() = serverFallbackRequest(this, 0) != null

/** The problem whose choices the dialog shows: a refused fallback keeps the original problem's. */
val PlaybackProblem.choices: PlaybackProblem get() = if (this is PlaybackProblem.ServerUnavailable) original else this

/** Why the server's answer can't be used as a fallback (it can't convert the file), or null when it can. */
fun serverFallbackRefusal(source: PlaybackSource): String? = when {
    "ffmpeg-missing" in source.reasons -> "The server can't convert this file because ffmpeg isn't installed on it."
    source.kind != "hls" -> "The server offered no converted stream for this file."
    else -> null
}

private val REMUX_VIDEO = listOf("h264", "hevc", "av1", "vp9")
private val SAFE_VIDEO = listOf("h264")
private val SAFE_AUDIO = listOf("aac")
private const val TRANSCODE_MAX_HEIGHT = 1080
