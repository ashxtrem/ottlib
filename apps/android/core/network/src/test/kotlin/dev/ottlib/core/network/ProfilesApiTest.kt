package dev.ottlib.core.network

import dev.ottlib.core.model.ProfileCreateRequest
import dev.ottlib.core.model.ProfilePatch
import dev.ottlib.core.model.ProfilePinUpdate
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class ProfilesApiTest {
    private val server = MockWebServer().apply { start() }
    private val api = OttlibApi(OkHttpClient()) { server.url("/") }
    private val kids = """{"id":2,"name":"Kids","color":"#006fee","hasPin":true,"isOwner":false}"""

    @After fun tearDown() = server.shutdown()

    @Test
    fun pinUpdateEncodesANullPinAndOmitsAMissingCurrentPin() {
        val json = OttlibJson.encodeToString(ProfilePinUpdate.serializer(), ProfilePinUpdate(pin = null))
        assertEquals("""{"pin":null}""", json)
        assertFalse(json.contains("currentPin"))
        assertEquals("""{"currentPin":"1234","pin":"5678"}""", OttlibJson.encodeToString(ProfilePinUpdate.serializer(), ProfilePinUpdate("1234", "5678")))
    }

    @Test
    fun listsProfiles() = runTest {
        server.enqueue(MockResponse().setBody("[$kids]"))
        val list = api.profiles()
        val request = server.takeRequest()
        assertEquals("GET", request.method)
        assertEquals("/api/profiles", request.path)
        assertEquals("Kids", list.single().name)
    }

    @Test
    fun selectsAProfileWithOrWithoutAPin() = runTest {
        val result = """{"token":"t","profile":$kids}"""
        server.enqueue(MockResponse().setBody(result))
        server.enqueue(MockResponse().setBody(result))
        assertEquals("t", api.selectProfile(2, "1234").token)
        val withPin = server.takeRequest()
        assertEquals("POST", withPin.method)
        assertEquals("/api/profiles/2/select", withPin.path)
        assertEquals("""{"pin":"1234"}""", withPin.body.readUtf8())
        api.selectProfile(2)
        assertEquals("{}", server.takeRequest().body.readUtf8())
    }

    @Test
    fun aWrongPinCarriesItsErrorCode() = runTest {
        server.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":"PROFILE_PIN_INVALID","message":"Wrong PIN."}"""))
        try {
            api.selectProfile(2, "0000")
            fail("expected ApiException")
        } catch (e: ApiException) {
            assertEquals(403, e.statusCode)
            assertEquals("PROFILE_PIN_INVALID", e.errorCode)
            assertEquals("Wrong PIN.", e.message)
        }
    }

    @Test
    fun deselectsWithAnEmptyPost() = runTest {
        server.enqueue(MockResponse().setResponseCode(204))
        api.deselectProfile()
        val request = server.takeRequest()
        assertEquals("POST", request.method)
        assertEquals("/api/profiles/deselect", request.path)
        assertEquals(0L, request.bodySize)
    }

    @Test
    fun readsTheCurrentProfile() = runTest {
        server.enqueue(MockResponse().setBody("""{"profile":$kids}"""))
        assertEquals(2, api.profileMe().profile.id)
        assertEquals("/api/profiles/me", server.takeRequest().path)
    }

    @Test
    fun createsUpdatesAndSetsPins() = runTest {
        server.enqueue(MockResponse().setResponseCode(201).setBody(kids))
        server.enqueue(MockResponse().setBody(kids))
        server.enqueue(MockResponse().setBody(kids))
        api.createProfile(ProfileCreateRequest("Kids", "#006fee"))
        val create = server.takeRequest()
        assertEquals("POST", create.method)
        assertEquals("/api/profiles", create.path)
        assertEquals("""{"name":"Kids","color":"#006fee"}""", create.body.readUtf8())
        api.updateProfile(2, ProfilePatch(name = "Kiddos"))
        val patch = server.takeRequest()
        assertEquals("PATCH", patch.method)
        assertEquals("/api/profiles/2", patch.path)
        assertEquals("""{"name":"Kiddos"}""", patch.body.readUtf8())
        api.setProfilePin(2, ProfilePinUpdate(pin = null))
        val pin = server.takeRequest()
        assertEquals("PUT", pin.method)
        assertEquals("/api/profiles/2/pin", pin.path)
        assertEquals("""{"pin":null}""", pin.body.readUtf8())
    }

    @Test
    fun deletesAProfile() = runTest {
        server.enqueue(MockResponse().setResponseCode(204))
        api.deleteProfile(2)
        val request = server.takeRequest()
        assertEquals("DELETE", request.method)
        assertEquals("/api/profiles/2", request.path)
    }

    @Test
    fun apiExceptionCodeIsNullForAPlainMessage() = runTest {
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"Wrong PIN"}"""))
        server.enqueue(MockResponse().setResponseCode(500).setBody("oops"))
        server.enqueue(MockResponse().setResponseCode(503).setBody("""{"error":"TRANSCODE_BUSY","message":"All slots busy"}"""))
        val plain = runCatching { api.profiles() }.exceptionOrNull() as ApiException
        assertNull(plain.errorCode)
        assertEquals("Wrong PIN", plain.message)
        val junk = runCatching { api.profiles() }.exceptionOrNull() as ApiException
        assertNull(junk.errorCode)
        assertEquals("Server returned HTTP 500", junk.message)
        val coded = runCatching { api.profiles() }.exceptionOrNull() as ApiException
        assertEquals("TRANSCODE_BUSY", coded.errorCode)
        assertTrue(coded.message == "All slots busy")
    }
}
