package dev.ottlib.core.presentation.home

import androidx.lifecycle.ViewModelStore
import dev.ottlib.core.model.ScanStatus
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.presentation.LoadState
import dev.ottlib.core.presentation.TestJson
import dev.ottlib.core.presentation.sync.LibrarySync
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
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
import java.util.concurrent.atomic.AtomicInteger

@OptIn(ExperimentalCoroutinesApi::class)
class HomeHeroTest {
    /** Serves a home with the given Continue watching and Unwatched lists; every other row is empty. */
    private class FakeHome(var continueItems: List<String>, var unwatchedItems: List<String>) : Dispatcher() {
        val movieFetches = AtomicInteger()
        override fun dispatch(request: RecordedRequest): MockResponse {
            val path = request.path!!
            val body = when {
                path.startsWith("/api/movies/continue-watching") -> "[${continueItems.joinToString(",")}]"
                path.startsWith("/api/movies/filter-options") -> """{"genres":[],"actors":[],"resolutions":[],"audioLanguages":[]}"""
                path.startsWith("/api/shelves") -> "[]"
                path.startsWith("/api/movies?") -> if ("watched=false" in path) TestJson.page(*unwatchedItems.toTypedArray()) else TestJson.page()
                else -> Regex("/api/movies/(\\d+)").matchEntire(path)?.let { movieFetches.incrementAndGet(); TestJson.movie(it.groupValues[1].toInt()) } ?: "{}"
            }
            return MockResponse().setBody(body)
        }
    }

    private fun withHome(home: FakeHome, hidden: MutableStateFlow<Set<String>> = MutableStateFlow(emptySet()), block: suspend TestScope.(HomeViewModel) -> Unit) = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val server = MockWebServer()
        val store = ViewModelStore()
        server.dispatcher = home
        server.start()
        try {
            val api = OttlibApi(OkHttpClient()) { server.url("/") }
            val sync = LibrarySync(backgroundScope, { ScanStatus("idle") }, { ScanStatus("idle") })
            val viewModel = HomeViewModel(api, sync, hidden)
            store.put("home", viewModel)
            block(viewModel)
        } finally {
            store.clear()
            testScheduler.advanceUntilIdle()
            server.shutdown()
            Dispatchers.resetMain()
        }
    }

    private fun item(id: Int, resume: Long? = null) = TestJson.listItem(id, resumePositionMs = resume)

    @Test fun heroIsTheFirstContinueWatchingTitleWithItsDetails() = withHome(FakeHome(listOf(item(7, 600_000), item(8, 1_000)), listOf(item(1)))) { viewModel ->
        val hero = viewModel.hero.first { it?.overview != null }!!
        assertEquals(7L, hero.item.id)
        assertEquals("About 7", hero.overview)
        assertEquals("Resume at 10:00", hero.resumeLabel)
        assert(hero.backdropUrl!!.endsWith("/media/backdrops/7.jpg"))
        assert(hero.logoUrl!!.endsWith("/media/logos/7.png"))
    }

    @Test fun heroFallsBackToTheFirstUnwatchedTitle() = withHome(FakeHome(emptyList(), listOf(item(3), item(4)))) { viewModel ->
        val hero = viewModel.hero.first { it?.overview != null }!!
        assertEquals(3L, hero.item.id)
        assertNull(hero.resumeLabel)
    }

    @Test fun aHiddenTitleIsNeverTheHero() = withHome(FakeHome(listOf(item(7, 1_000), item(8, 1_000)), listOf(item(1))), MutableStateFlow(setOf("m:7"))) { viewModel ->
        assertEquals(8L, viewModel.hero.first { it?.overview != null }!!.item.id)
    }

    @Test fun hidingEveryContinueTitleMovesTheHeroToUnwatched() = withHome(FakeHome(listOf(item(7, 1_000)), listOf(item(1))), MutableStateFlow(setOf("m:7"))) { viewModel ->
        assertEquals(1L, viewModel.hero.first { it?.overview != null }!!.item.id)
    }

    @Test fun heroIsNullWithNoRows() = withHome(FakeHome(emptyList(), emptyList())) { viewModel ->
        viewModel.rows.first { it is LoadState.Loaded }
        assertNull(viewModel.hero.value)
    }

    @Test fun anUnchangedPickIsNotRefetched() {
        val home = FakeHome(emptyList(), listOf(item(1)))
        withHome(home) { viewModel ->
            assertEquals(1L, viewModel.hero.first { it?.overview != null }!!.item.id)
            // A second load brings another unwatched title; the first stays the hero and its movie is not fetched again.
            // The fake serves the new list from the next request on.
            home.unwatchedItems = listOf(item(1), item(5))
            viewModel.load()
            viewModel.rows.first { state -> (state as? LoadState.Loaded)?.value?.firstOrNull { it.key == "unwatched" }?.items?.size == 2 }
            testScheduler.advanceUntilIdle()
            assertEquals(1L, viewModel.hero.value!!.item.id)
            assertEquals(1, home.movieFetches.get())
        }
    }
}
