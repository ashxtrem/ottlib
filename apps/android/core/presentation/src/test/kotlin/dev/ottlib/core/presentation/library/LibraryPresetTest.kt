package dev.ottlib.core.presentation.library

import androidx.lifecycle.ViewModelStore
import dev.ottlib.core.model.ScanStatus
import dev.ottlib.core.network.MovieSort
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
import java.util.concurrent.CopyOnWriteArrayList

@OptIn(ExperimentalCoroutinesApi::class)
class LibraryPresetTest {
    private val item = """{"id":1,"title":"Alien","year":null,"posterUrl":null,"resolution":null,"hdrFormat":null,"watched":false,"resumePositionMs":null,"durationMs":null,"missing":false,"metadataStatus":"matched","shelves":[],"showKey":null}"""

    @Test fun thePresetReachesTheRequestAndSurvivesAFilterChange() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val server = MockWebServer()
        val store = ViewModelStore()
        val listRequests = CopyOnWriteArrayList<RecordedRequest>()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                if (request.path!!.contains("filter-options")) return MockResponse().setBody("""{"genres":[],"actors":[],"resolutions":[],"audioLanguages":[]}""")
                listRequests += request
                return MockResponse().setBody("""{"items":[$item],"nextCursor":null,"total":1}""")
            }
        }
        server.start()
        try {
            val api = OttlibApi(OkHttpClient()) { server.url("/") }
            val sync = LibrarySync(backgroundScope, { ScanStatus("idle") }, { ScanStatus("idle") })
            val viewModel = LibraryViewModel(api, sync, preset = LibraryPreset(actor = "Tom Hanks", collectionId = 42))
            store.put("library", viewModel)

            viewModel.uiState.first { it.items.size == 1 }
            val first = listRequests.single().requestUrl!!
            assertEquals("Tom Hanks", first.queryParameter("actor"))
            assertEquals("42", first.queryParameter("collection"))

            // A change that drops the preset's fields (a bare LibraryFilters) gets them back.
            viewModel.setFilters(LibraryFilters(sort = MovieSort.Year))
            val reloaded = viewModel.uiState.first { it.filters.sort == MovieSort.Year && it.items.size == 1 }
            assertEquals(LibraryFilters(sort = MovieSort.Year, actor = "Tom Hanks", collectionId = 42), reloaded.filters)
            val second = listRequests.last().requestUrl!!
            assertEquals(2, listRequests.size)
            assertEquals("year", second.queryParameter("sort"))
            assertEquals("Tom Hanks", second.queryParameter("actor"))
            assertEquals("42", second.queryParameter("collection"))
        } finally {
            store.clear()
            server.shutdown()
            Dispatchers.resetMain()
        }
    }

    @Test fun noPresetSendsNeitherParameter() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val server = MockWebServer()
        val store = ViewModelStore()
        val listRequests = CopyOnWriteArrayList<RecordedRequest>()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                if (request.path!!.contains("filter-options")) return MockResponse().setBody("""{"genres":[],"actors":[],"resolutions":[],"audioLanguages":[]}""")
                listRequests += request
                return MockResponse().setBody("""{"items":[$item],"nextCursor":null,"total":1}""")
            }
        }
        server.start()
        try {
            val api = OttlibApi(OkHttpClient()) { server.url("/") }
            val sync = LibrarySync(backgroundScope, { ScanStatus("idle") }, { ScanStatus("idle") })
            val viewModel = LibraryViewModel(api, sync)
            store.put("library", viewModel)

            viewModel.uiState.first { it.items.size == 1 }
            val url = listRequests.single().requestUrl!!
            assertNull(url.queryParameter("actor"))
            assertNull(url.queryParameter("collection"))
        } finally {
            store.clear()
            server.shutdown()
            Dispatchers.resetMain()
        }
    }
}
