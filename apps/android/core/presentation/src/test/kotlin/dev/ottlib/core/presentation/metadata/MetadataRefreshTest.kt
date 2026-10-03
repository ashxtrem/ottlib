package dev.ottlib.core.presentation.metadata

import dev.ottlib.core.model.ScanStatus
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MetadataRefreshTest {
    @Test fun refreshesExactlyOneTitleAndPublishesCompletion() = runTest {
        val started = mutableListOf<Long>()
        var calls = 0
        var changes = 0
        val refresh = MetadataRefresh(backgroundScope,
            { id -> started += id; ScanStatus("running", id = 9) },
            { if (calls++ == 0) ScanStatus("idle") else ScanStatus("completed", id = 9, titlesAdded = 1) },
            { changes++ }, { "server-a" }, pollMs = 10)
        refresh.refresh(17)
        refresh.refresh(18)
        runCurrent()
        assertTrue(refresh.state.value.running)
        advanceTimeBy(10); runCurrent()
        assertEquals(listOf(17L), started)
        assertEquals(17L, refresh.state.value.movieId)
        assertFalse(refresh.state.value.running)
        assertEquals("Metadata refreshed for this title.", refresh.state.value.message)
        assertEquals(1, changes)
    }

    @Test fun refusesToJoinAnUnrelatedRunningRefresh() = runTest {
        var starts = 0
        val refresh = MetadataRefresh(backgroundScope, { starts++; ScanStatus("running") },
            { ScanStatus("running", id = 10) }, {}, { "server" })
        refresh.refresh(17); runCurrent()
        assertEquals(0, starts)
        assertFalse(refresh.state.value.running)
        assertTrue(refresh.state.value.message!!.contains("Another metadata refresh"))
    }

    @Test fun completedRunWithProviderErrorDoesNotClaimSuccess() = runTest {
        var polls = 0
        var changes = 0
        val refresh = MetadataRefresh(backgroundScope, { ScanStatus("running", id = 7) },
            { if (polls++ == 0) ScanStatus("idle") else ScanStatus("completed", id = 7, errorSummary = "Provider unavailable") },
            { changes++ }, { "server" }, pollMs = 10)
        refresh.refresh(17); runCurrent(); advanceTimeBy(10); runCurrent()
        assertEquals("Provider unavailable", refresh.state.value.message)
        assertEquals(1, changes)
    }

    @Test fun noMatchAsksForReviewInsteadOfClaimingSuccess() = runTest {
        val refresh = MetadataRefresh(backgroundScope, { ScanStatus("completed", id = 7) },
            { ScanStatus("idle") }, {}, { "server" })
        refresh.refresh(17); runCurrent()
        assertTrue(refresh.state.value.message!!.contains("Review suggestions"))
    }

    @Test fun stopsPollingAndDoesNotInvalidateADifferentServer() = runTest {
        var activeServer = "a"
        var statusCalls = 0
        var changes = 0
        val refresh = MetadataRefresh(backgroundScope, { ScanStatus("running", id = 7) },
            { statusCalls++; ScanStatus("idle") }, { changes++ }, { activeServer }, pollMs = 10)
        refresh.refresh(17); runCurrent()
        activeServer = "b"
        advanceTimeBy(10); runCurrent()
        assertEquals(1, statusCalls)
        assertEquals(0, changes)
        assertFalse(refresh.state.value.running)
        assertTrue(refresh.state.value.message!!.contains("server changed"))
    }

    @Test fun timesOutWithoutStartingAnotherRefresh() = runTest {
        var calls = 0
        var starts = 0
        val refresh = MetadataRefresh(backgroundScope, { starts++; ScanStatus("running", id = 7) },
            { if (calls++ == 0) ScanStatus("idle") else ScanStatus("running", id = 7) },
            {}, { "server" }, pollMs = 10, timeoutMs = 20)
        refresh.refresh(17); runCurrent()
        advanceTimeBy(20); runCurrent()
        assertEquals(1, starts)
        assertFalse(refresh.state.value.running)
        assertTrue(refresh.state.value.message!!.contains("still refreshing"))
    }
}
