package dev.ottlib.core.presentation.library

import androidx.lifecycle.ViewModelStore
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
import org.junit.Test
import java.util.concurrent.atomic.AtomicBoolean

@OptIn(ExperimentalCoroutinesApi::class)
class LibraryMetadataRefreshTest {
    @Test fun metadataCompletionUpdatesLoadedPostersAndGenreChoices() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val server = MockWebServer()
        val store = ViewModelStore()
        val updated = AtomicBoolean(false)
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val title = if (updated.get()) "Correct title" else "Wrong title"
                return MockResponse().setBody(if (request.path!!.contains("filter-options")) {
                    if (updated.get()) """{"genres":["Drama"],"actors":[],"resolutions":[],"audioLanguages":[]}"""
                    else """{"genres":[],"actors":[],"resolutions":[],"audioLanguages":[]}"""
                } else """{"items":[{"id":1,"title":"$title","year":2024,"posterUrl":"/media/posters/$title.jpg","resolution":null,"hdrFormat":null,"watched":false,"resumePositionMs":150000,"durationMs":1000000,"missing":false,"metadataStatus":"matched","shelves":[]}],"nextCursor":null,"total":1}""")
            }
        }
        server.start()
        try {
            val api = OttlibApi(OkHttpClient()) { server.url("/") }
            val sync = LibrarySync(backgroundScope, { ScanStatus("idle") }, { ScanStatus("idle") })
            val viewModel = LibraryViewModel(api, sync)
            store.put("library", viewModel)
            viewModel.uiState.first { it.items.isNotEmpty() }
            updated.set(true)
            api.metadataUpdated()
            val result = viewModel.uiState.first { it.items.firstOrNull()?.title == "Correct title" && it.genres == listOf("Drama") }
            assertEquals(150_000L, result.items.single().resumePositionMs)
            assertEquals(false, result.items.single().watched)
            assertEquals(1, result.total)
        } finally { store.clear(); server.shutdown(); Dispatchers.resetMain() }
    }
}
