package dev.ottlib.core.presentation.metadata

import dev.ottlib.core.model.ScanStatus
import dev.ottlib.core.presentation.userMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class MetadataRefreshState(
    val movieId: Long? = null,
    val running: Boolean = false,
    val message: String? = null,
)

/** Follows a single-title refresh even when its details screen or dialog closes. */
class MetadataRefresh(
    private val scope: CoroutineScope,
    private val start: suspend (Long) -> ScanStatus,
    private val status: suspend () -> ScanStatus,
    private val updated: () -> Unit,
    private val server: () -> String?,
    private val pollMs: Long = 1_000,
    private val timeoutMs: Long = 15 * 60_000,
) {
    private val current = MutableStateFlow(MetadataRefreshState())
    val state = current.asStateFlow()

    fun refresh(movieId: Long) {
        val previous = current.value
        if (previous.running || !current.compareAndSet(previous, MetadataRefreshState(movieId, running = true))) return
        val activeServer = server()
        scope.launch {
            var started = false
            try {
                if (status().isRunning) {
                    current.value = MetadataRefreshState(movieId, message = "Another metadata refresh is running. Try again when it finishes.")
                    return@launch
                }
                check(server() == activeServer) { "The active server changed. Open this title again." }
                var run = start(movieId)
                started = true
                val runId = run.id
                var waited = 0L
                while (run.isRunning) {
                    if (waited >= timeoutMs) {
                        current.value = MetadataRefreshState(movieId, message = "The server is still refreshing this title. Check back in a few minutes.")
                        return@launch
                    }
                    delay(pollMs)
                    waited += pollMs
                    check(server() == activeServer) { "The active server changed. Check the original server for the result." }
                    run = status()
                    check(run.id == runId) { "The server's refresh status changed. Open this title again to check the result." }
                }
                updated()
                val message = when {
                    run.status == ScanStatus.FAILED -> run.errorSummary ?: "Metadata refresh failed."
                    run.errorSummary != null -> run.errorSummary
                    run.titlesAdded > 0 -> "Metadata refreshed for this title."
                    else -> "No automatic match was applied. Review suggestions or use Fix match."
                }
                current.value = MetadataRefreshState(movieId, message = message)
            } catch (error: CancellationException) {
                current.value = MetadataRefreshState(movieId)
                throw error
            } catch (error: Exception) {
                if (started && server() == activeServer) updated()
                current.value = MetadataRefreshState(movieId, message = error.userMessage())
            }
        }
    }
}
