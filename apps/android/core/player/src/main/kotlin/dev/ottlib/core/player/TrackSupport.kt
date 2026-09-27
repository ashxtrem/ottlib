package dev.ottlib.core.player

import androidx.media3.common.C
import androidx.media3.common.Tracks

/** True when the file has audio but no audio track this device (or the FFmpeg fallback) can decode. */
fun Tracks.hasOnlyUnsupportedAudio(): Boolean {
    val audio = groups.filter { it.type == C.TRACK_TYPE_AUDIO }
    return audio.isNotEmpty() && audio.none { it.isSupported }
}

/** True when the file has video but none of it can be decoded. */
fun Tracks.hasOnlyUnsupportedVideo(): Boolean {
    val video = groups.filter { it.type == C.TRACK_TYPE_VIDEO }
    return video.isNotEmpty() && video.none { it.isSupported }
}
