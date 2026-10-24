package dev.ottlib.core.network

import dev.ottlib.core.model.PlaybackRequest
import okhttp3.HttpUrl

/** Adds [request] as the playback query (names per `playbackRequestSchema`; lists comma separated, empty ones left out). */
internal fun PlaybackRequest.applyTo(builder: HttpUrl.Builder): HttpUrl.Builder = builder.apply {
    fun list(name: String, values: List<String>) { if (values.isNotEmpty()) addQueryParameter(name, values.joinToString(",")) }
    fun value(name: String, value: Any?) { if (value != null) addQueryParameter(name, value.toString()) }
    list("containers", containers)
    list("video", video)
    list("audio", audio)
    value("hdr", hdr)
    value("maxHeight", maxHeight)
    value("audioOrder", audioOrder)
    value("burnSubtitleOrder", burnSubtitleOrder)
    value("startMs", startMs)
}
