package dev.ottlib.core.player

import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.MimeTypes
import dev.ottlib.core.model.PlaybackSource
import dev.ottlib.core.model.SubtitleSource
import java.util.Locale

/**
 * Converts the server's playback description into a Media3 item. [resolve] turns server-relative URLs
 * into absolute ones. The container is sniffed from the stream, so no MIME type is forced.
 */
fun PlaybackSource.toMediaItem(movieId: Long, title: String, resolve: (String) -> String): MediaItem =
    MediaItem.Builder()
        .setMediaId(movieId.toString())
        .setUri(resolve(streamUrl))
        .setMediaMetadata(MediaMetadata.Builder().setTitle(title).build())
        .setSubtitleConfigurations(subtitles.mapNotNull { it.toConfiguration(resolve) })
        .build()

internal fun SubtitleSource.toConfiguration(resolve: (String) -> String): MediaItem.SubtitleConfiguration? {
    val mimeType = subtitleMimeType(codec) ?: return null
    return MediaItem.SubtitleConfiguration.Builder(Uri.parse(resolve(url)))
        .setId(url.substringBefore('?'))
        .setMimeType(mimeType)
        .setLanguage(language)
        .setLabel("${title ?: language?.let(::languageName) ?: "Subtitles"} $EXTERNAL_SUBTITLE_SUFFIX")
        .setSelectionFlags(if (isForced) C.SELECTION_FLAG_FORCED else 0)
        .build()
}

/** Marks side-loaded subtitle files in track labels; also how [TrackMemory] tells them from embedded tracks. */
internal const val EXTERNAL_SUBTITLE_SUFFIX = "(external file)"

internal fun subtitleMimeType(codec: String?): String? = when (codec?.uppercase()) {
    "SRT" -> MimeTypes.APPLICATION_SUBRIP
    "ASS", "SSA" -> MimeTypes.TEXT_SSA
    "WEBVTT", "VTT" -> MimeTypes.TEXT_VTT
    else -> null
}

/** `eng` → `English`; unknown codes are returned upper-cased. */
fun languageName(code: String): String {
    val name = Locale.forLanguageTag(code).getDisplayLanguage(Locale.getDefault())
    return if (name.isBlank() || name.equals(code, ignoreCase = true)) code.uppercase() else name
}
