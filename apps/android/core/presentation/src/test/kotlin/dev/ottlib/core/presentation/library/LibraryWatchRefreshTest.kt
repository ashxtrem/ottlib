package dev.ottlib.core.presentation.library

import androidx.lifecycle.ViewModelStore
import dev.ottlib.core.model.PlaybackProgressUpdate
import dev.ottlib.core.model.ScanStatus
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.presentation.sync.LibrarySync
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class LibraryWatchRefreshTest {
    @Test fun completionUpdatesAnAlreadyLoadedPosterWithoutReloadingTheLibrary() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val server = MockWebServer()
        val store = ViewModelStore()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse = MockResponse().setBody(when {
                request.path!!.contains("filter-options") -> """{"genres":[],"actors":[],"resolutions":[],"audioLanguages":[]}"""
                request.path!!.contains("progress") -> """{"resumePositionMs":null,"watched":true}"""
                else -> """{"items":[{"id":1,"title":"Episode 1","year":null,"posterUrl":null,"resolution":null,"hdrFormat":null,"watched":false,"resumePositionMs":150000,"durationMs":1000000,"missing":false,"metadataStatus":"matched","shelves":[]}],"nextCursor":null,"total":1}"""
            })
        }
        server.start()
        try {
            val api = OttlibApi(OkHttpClient()) { server.url("/") }
            val sync = LibrarySync(backgroundScope, { ScanStatus("idle") }, { ScanStatus("idle") })
            val viewModel = LibraryViewModel(api, sync)
            store.put("library", viewModel)
            viewModel.uiState.first { it.items.isNotEmpty() }
            api.saveProgress(1, PlaybackProgressUpdate(1_000_000, 1_000_000))
            val updated = viewModel.uiState.first { it.items.firstOrNull()?.watched == true }
            assertNull(updated.items.single().resumePositionMs)
            assertEquals(1, updated.total)
            assertEquals(3, server.requestCount) // Initial genres/list and the progress write; no refetch needed.
        } finally {
            store.clear()
            server.shutdown()
            Dispatchers.resetMain()
        }
    }
}
