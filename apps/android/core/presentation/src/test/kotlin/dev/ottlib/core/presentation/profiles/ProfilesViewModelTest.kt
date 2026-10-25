package dev.ottlib.core.presentation.profiles

import androidx.lifecycle.ViewModelStore
import dev.ottlib.core.data.ProfileState
import dev.ottlib.core.data.current
import dev.ottlib.core.network.ApiException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ProfilesViewModelTest {
    private fun withPicker(fake: FakeProfileServer = FakeProfileServer(), body: suspend TestScope.(FakeProfileServer, ProfilesViewModel) -> Unit) = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val store = ViewModelStore()
        try {
            fake.session.resolve()
            val viewModel = ProfilesViewModel(fake.session)
            store.put("profiles", viewModel)
            advanceUntilIdle()
            body(fake, viewModel)
        } finally { store.clear(); Dispatchers.resetMain() }
    }

    @Test fun refreshesTheListOnOpenAndPicksAPinlessProfileAtOnce() = withPicker { fake, viewModel ->
        assertEquals(2, fake.listCalls)
        assertEquals(listOf(owner, kid, locked), viewModel.uiState.value.profiles)
        assertFalse(viewModel.uiState.value.canCancel)
        assertFalse(viewModel.cancel())

        viewModel.choose(kid); advanceUntilIdle()
        assertEquals(listOf(kid.id to null), fake.selected)
        assertEquals(kid, fake.session.state.value.current)
        assertTrue(viewModel.uiState.value.done)
    }

    @Test fun aLockedProfileAsksForItsPinFirst() = withPicker { fake, viewModel ->
        viewModel.choose(locked); advanceUntilIdle()
        assertEquals(locked, viewModel.uiState.value.pinFor)
        assertTrue(fake.selected.isEmpty())

        viewModel.submitPin("1234"); advanceUntilIdle()
        assertEquals(listOf(locked.id to "1234"), fake.selected)
        assertTrue(viewModel.uiState.value.done)
        assertNull(viewModel.uiState.value.pinFor)
    }

    @Test fun aWrongPinSaysSoAndALockoutShowsTheServerText() = withPicker { _, viewModel ->
        viewModel.choose(locked)
        viewModel.submitPin("0000"); advanceUntilIdle()
        assertEquals("Wrong PIN. Try again.", viewModel.uiState.value.error)
        assertEquals(locked, viewModel.uiState.value.pinFor)
        assertFalse(viewModel.uiState.value.done)

        viewModel.submitPin("9999"); advanceUntilIdle()
        assertEquals("Too many wrong PINs. Try again in 30 seconds.", viewModel.uiState.value.error)

        viewModel.closePin()
        assertNull(viewModel.uiState.value.pinFor)
        assertNull(viewModel.uiState.value.error)
    }

    @Test fun beforeResolveItLoadsWithoutAnError() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val store = ViewModelStore()
        try {
            val fake = FakeProfileServer().apply { listError = ApiException(503, "Server unavailable") }
            val viewModel = ProfilesViewModel(fake.session)
            store.put("profiles", viewModel)
            advanceUntilIdle()
            assertTrue(viewModel.uiState.value.loading)
            assertTrue(viewModel.uiState.value.profiles.isEmpty())
            assertNull(viewModel.uiState.value.error)

            fake.listError = null
            fake.session.resolve(); advanceUntilIdle()
            assertFalse(viewModel.uiState.value.loading)
            assertEquals(listOf(owner, kid, locked), viewModel.uiState.value.profiles)
        } finally { store.clear(); Dispatchers.resetMain() }
    }

    @Test fun backFromASwitchKeepsTheProfileInUse() = withPicker { fake, _ ->
        fake.session.select(owner.id, null)
        assertEquals(owner, fake.session.state.value.current)
        fake.session.switch()
        val store = ViewModelStore()
        try {
            val picker = ProfilesViewModel(fake.session)
            store.put("switch", picker)
            advanceUntilIdle()
            assertTrue(picker.uiState.value.canCancel)
            assertTrue(picker.cancel())
            assertEquals(owner, fake.session.state.value.current)
            assertTrue(fake.session.state.value is ProfileState.Selected)
            assertFalse(picker.uiState.value.done)
        } finally { store.clear() }
    }
}
