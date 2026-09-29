package dev.ottlib.core.model

import kotlinx.serialization.Serializable

/**
 * A library scan on the server: what `POST /api/scan` returns and `GET /api/scan/status` reports. Mirrors
 * `scanRunSchema` in packages/shared/src/index.ts. Before the server has ever scanned, the status endpoint
 * answers with just `{"status":"idle"}`, so everything but [status] has a default.
 */
@Serializable
data class ScanStatus(
    /** `running`, `completed`, `failed`, or `idle`. */
    val status: String,
    val id: Long? = null,
    val kind: String? = null,
    val startedAt: String? = null,
    val finishedAt: String? = null,
    val filesFound: Int = 0,
    val filesProcessed: Int = 0,
    val titlesAdded: Int = 0,
    val errorSummary: String? = null,
) {
    val isRunning: Boolean get() = status == RUNNING

    companion object {
        const val RUNNING = "running"
        const val FAILED = "failed"
    }
}
