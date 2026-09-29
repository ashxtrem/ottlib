package dev.ottlib.core.presentation.sync

import dev.ottlib.core.model.ScanStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class LibrarySyncTest {
    private fun scan(status: String, processed: Int = 0, added: Int = 0, error: String? = null) =
        ScanStatus(status = status, id = 1, kind = "scan", filesFound = 100, filesProcessed = processed, titlesAdded = added, errorSummary = error)

    /** Scripted server answers: [started] for the start call, then [statuses] one per poll (the last one repeats). */
    private class Script(private val started: ScanStatus, private val statuses: List<ScanStatus>) {
        var startCalls = 0
        var polls = 0
        val start: suspend () -> ScanStatus = { startCalls += 1; started }
        val status: suspend () -> ScanStatus = { statuses[minOf(polls++, statuses.lastIndex)] }
    }

    private fun TestScope.syncFor(server: Script, pollMs: Long = 1_000, giveUpAfterMs: Long = LibrarySync.GIVE_UP_AFTER_MS) =
        LibrarySync(CoroutineScope(StandardTestDispatcher(testScheduler)), server.start, server.status, pollMs, giveUpAfterMs)

    private fun TestScope.collect(sync: LibrarySync): List<SyncOutcome> {
        val outcomes = mutableListOf<SyncOutcome>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { sync.outcomes.collect { outcomes += it } }
        return outcomes
    }

    @Test
    fun followsTheScanToTheEndAndReportsNewTitles() = runTest {
        val server = Script(scan("running"), listOf(scan("running", processed = 40), scan("running", processed = 90), scan("completed", processed = 100, added = 3)))
        val sync = syncFor(server)
        val outcomes = collect(sync)

        sync.start()
        advanceUntilIdle()

        assertEquals(listOf<SyncOutcome>(SyncOutcome.Done(3)), outcomes)
        assertEquals(SyncState.Idle, sync.state.value)
        assertEquals(3, server.polls)
    }

    @Test
    fun ignoresPressesWhileASyncIsRunning() = runTest {
        val server = Script(scan("running"), listOf(scan("running"), scan("completed")))
        val sync = syncFor(server)

        sync.start()
        sync.start()
        sync.start()
        assertTrue(sync.state.value is SyncState.Running)
        advanceUntilIdle()

        assertEquals(1, server.startCalls)
    }

    @Test
    fun aScanThatFinishedInstantlyNeedsNoPolling() = runTest {
        val server = Script(scan("completed", processed = 100, added = 0), emptyList())
        val sync = syncFor(server)
        val outcomes = collect(sync)

        sync.start()
        advanceUntilIdle()

        assertEquals(listOf<SyncOutcome>(SyncOutcome.Done(0)), outcomes)
        assertEquals(0, server.polls)
    }

    @Test
    fun reportsWhyAScanFailedOnTheServer() = runTest {
        val server = Script(scan("running"), listOf(scan("failed", error = "D:\\Movies: drive not ready")))
        val sync = syncFor(server)
        val outcomes = collect(sync)

        sync.start()
        advanceUntilIdle()

        assertEquals(listOf<SyncOutcome>(SyncOutcome.Failed("D:\\Movies: drive not ready")), outcomes)
        assertEquals(SyncState.Idle, sync.state.value)
    }

    @Test
    fun anUnreachableServerFailsCleanlyAndCanBeRetried() = runTest {
        var reachable = false
        val sync = LibrarySync(
            CoroutineScope(StandardTestDispatcher(testScheduler)),
            startScan = { if (reachable) scan("completed", added = 1) else throw IOException("no route to host") },
            scanStatus = { error("not polled") },
        )
        val outcomes = collect(sync)

        sync.start()
        advanceUntilIdle()
        assertTrue((outcomes.single() as SyncOutcome.Failed).message.contains("Can't reach the Ottlib server"))
        assertEquals(SyncState.Idle, sync.state.value)

        reachable = true
        sync.start()
        advanceUntilIdle()
        assertEquals(SyncOutcome.Done(1), outcomes.last())
    }

    @Test
    fun givesUpOnAScanThatNeverFinishes() = runTest {
        val server = Script(scan("running"), listOf(scan("running")))
        val sync = syncFor(server, pollMs = 1_000, giveUpAfterMs = 5_000)
        val outcomes = collect(sync)

        sync.start()
        advanceUntilIdle()

        assertTrue((outcomes.single() as SyncOutcome.Failed).message.contains("still scanning"))
        assertEquals(SyncState.Idle, sync.state.value)
    }

    @Test
    fun messagesReadNaturally() {
        assertEquals("Library is up to date", SyncOutcome.Done(0).message())
        assertEquals("Library synced: 1 new title", SyncOutcome.Done(1).message())
        assertEquals("Library synced: 12 new titles", SyncOutcome.Done(12).message())
        assertEquals("Boom", SyncOutcome.Failed("Boom").message())
    }
}
