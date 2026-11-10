package dev.ottlib.core.presentation.player

import androidx.media3.common.PlaybackException
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RetryAsPcmTest {
    private val audioInit = PlaybackException.ERROR_CODE_AUDIO_TRACK_INIT_FAILED

    @Test fun `retries once after passthrough broke`() {
        assertTrue(shouldRetryAsPcm(audioInit, passthroughBroken = true, alreadyRetried = false))
        assertFalse(shouldRetryAsPcm(audioInit, passthroughBroken = true, alreadyRetried = true))
    }

    @Test fun `other failures still reach the viewer`() {
        assertFalse(shouldRetryAsPcm(audioInit, passthroughBroken = false, alreadyRetried = false))
        assertFalse(shouldRetryAsPcm(PlaybackException.ERROR_CODE_DECODER_INIT_FAILED, passthroughBroken = true, alreadyRetried = false))
    }
}
