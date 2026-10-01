package dev.ottlib.core.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ReleaseVersionTest {
    @Test
    fun matchesTheReleaseWorkflowsVersionCode() {
        assertEquals(ReleaseVersion("0.1.0", 100), ReleaseVersion.fromTag("v0.1.0"))
        assertEquals(ReleaseVersion("1.2.3", 10203), ReleaseVersion.fromTag("v1.2.3"))
        assertEquals(ReleaseVersion("2.0.1-beta.1", 20001), ReleaseVersion.fromTag("v2.0.1-beta.1"))
    }

    @Test
    fun rejectsTagsTheWorkflowWouldReject() {
        assertNull(ReleaseVersion.fromTag("latest"))
        assertNull(ReleaseVersion.fromTag("v1.2"))
    }

    @Test
    fun parsesSha256sumOutput() {
        val hash = "a".repeat(64)
        val parsed = Checksums.parse("$hash  ottlib-tv-0.2.0.apk\n${"B".repeat(64)} *ottlib-mobile-0.2.0.apk\nnot a checksum line\n")
        assertEquals(hash, parsed["ottlib-tv-0.2.0.apk"])
        assertEquals("b".repeat(64), parsed["ottlib-mobile-0.2.0.apk"])
        assertEquals(2, parsed.size)
    }
}
