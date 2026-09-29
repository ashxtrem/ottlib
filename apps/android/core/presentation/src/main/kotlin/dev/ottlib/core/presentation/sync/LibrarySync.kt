package dev.ottlib.core.presentation.sync

import dev.ottlib.core.model.ScanStatus
import dev.ottlib.core.presentation.userMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface SyncState {
    data object Idle : SyncState

    /** [filesProcessed] is what the server has looked at so far; 0 until it reports progress. */
    data class Running(val filesProcessed: Int = 0) : SyncState
}

/** How a sync ended. */
sealed interface SyncOutcome {
    data class Done(val titlesAdded: Int) : SyncOutcome
    data class Failed(val message: String) : SyncOutcome
}

fun SyncOutcome.message(): String = when (this) {
    is SyncOutcome.Done -> when (titlesAdded) {
        0 -> "Library is up to date"
        1 -> "Library synced: 1 new title"
        else -> "Library synced: $titlesAdded new titles"
    }
    is SyncOutcome.Failed -> message
}

/**
 * The Sync button's engine: asks the server to scan its library folders (new and removed files only — refreshing
 * metadata is a separate server action) and follows the scan until it finishes. App-wide rather than per screen, so
 * a sync keeps going, and still reports, when the viewer navigates away.
 *
 * If a scan is already running on the server (started from the web app or the schedule) this joins it instead of
 * starting another. Screens that show library content reload when [outcomes] emits [SyncOutcome.Done].
 */
class LibrarySync(
    private val scope: CoroutineScope,
    private val startScan: suspend () -> ScanStatus,
    private val scanStatus: suspend () -> ScanStatus,
    private val pollMs: Long = POLL_MS,
    private val giveUpAfterMs: Long = GIVE_UP_AFTER_MS,
) {
    private val current = MutableStateFlow<SyncState>(SyncState.Idle)
    val state: StateFlow<SyncState> = current.asStateFlow()

    private val finished = MutableSharedFlow<SyncOutcome>(extraBufferCapacity = 4)
    val outcomes: SharedFlow<SyncOutcome> = finished.asSharedFlow()

    /** Starts (or joins) a sync. Does nothing while one is already in progress. */
    fun start() {
        if (!current.compareAndSet(SyncState.Idle, SyncState.Running())) return
        scope.launch {
            val outcome = try { sync() } finally { current.value = SyncState.Idle }
            finished.emit(outcome)
        }
    }

    private suspend fun sync(): SyncOutcome {
        try {
            var scan = startScan()
            var waitedMs = 0L
            while (scan.isRunning) {
                current.value = SyncState.Running(scan.filesProcessed)
                if (waitedMs >= giveUpAfterMs) return SyncOutcome.Failed("The server is still scanning. Check back in a few minutes.")
                delay(pollMs)
                waitedMs += pollMs
                scan = scanStatus()
            }
            return if (scan.status == ScanStatus.FAILED) SyncOutcome.Failed(scan.errorSummary ?: "The scan failed on the server") else SyncOutcome.Done(scan.titlesAdded)
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            return SyncOutcome.Failed(error.userMessage())
        }
    }

    companion object {
        const val POLL_MS = 1_000L
        const val GIVE_UP_AFTER_MS = 15 * 60_000L
    }
}
