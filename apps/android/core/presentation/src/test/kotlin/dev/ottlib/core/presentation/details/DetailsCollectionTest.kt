package dev.ottlib.core.presentation.details

import androidx.lifecycle.ViewModelStore
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.presentation.ContinueWatchingPublisher
import dev.ottlib.core.presentation.TestJson
import dev.ottlib.core.presentation.ratingsLine
import dev.ottlib.core.presentation.player.PlaybackSequence
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

@OptIn(ExperimentalCoroutinesApi::class)
class DetailsCollectionTest {
    private val missingPart = """{"tmdbId":"99","title":"Part 4","year":2010,"posterUrl":null}"""

    private fun collectionJson(vararg owned: String) = """{"id":9,"name":"Saga","owned":[${owned.joinToString(",")}],"missing":[$missingPart,$missingPart]}"""

    /** Serves movie 2 (in collection 9 when [inSaga]), the saga with titles 1, 2, 3 and no recommendations or copies. */
    private fun withDetails(inSaga: Boolean, hidden: MutableStateFlow<Set<String>> = MutableStateFlow(emptySet()), block: suspend TestScope.(DetailsViewModel) -> Unit) = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val server = MockWebServer()
        val store = ViewModelStore()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path!!
                return when {
                    path.startsWith("/api/movies/2/collection") ->
                        MockResponse().setBody(collectionJson(TestJson.listItem(1), TestJson.listItem(2), TestJson.listItem(3, fresh = "new")))
                    path.startsWith("/api/movies/2/recommendations") || path.startsWith("/api/movies/2/duplicates") -> MockResponse().setBody("[]")
                    path.startsWith("/api/movies/2") -> MockResponse().setBody(TestJson.movie(2, collectionId = if (inSaga) 9 else null))
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }
        server.start()
        try {
            val api = OttlibApi(OkHttpClient()) { server.url("/") }
            val viewModel = DetailsViewModel(api, ContinueWatchingPublisher.None, backgroundScope, 2, PlaybackSequence(api), hidden, { }, { })
            store.put("details", viewModel)
            block(viewModel)
        } finally {
            store.clear()
            testScheduler.advanceUntilIdle() // let cancelled requests finish before Main is reset
            server.shutdown()
            Dispatchers.resetMain()
        }
    }

    @Test fun theCollectionLeavesOutTheOpenTitleAndCountsTheMissingParts() = withDetails(inSaga = true) { viewModel ->
        val saga = viewModel.collection.first { it != null }!!
        assertEquals(9L, saga.id)
        assertEquals("Saga", saga.name)
        assertEquals(listOf(1L, 3L), saga.owned.map { it.id })
        assertEquals(listOf(false, true), saga.owned.map { it.isNew })
        assertEquals(2, saga.missingCount)
    }

    @Test fun theCollectionSkipsTitlesHiddenOnThisDevice() = withDetails(inSaga = true, hidden = MutableStateFlow(setOf("m:3"))) { viewModel ->
        assertEquals(listOf(1L), viewModel.collection.first { it != null }!!.owned.map { it.id })
    }

    @Test fun aTitleOutsideAnySagaHasNoCollection() = withDetails(inSaga = false) { viewModel ->
        assertEquals("Title 2", (viewModel.movie.first { it is dev.ottlib.core.presentation.LoadState.Loaded } as dev.ottlib.core.presentation.LoadState.Loaded).value.title)
        testScheduler.advanceUntilIdle()
        assertNull(viewModel.collection.value)
    }

    @Test fun ratingsCastAndLogoComeFromTheLoadedMovie() = withDetails(inSaga = false) { viewModel ->
        assert(viewModel.logoUrl.first { it != null }!!.endsWith("/media/logos/2.png"))
        assertEquals("IMDb 8.8  ·  RT 87%", viewModel.ratings.first { it.isNotEmpty() }.ratingsLine())
        assertEquals(listOf("Sigourney Weaver", "Tom Skerritt"), viewModel.castMembers.first { it.isNotEmpty() }.map { it.name })
        assert(viewModel.castMembers.value.first().photoUrl!!.endsWith("/media/people/sw.jpg"))
        assertNull(viewModel.castMembers.value.last().photoUrl)
    }
}
