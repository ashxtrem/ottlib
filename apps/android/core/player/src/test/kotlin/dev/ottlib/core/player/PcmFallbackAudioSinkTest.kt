@file:OptIn(UnstableApi::class)

package dev.ottlib.core.player

import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.audio.AudioSink
import java.lang.reflect.Proxy
import java.nio.ByteBuffer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class PcmFallbackAudioSinkTest {
    private val dts = Format.Builder().setSampleMimeType(MimeTypes.AUDIO_DTS).setChannelCount(6).setSampleRate(48_000).build()
    private val pcm = Format.Builder().setSampleMimeType(MimeTypes.AUDIO_RAW).setPcmEncoding(C.ENCODING_PCM_16BIT).setChannelCount(6).setSampleRate(48_000).build()

    /** An AudioSink that supports every format directly and, when [failWith] is set, fails to open its output. */
    private fun device(failWith: Format? = null): AudioSink = Proxy.newProxyInstance(javaClass.classLoader, arrayOf(AudioSink::class.java)) { _, method, _ ->
        when (method.name) {
            "supportsFormat" -> true
            "getFormatSupport" -> AudioSink.SINK_FORMAT_SUPPORTED_DIRECTLY
            "handleBuffer" -> failWith?.let { throw AudioSink.InitializationException(0, 48_000, 252, 0, C.ENCODING_DTS, it, false, null) } ?: true
            else -> null
        }
    } as AudioSink

    @Test fun `passes formats through until passthrough fails`() {
        val sink = PcmFallbackAudioSink(device(), PassthroughState())
        assertTrue(sink.supportsFormat(dts))
        assertEquals(AudioSink.SINK_FORMAT_SUPPORTED_DIRECTLY, sink.getFormatSupport(dts))
        assertTrue(sink.handleBuffer(ByteBuffer.allocate(4), 0, 1))
    }

    @Test fun `a failed passthrough output makes encoded formats unsupported but keeps PCM`() {
        val state = PassthroughState()
        val sink = PcmFallbackAudioSink(device(failWith = dts), state)
        try { sink.handleBuffer(ByteBuffer.allocate(4), 0, 1); fail("expected the init failure to be rethrown") }
        catch (error: AudioSink.InitializationException) { assertTrue(RuntimeException("renderer", error).isPassthroughInitFailure()) }
        assertTrue(state.broken)
        assertFalse(sink.supportsFormat(dts))
        assertEquals(AudioSink.SINK_FORMAT_UNSUPPORTED, sink.getFormatSupport(dts))
        assertTrue(sink.supportsFormat(pcm))
        // A new player's sink shares the state, so it decodes from the start.
        assertFalse(PcmFallbackAudioSink(device(), state).supportsFormat(dts))
    }

    @Test fun `a failed PCM output does not give up on passthrough`() {
        val state = PassthroughState()
        val sink = PcmFallbackAudioSink(device(failWith = pcm), state)
        try { sink.handleBuffer(ByteBuffer.allocate(4), 0, 1) } catch (error: AudioSink.InitializationException) { assertFalse(error.isPassthroughInitFailure()) }
        assertFalse(state.broken)
        assertTrue(sink.supportsFormat(dts))
    }
}
