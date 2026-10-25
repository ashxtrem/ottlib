package dev.ottlib.core.presentation.profiles

import androidx.lifecycle.ViewModelStore
import dev.ottlib.core.model.ProfileSummary
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.network.OttlibJson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.TimeUnit

@OptIn(ExperimentalCoroutinesApi::class)
class ProfileManageViewModelTest {
    private class Setup(val fake: FakeProfileServer, val http: MockWebServer, val viewModel: ProfileManageViewModel) {
        fun reply(profile: ProfileSummary) = http.enqueue(MockResponse().setBody(OttlibJson.encodeToString(ProfileSummary.serializer(), profile)))
        fun request(): Pair<RecordedRequest, String> = requireNotNull(http.takeRequest(5, TimeUnit.SECONDS)) { "no request" }.let { it to it.body.readUtf8() }
    }

    /** The HTTP call finishes on an OkHttp thread, so wait (as MetadataViewModelTest does) for the change and its re-list to end. */
    private suspend fun TestScope.settle(s: Setup) {
        advanceUntilIdle()
        s.viewModel.uiState.first { !it.busy }
    }

    private fun withManager(actor: ProfileSummary = owner, body: suspend TestScope.(Setup) -> Unit) = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val http = MockWebServer().apply { start() }
        val store = ViewModelStore()
        try {
            val fake = FakeProfileServer()
            fake.session.select(actor.id, if (actor.hasPin) "1234" else null)
            val viewModel = ProfileManageViewModel(OttlibApi(OkHttpClient()) { http.url("/") }, fake.session)
            store.put("manage", viewModel)
            advanceUntilIdle()
            body(Setup(fake, http, viewModel))
        } finally { store.clear(); http.shutdown(); Dispatchers.resetMain() }
    }

    @Test fun createUsesTheNextUnusedColourAndRelists() = withManager { s ->
        assertTrue(s.viewModel.uiState.value.canAdd)
        assertEquals("#006fee", s.viewModel.nextColor())
        val added = ProfileSummary(4, "Guest", "#006fee", hasPin = false, isOwner = false)
        s.reply(added)
        val listedBefore = s.fake.listCalls
        s.fake.profiles = s.fake.profiles + added
        s.viewModel.create("  Guest ")
        settle(s)
        val (request, json) = s.request()
        assertEquals("POST", request.method)
        assertEquals("/api/profiles", request.path)
        assertTrue(json, json.contains(""""name":"Guest"""") && json.contains(""""color":"#006fee""""))
        assertEquals(listedBefore + 1, s.fake.listCalls)
        assertEquals(4, s.viewModel.uiState.value.profiles.size)
        assertEquals(1, s.viewModel.uiState.value.saved)
        assertNull(s.viewModel.uiState.value.error)
    }

    @Test fun renameAndRecolourSendOnlyWhatChanged() = withManager { s ->
        s.reply(kid.copy(name = "Kiddo"))
        s.viewModel.edit(kid, name = "Kiddo"); settle(s)
        val (rename, renameJson) = s.request()
        assertEquals("PATCH", rename.method)
        assertEquals("/api/profiles/2", rename.path)
        assertEquals("""{"name":"Kiddo"}""", renameJson)

        s.reply(kid.copy(color = "#7828c8"))
        s.viewModel.edit(kid, color = "#7828c8"); settle(s)
        assertEquals("""{"color":"#7828c8"}""", s.request().second)
        assertEquals(2, s.viewModel.uiState.value.saved)
    }

    @Test fun ownerSetsAndClearsAnotherProfilesPinWithoutKnowingIt() = withManager { s ->
        s.reply(kid.copy(hasPin = true))
        s.viewModel.setPin(kid, "4321"); settle(s)
        val (put, putJson) = s.request()
        assertEquals("PUT", put.method)
        assertEquals("/api/profiles/2/pin", put.path)
        assertEquals("""{"pin":"4321"}""", putJson)

        s.reply(locked.copy(hasPin = false))
        s.viewModel.clearPin(locked); settle(s)
        assertEquals("""{"pin":null}""", s.request().second)
    }

    @Test fun changingOrClearingYourOwnPinNeedsTheCurrentOne() = withManager(locked) { s ->
        s.viewModel.setPin(locked, "5678")
        assertEquals("Enter the current PIN.", s.viewModel.uiState.value.error)
        s.viewModel.clearPin(locked)
        assertEquals("Enter the current PIN.", s.viewModel.uiState.value.error)
        assertEquals(0, s.http.requestCount)

        s.http.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":"PROFILE_PIN_INVALID","message":"Wrong PIN."}"""))
        s.viewModel.setPin(locked, "5678", currentPin = "0000"); settle(s)
        assertEquals("""{"currentPin":"0000","pin":"5678"}""", s.request().second)
        assertEquals("Wrong PIN. Try again.", s.viewModel.uiState.value.error)

        s.reply(locked.copy(hasPin = false))
        s.viewModel.clearPin(locked, currentPin = "1234"); settle(s)
        assertEquals("""{"currentPin":"1234","pin":null}""", s.request().second)
        assertNull(s.viewModel.uiState.value.error)
    }

    @Test fun deleteRelistsAndServerErrorsShowAsIs() = withManager { s ->
        s.http.enqueue(MockResponse().setResponseCode(204))
        s.fake.profiles = listOf(owner, locked)
        s.viewModel.delete(kid); settle(s)
        val (delete, _) = s.request()
        assertEquals("DELETE", delete.method)
        assertEquals("/api/profiles/2", delete.path)
        assertEquals(listOf(owner, locked), s.viewModel.uiState.value.profiles)

        s.http.enqueue(MockResponse().setResponseCode(409).setBody("""{"error":"PROFILE_NAME_TAKEN","message":"Another profile already has that name."}"""))
        s.viewModel.edit(locked, name = "Home"); settle(s)
        assertEquals("Another profile already has that name.", s.viewModel.uiState.value.error)
    }

    @Test fun aNonOwnerIsNotOfferedOrSentOwnerActions() = withManager(kid) { s ->
        assertEquals(false, s.viewModel.uiState.value.canAdd)
        s.viewModel.delete(locked)
        s.viewModel.edit(locked, name = "Mine")
        s.viewModel.create("Extra")
        assertEquals(0, s.http.requestCount)
        assertEquals("Only the owner profile can do that.", s.viewModel.uiState.value.error)
    }
}
