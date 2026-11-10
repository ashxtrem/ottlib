package dev.ottlib.core.presentation.player

import androidx.media3.common.PlaybackException
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RetryAsPcmTest {
    @Test fun `retries once after passthrough broke`() {
        assertTrue(shouldRetryAsPcm(passthroughFailed = true, passthroughBroken = true, alreadyRetried = false))
        assertFalse(shouldRetryAsPcm(passthroughFailed = true, passthroughBroken = true, alreadyRetried = true))
    }

    @Test fun `other failures still reach the viewer`() {
        // A PCM output failure after passthrough broke earlier in the session.
        assertFalse(shouldRetryAsPcm(passthroughFailed = false, passthroughBroken = true, alreadyRetried = false))
        assertFalse(shouldRetryAsPcm(passthroughFailed = true, passthroughBroken = false, alreadyRetried = false))
    }

    @Test fun `only audio track failures count as audio output errors`() {
        assertTrue(isAudioOutputError(PlaybackException.ERROR_CODE_AUDIO_TRACK_INIT_FAILED))
        assertTrue(isAudioOutputError(PlaybackException.ERROR_CODE_AUDIO_TRACK_WRITE_FAILED))
        assertFalse(isAudioOutputError(PlaybackException.ERROR_CODE_DECODER_INIT_FAILED))
    }
}
