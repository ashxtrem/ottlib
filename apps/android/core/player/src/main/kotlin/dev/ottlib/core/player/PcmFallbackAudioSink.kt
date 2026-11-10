@file:OptIn(UnstableApi::class)

package dev.ottlib.core.player

import androidx.annotation.OptIn
import androidx.media3.common.Format
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.ForwardingAudioSink
import java.nio.ByteBuffer

/**
 * Remembers, for the life of the app, that this device can't open a passthrough (undecoded DTS, TrueHD, AC-3...) audio
 * output even though it says it can — e.g. a projector that reports DTS passthrough but plays through its own speaker.
 */
class PassthroughState {
    @Volatile var broken: Boolean = false
        internal set
}

/**
 * Passes everything to [sink], except that once opening a passthrough output has failed it reports encoded formats as
 * unsupported. The renderers then decode instead (platform decoder, else FFmpeg) and hand this sink plain PCM, so a
 * re-prepare of the player plays the same file with sound.
 */
class PcmFallbackAudioSink(sink: AudioSink, private val state: PassthroughState) : ForwardingAudioSink(sink) {
    override fun supportsFormat(format: Format): Boolean = !refuses(format) && super.supportsFormat(format)

    override fun getFormatSupport(format: Format): Int =
        if (refuses(format)) AudioSink.SINK_FORMAT_UNSUPPORTED else super.getFormatSupport(format)

    override fun handleBuffer(buffer: ByteBuffer, presentationTimeUs: Long, encodedAccessUnitCount: Int): Boolean = try {
        super.handleBuffer(buffer, presentationTimeUs, encodedAccessUnitCount)
    } catch (error: AudioSink.InitializationException) {
        if (isEncoded(error.format)) state.broken = true
        throw error
    }

    private fun refuses(format: Format) = state.broken && isEncoded(format)
}

/** True when this error (or one it wraps) is a passthrough output that failed to open. */
fun Throwable.isPassthroughInitFailure(): Boolean =
    generateSequence(this) { it.cause }.any { it is AudioSink.InitializationException && isEncoded(it.format) }

/** True for compressed audio handed to the output as is; false for decoded PCM. */
internal fun isEncoded(format: Format): Boolean = format.sampleMimeType != null && format.sampleMimeType != MimeTypes.AUDIO_RAW
