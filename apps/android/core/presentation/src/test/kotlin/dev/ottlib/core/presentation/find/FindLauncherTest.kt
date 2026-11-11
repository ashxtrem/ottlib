package dev.ottlib.core.presentation.find

import dev.ottlib.core.model.ServerInfo
import dev.ottlib.core.network.OttlibApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class FindLauncherTest {
    private val server = MockWebServer().apply { start() }
    private val api = OttlibApi(OkHttpClient()) { server.url("/") }
    @After fun close() = server.shutdown()

    private fun info(findHandoff: String?) = ServerInfo("Den PC", "1.0.0", 1, 8080, emptyList(), findHandoff = findHandoff)

    private fun TestScope.launcher(serverInfo: MutableStateFlow<ServerInfo?>) =
        FindLauncher(CoroutineScope(UnconfinedTestDispatcher(testScheduler) + SupervisorJob()), serverInfo, api::findHandoff)

    /** Subscribes to the next message before [find] runs, since messages are not replayed. */
    private fun TestScope.nextMessage(launcher: FindLauncher) = async(start = CoroutineStart.UNDISPATCHED) { launcher.messages.first() }

    @Test fun availableFollowsTheServersFindHandoff() = runTest {
        val serverInfo = MutableStateFlow<ServerInfo?>(null)
        val launcher = launcher(serverInfo)
        assertEquals(false, launcher.available.value)
        serverInfo.value = info("hashlark")
        assertEquals(true, launcher.available.value)
        serverInfo.value = info(null)
        assertEquals(false, launcher.available.value)
        serverInfo.value = null
        assertEquals(false, launcher.available.value)
    }

    @Test fun successSaysWhereItOpenedAndSendsOnlyTheFieldsGiven() = runTest {
        server.enqueue(MockResponse().setBody("""{"app":"hashlark"}"""))
        val launcher = launcher(MutableStateFlow(info("hashlark")))
        val message = nextMessage(launcher)
        launcher.find("Arrival", 2016, null)
        assertEquals("Opened in Hashlark on Den PC.", message.await())
        val request = server.takeRequest()
        assertEquals("/api/find/handoff", request.path)
        assertEquals("""{"title":"Arrival","year":2016}""", request.body.readUtf8())
    }

    @Test fun aMissingHashlarkGetsTheNotInstalledMessage() = runTest {
        server.enqueue(MockResponse().setResponseCode(409).setBody("""{"error":"HASHLARK_NOT_FOUND","message":"Hashlark is not installed on the server PC."}"""))
        val launcher = launcher(MutableStateFlow(info("hashlark")))
        val message = nextMessage(launcher)
        launcher.find("Heat", null, "tt0113277")
        assertEquals("Hashlark isn't installed on the server PC.", message.await())
    }

    @Test fun otherFailuresEmitTheServersMessageInsteadOfCrashing() = runTest {
        server.enqueue(MockResponse().setResponseCode(404).setBody("""{"error":"Not found"}"""))
        val launcher = launcher(MutableStateFlow(info("hashlark")))
        val message = nextMessage(launcher)
        launcher.find("Heat")
        assertTrue(message.await().isNotBlank())
    }

    @Test fun messagesAreNotReplayedToALaterCollector() = runTest {
        server.enqueue(MockResponse().setBody("""{"app":"hashlark"}"""))
        val launcher = launcher(MutableStateFlow(info("hashlark")))
        val first = nextMessage(launcher)
        launcher.find("Heat")
        first.await()
        val received = mutableListOf<String>()
        val late = launch { launcher.messages.collect { received += it } }
        testScheduler.advanceUntilIdle()
        late.cancel()
        assertTrue(received.isEmpty())
    }
}
