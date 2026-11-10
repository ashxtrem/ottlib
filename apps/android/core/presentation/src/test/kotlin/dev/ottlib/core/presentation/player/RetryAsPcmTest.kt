package dev.ottlib.core.presentation.player

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
}
