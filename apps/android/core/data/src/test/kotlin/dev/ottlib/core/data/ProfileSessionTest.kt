package dev.ottlib.core.data

import dev.ottlib.core.model.PROFILE_PIN_INVALID
import dev.ottlib.core.model.PROFILE_REQUIRED
import dev.ottlib.core.model.ProfileMe
import dev.ottlib.core.model.ProfileSelectResult
import dev.ottlib.core.model.ProfileSummary
import dev.ottlib.core.network.ApiException
import kotlinx.coroutines.test.runTest
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class ProfileSessionTest {
    private val server = "http://192.168.0.2:8081/".toHttpUrl()
    private val other = "http://192.168.0.9:8081/".toHttpUrl()
    private val owner = ProfileSummary(1, "Owner", "#e50914", hasPin = false, isOwner = true)
    private val kid = ProfileSummary(2, "Kid", "#f5a524", hasPin = false, isOwner = false)
    private val locked = ProfileSummary(3, "Locked", "#17c964", hasPin = true, isOwner = false)

    private class FakeTokens : ProfileTokens {
        val tokens = mutableMapOf<String, String>()
        var last: String? = null
        override fun tokenBlocking(server: HttpUrl) = tokens[ProfileSessionStore.origin(server)]
        override suspend fun save(server: HttpUrl, token: String) { tokens[ProfileSessionStore.origin(server)] = token }
        override suspend fun clear(server: HttpUrl) { tokens.remove(ProfileSessionStore.origin(server)) }
        override suspend fun lastProfile() = last
        override suspend fun saveLastProfile(key: String) { last = key }
    }

    private val tokens = FakeTokens()
    private var listed: () -> List<ProfileSummary> = { listOf(owner, kid) }
    private var me: () -> ProfileSummary = { owner }
    private val selected = mutableListOf<Pair<Int, String?>>()
    private val deselectedTokens = mutableListOf<String?>()
    private var changes = 0
    private var active: HttpUrl? = server

    private val session = ProfileSession(
        tokens,
        ProfileAccess(
            profiles = { listed() },
            select = { id, pin ->
                if (id == locked.id && pin != "1234") throw ApiException(403, "Wrong PIN", PROFILE_PIN_INVALID)
                selected += id to pin
                ProfileSelectResult("token-$id", (listed() + locked).first { it.id == id })
            },
            deselect = { deselectedTokens += tokens.tokenBlocking(server) },
            me = { ProfileMe(me()) },
        ),
        { active },
        { changes++ },
    )

    private fun notFound(): Nothing = throw ApiException(404, "Not found")

    @Test
    fun aServerWithoutProfilesIsUnsupported() = runTest {
        listed = { notFound() }
        assertEquals(ProfileState.Unsupported, session.resolve())
        assertFalse(session.state.value.canSwitchProfile)
    }

    @Test
    fun aSolePinlessProfileIsSelectedSilently() = runTest {
        listed = { listOf(owner) }
        assertEquals(ProfileState.Single(owner), session.resolve())
        assertEquals(listOf(owner.id to null), selected)
        assertEquals("token-1", tokens.tokenBlocking(server))
        assertFalse(session.state.value.canSwitchProfile)
    }

    @Test
    fun aStoredTokenTheServerStillAcceptsKeepsItsProfile() = runTest {
        tokens.save(server, "token-2")
        me = { kid }
        assertEquals(ProfileState.Selected(kid, listOf(owner, kid)), session.resolve())
        assertTrue(selected.isEmpty())
        assertTrue(session.state.value.canSwitchProfile)
    }

    @Test
    fun aStoredTokenTheServerRejectsIsClearedAndThePickerShows() = runTest {
        tokens.save(server, "stale")
        me = { throw ApiException(409, "Pick a profile", PROFILE_REQUIRED) }
        assertEquals(ProfileState.NeedsPick(listOf(owner, kid)), session.resolve())
        assertNull(tokens.tokenBlocking(server))
    }

    @Test
    fun severalProfilesWithoutATokenShowThePicker() = runTest {
        assertEquals(ProfileState.NeedsPick(listOf(owner, kid)), session.resolve())
        assertTrue(selected.isEmpty())
    }

    @Test
    fun otherServerErrorsPropagate() = runTest {
        listed = { throw ApiException(500, "Boom") }
        try { session.resolve(); fail("expected ApiException") } catch (error: ApiException) { assertEquals(500, error.statusCode) }
    }

    @Test
    fun selectStoresTheNewTokenAndEndsTheOldSession() = runTest {
        tokens.save(server, "token-1")
        session.resolve()
        assertEquals(ProfileState.Selected(kid, listOf(owner, kid)), session.select(kid.id, null))
        assertEquals(listOf<String?>("token-1"), deselectedTokens)
        assertEquals("token-2", tokens.tokenBlocking(server))
    }

    @Test
    fun aWrongPinThrowsAndKeepsTheCurrentSession() = runTest {
        listed = { listOf(owner, locked) }
        tokens.save(server, "token-1")
        session.resolve()
        try { session.select(locked.id, "0000"); fail("expected ApiException") } catch (error: ApiException) { assertEquals(403, error.statusCode) }
        assertEquals("token-1", tokens.tokenBlocking(server))
        assertTrue(deselectedTokens.isEmpty())
    }

    @Test
    fun switchKeepsTheTokenAndCancelGoesBack() = runTest {
        tokens.save(server, "token-1")
        val before = session.resolve()
        session.switch()
        assertEquals(ProfileState.NeedsPick(listOf(owner, kid), canCancel = true), session.state.value)
        assertEquals("token-1", tokens.tokenBlocking(server))
        session.cancelSwitch()
        assertEquals(before, session.state.value)
    }

    @Test
    fun onRequiredForTheActiveServerClearsItsTokenAndShowsThePicker() = runTest {
        tokens.save(server, "token-1")
        session.resolve()
        session.onRequired(server.resolve("/api/movies")!!, "token-1")
        assertNull(tokens.tokenBlocking(server))
        assertEquals(ProfileState.NeedsPick(listOf(owner, kid)), session.state.value)
    }

    @Test
    fun aStale409ForTheOldTokenAfterSelectKeepsTheNewSession() = runTest {
        tokens.save(server, "token-1")
        session.resolve()
        val selectedKid = session.select(kid.id, null)
        session.onRequired(server.resolve("/api/movies")!!, "token-1")
        assertEquals("token-2", tokens.tokenBlocking(server))
        assertEquals(selectedKid, session.state.value)
    }

    @Test
    fun onRequiredBeforeResolveClearsTheTokenButShowsNoEmptyPicker() = runTest {
        tokens.save(server, "token-1")
        session.onRequired(server, "token-1")
        assertNull(tokens.tokenBlocking(server))
        assertEquals(ProfileState.Unknown, session.state.value)
    }

    @Test
    fun onRequiredOnAServerWithoutProfilesStaysUnsupported() = runTest {
        listed = { notFound() }
        session.resolve()
        session.onRequired(server, null)
        assertEquals(ProfileState.Unsupported, session.state.value)
    }

    @Test
    fun aFailedResolveLeavesUnknownAndARetryWorks() = runTest {
        tokens.save(server, "token-1")
        val before = session.resolve()
        listed = { throw ApiException(500, "Boom") }
        try { session.resolve(); fail("expected ApiException") } catch (error: ApiException) { assertEquals(500, error.statusCode) }
        assertEquals(ProfileState.Unknown, session.state.value)
        listed = { listOf(owner, kid) }
        assertEquals(before, session.resolve())
        assertEquals(before, session.state.value)
    }

    @Test
    fun onRequiredForAnotherServerOnlyClearsThatToken() = runTest {
        tokens.save(server, "token-1")
        tokens.save(other, "token-x")
        val before = session.resolve()
        session.onRequired(other, "token-x")
        assertNull(tokens.tokenBlocking(other))
        assertEquals("token-1", tokens.tokenBlocking(server))
        assertEquals(before, session.state.value)
    }

    @Test
    fun aDifferentProfileReportsAChangeButTheSameOneDoesNot() = runTest {
        tokens.save(server, "token-1")
        session.resolve()
        assertEquals(0, changes) // the first profile ever seen is not a change
        session.resolve()
        assertEquals(0, changes)
        session.select(kid.id, null)
        assertEquals(1, changes)
    }

    @Test
    fun refreshDropsADeletedProfileToThePicker() = runTest {
        tokens.save(server, "token-2")
        me = { kid }
        session.resolve()
        listed = { listOf(owner) }
        assertEquals(ProfileState.NeedsPick(listOf(owner)), session.refreshProfiles())
        assertNull(tokens.tokenBlocking(server))
    }

    @Test
    fun aPinOnTheOnlyProfileStillAllowsSwitching() {
        assertTrue(ProfileState.Selected(locked, listOf(locked)).canSwitchProfile)
        assertFalse(ProfileState.NeedsPick(listOf(owner, kid)).canSwitchProfile)
    }

    @Test
    fun noActiveServerStaysUnknown() = runTest {
        active = null
        assertEquals(ProfileState.Unknown, session.resolve())
    }
}
