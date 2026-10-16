package dev.ottlib.core.presentation.library

import androidx.lifecycle.ViewModelStore
import dev.ottlib.core.model.ScanStatus
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.presentation.sync.LibrarySync
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
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
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class LibraryHiddenTitlesTest {
    private fun item(id: Int, title: String, showKey: String?) =
        """{"id":$id,"title":"$title","year":null,"posterUrl":null,"resolution":null,"hdrFormat":null,"watched":false,"resumePositionMs":null,"durationMs":null,"missing":false,"metadataStatus":"matched","shelves":[],"showKey":${showKey?.let { "\"$it\"" }}}"""

    @Test fun hidingAMovieOrAShowRemovesThemLiveWithoutRefetching() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val server = MockWebServer()
        val store = ViewModelStore()
        val items = listOf(item(1, "Alien", null), item(2, "Severance · S1E1", "tv:imdb:tt11280740"), item(3, "Severance · S1E2", "tv:imdb:tt11280740"), item(4, "Heat", null))
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse = MockResponse().setBody(
                if (request.path!!.contains("filter-options")) """{"genres":[],"actors":[],"resolutions":[],"audioLanguages":[]}"""
                else """{"items":[${items.joinToString(",")}],"nextCursor":null,"total":4}""",
            )
        }
        server.start()
        try {
            val api = OttlibApi(OkHttpClient()) { server.url("/") }
            val sync = LibrarySync(backgroundScope, { ScanStatus("idle") }, { ScanStatus("idle") })
            val hidden = MutableStateFlow(emptySet<String>())
            val viewModel = LibraryViewModel(api, sync, hidden)
            store.put("library", viewModel)

            assertEquals(listOf(1L, 2L, 3L, 4L), viewModel.uiState.first { it.items.size == 4 }.items.map { it.id })

            hidden.value = setOf("m:1", "tv:imdb:tt11280740")
            assertEquals(listOf(4L), viewModel.uiState.first { it.items.size == 1 }.items.map { it.id })

            hidden.value = emptySet()
            assertEquals(4, viewModel.uiState.first { it.items.size == 4 }.items.size)
            assertEquals(2, server.requestCount) // The first genres and list requests only; hiding is a local filter.
        } finally {
            store.clear()
            server.shutdown()
            Dispatchers.resetMain()
        }
    }
}
