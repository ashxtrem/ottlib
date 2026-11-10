package dev.ottlib.core.presentation.search

import androidx.lifecycle.ViewModelStore
import dev.ottlib.core.data.RecentSearches
import dev.ottlib.core.network.OttlibApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SearchRecentsTest {
    private class FakeRecents : RecentSearches {
        val lists = MutableStateFlow<Map<String, List<String>>>(emptyMap())

        override fun flow(scope: String): Flow<List<String>> = lists.map { it[scope].orEmpty() }

        override suspend fun add(scope: String, query: String) {
            lists.value += scope to (listOf(query) + lists.value[scope].orEmpty().filterNot { it == query })
        }

        override suspend fun remove(scope: String, query: String) {
            lists.value += scope to lists.value[scope].orEmpty().filterNot { it == query }
        }
    }

    private suspend fun TestScope.withViewModel(
        recents: FakeRecents,
        scope: Flow<String?> = flowOf("s"),
        block: suspend (SearchViewModel) -> Unit,
    ) {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val server = MockWebServer()
        server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
            override fun dispatch(request: okhttp3.mockwebserver.RecordedRequest) = MockResponse().setBody("""{"items":[],"nextCursor":null,"total":0}""")
        }
        server.start()
        val store = ViewModelStore()
        try {
            val api = OttlibApi(OkHttpClient()) { server.url("/") }
            val viewModel = SearchViewModel(api, flowOf(emptySet()), recents, scope)
            store.put("search", viewModel)
            block(viewModel)
        } finally {
            store.clear()
            runCurrent() // Lets the cancelled producers finish on the test dispatcher before Main is reset.
            server.shutdown()
            Dispatchers.resetMain()
        }
    }

    @Test fun aQueryUnderTwoCharactersIsNotSaved() = runTest {
        val recents = FakeRecents()
        withViewModel(recents) { viewModel ->
            viewModel.onTextChange("a")
            advanceTimeBy(10_000)
            runCurrent()
            assertEquals(emptyMap<String, List<String>>(), recents.lists.value)
        }
    }

    @Test fun aHeldQueryIsSavedOnceAfterTheDebounceAndHoldTime() = runTest {
        val recents = FakeRecents()
        withViewModel(recents) { viewModel ->
            viewModel.onTextChange("  alien ")
            advanceTimeBy(1_800)
            runCurrent()
            assertEquals(emptyList<String>(), recents.lists.value["s"].orEmpty())

            advanceTimeBy(100)
            runCurrent()
            assertEquals(listOf("alien"), recents.lists.value["s"])
            assertEquals(listOf("alien"), viewModel.recents.value)
        }
    }

    @Test fun aQueryEditedBeforeTheHoldEndsIsNotSavedUntilItSettles() = runTest {
        val recents = FakeRecents()
        withViewModel(recents) { viewModel ->
            viewModel.onTextChange("ali")
            advanceTimeBy(1_500)
            viewModel.onTextChange("alien")
            advanceTimeBy(1_500)
            runCurrent()
            assertEquals(emptyMap<String, List<String>>(), recents.lists.value)

            advanceTimeBy(400)
            runCurrent()
            assertEquals(listOf("alien"), recents.lists.value["s"])
        }
    }

    @Test fun recentsFollowTheScopeAndCanBeUsedAndRemoved() = runTest {
        val recents = FakeRecents()
        recents.lists.value = mapOf("s1" to listOf("alien", "heat"), "s2" to listOf("dune"))
        val scope = MutableStateFlow<String?>("s1")
        withViewModel(recents, scope) { viewModel ->
            runCurrent()
            assertEquals(listOf("alien", "heat"), viewModel.recents.value)

            scope.value = "s2"
            runCurrent()
            assertEquals(listOf("dune"), viewModel.recents.value)

            scope.value = "s1"
            viewModel.removeRecent("alien")
            runCurrent()
            assertEquals(listOf("heat"), viewModel.recents.value)

            viewModel.useRecent("heat")
            assertEquals("heat", viewModel.text.value)
        }
    }
}
