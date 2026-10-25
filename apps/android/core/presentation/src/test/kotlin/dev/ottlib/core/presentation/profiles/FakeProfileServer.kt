package dev.ottlib.core.presentation.profiles

import dev.ottlib.core.data.ProfileAccess
import dev.ottlib.core.data.ProfileSession
import dev.ottlib.core.data.ProfileSessionStore
import dev.ottlib.core.data.ProfileTokens
import dev.ottlib.core.model.PROFILE_PIN_INVALID
import dev.ottlib.core.model.ProfileMe
import dev.ottlib.core.model.ProfileSelectResult
import dev.ottlib.core.model.ProfileSummary
import dev.ottlib.core.network.ApiException
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl

val owner = ProfileSummary(1, "Home", "#e50914", hasPin = false, isOwner = true)
val kid = ProfileSummary(2, "Kid", "#f5a524", hasPin = false, isOwner = false)
val locked = ProfileSummary(3, "Locked", "#17c964", hasPin = true, isOwner = false)

/** An in-memory server for [ProfileSession]: PIN "1234" opens [locked], "9999" is locked out (429). */
class FakeProfileServer(var profiles: List<ProfileSummary> = listOf(owner, kid, locked), var me: ProfileSummary? = null) {
    val server: HttpUrl = "http://192.168.0.2:8081/".toHttpUrl()
    var listCalls = 0
    val selected = mutableListOf<Pair<Int, String?>>()

    private val tokens = object : ProfileTokens {
        val saved = mutableMapOf<String, String>()
        var last: String? = null
        override fun tokenBlocking(server: HttpUrl) = saved[ProfileSessionStore.origin(server)]
        override suspend fun save(server: HttpUrl, token: String) { saved[ProfileSessionStore.origin(server)] = token }
        override suspend fun clear(server: HttpUrl) { saved.remove(ProfileSessionStore.origin(server)) }
        override suspend fun lastProfile() = last
        override suspend fun saveLastProfile(key: String) { last = key }
    }

    val session = ProfileSession(
        tokens,
        ProfileAccess(
            profiles = { listCalls++; profiles },
            select = { id, pin ->
                val profile = profiles.first { it.id == id }
                if (profile.hasPin && pin == "9999") throw ApiException(429, "Too many wrong PINs. Try again in 30 seconds.")
                if (profile.hasPin && pin != "1234") throw ApiException(403, "Wrong PIN.", PROFILE_PIN_INVALID)
                selected += id to pin
                me = profile
                ProfileSelectResult("token-$id", profile)
            },
            deselect = {},
            me = { ProfileMe(me ?: throw ApiException(409, "Pick a profile", "PROFILE_REQUIRED")) },
        ),
        { server },
        {},
    )
}
