package dev.ottlib.core.data

import dev.ottlib.core.model.SUPPORTED_API_VERSION
import dev.ottlib.core.model.ServerInfo
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class ConnectionCompatibilityTest {
    private fun server(apiVersion: Int) = ServerInfo("Ottlib", "0.1.0", apiVersion, 8081, listOf("192.168.0.2"))

    @Test
    fun acceptsTheSupportedApiVersion() = assertNull(ConnectionManager.compatibilityProblem(server(SUPPORTED_API_VERSION)))

    @Test
    fun rejectsNewerAndOlderServers() {
        assertNotNull(ConnectionManager.compatibilityProblem(server(SUPPORTED_API_VERSION + 1)))
        assertNotNull(ConnectionManager.compatibilityProblem(server(SUPPORTED_API_VERSION - 1)))
    }
}
