package dev.ottlib.core.model

import kotlinx.serialization.Serializable

/**
 * Enough about an audio or subtitle track to find it again next time, even if the file was rescanned or re-encoded
 * (so not its position in the list). Language codes are as Media3 normalises them (`en`, `hi`).
 */
@Serializable
data class TrackIdentity(
    val language: String? = null,
    val label: String? = null,
    val codec: String? = null,
    val channels: Int? = null,
    val external: Boolean = false,
)

/** The viewer's track choice for one title. [subtitlesOff] means they explicitly turned subtitles off. */
@Serializable
data class TrackChoice(
    val audio: TrackIdentity? = null,
    val subtitle: TrackIdentity? = null,
    val subtitlesOff: Boolean = false,
)
