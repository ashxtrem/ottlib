package dev.ottlib.tv.ui.components

import dev.ottlib.core.model.MediaTrack
import dev.ottlib.core.model.Movie
import dev.ottlib.core.player.languageName

/** `1:02:03` or `42:10`. */
fun formatPosition(ms: Long): String {
    val totalSeconds = ms / 1_000
    val hours = totalSeconds / 3_600
    val minutes = (totalSeconds % 3_600) / 60
    val seconds = totalSeconds % 60
    return if (hours > 0) "%d:%02d:%02d".format(hours, minutes, seconds) else "%d:%02d".format(minutes, seconds)
}

/** Signed seek offset: `+10s`, `−45s`, `+1:20`, `+1:02:03`. */
fun formatOffset(ms: Long): String {
    val sign = if (ms < 0) "−" else "+"
    val abs = kotlin.math.abs(ms)
    return if (abs < 60_000) "$sign${abs / 1_000}s" else sign + formatPosition(abs)
}

/** `1h 56m` from TMDb runtime minutes, falling back to the probed duration. */
fun formatRuntime(runtimeMinutes: Int?, durationMs: Long?): String? {
    val minutes = runtimeMinutes?.takeIf { it > 0 } ?: durationMs?.takeIf { it > 0 }?.let { (it / 60_000).toInt().coerceAtLeast(1) } ?: return null
    return if (minutes >= 60) "${minutes / 60}h ${minutes % 60}m" else "${minutes}m"
}

fun formatRemaining(positionMs: Long, durationMs: Long?): String? {
    val remaining = (durationMs ?: return null) - positionMs
    return if (remaining > 60_000) "${formatRuntime(null, remaining)} left" else null
}

fun resolutionLabel(height: Int?): String? = when {
    height == null || height <= 0 -> null
    height >= 2_000 -> "4K"
    height >= 1_000 -> "1080p"
    height >= 700 -> "720p"
    else -> "${height}p"
}

fun Movie.metaLine(): String = listOfNotNull(
    year?.toString(),
    formatRuntime(runtime, mediaInfo?.durationMs),
    rating?.takeIf { it > 0 }?.let { "★ %.1f".format(it) },
    resolutionLabel(mediaInfo?.height),
    mediaInfo?.hdrFormat,
).joinToString("  ·  ")

fun MediaTrack.describe(): String = listOfNotNull(
    language?.let(::languageName) ?: "Unknown",
    codec,
    channelLayout ?: channels?.let { "${it}ch" },
    title,
    "forced".takeIf { isForced },
    "SDH".takeIf { isHearingImpaired && title == null },
    "external".takeIf { source == "external" },
).joinToString(" · ")
