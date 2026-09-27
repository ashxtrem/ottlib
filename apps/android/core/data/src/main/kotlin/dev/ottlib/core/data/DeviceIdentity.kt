package dev.ottlib.core.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import java.util.UUID

/**
 * A random id generated once per install, sent as `x-device-id` so the server keeps this TV's watched
 * state and resume positions separate from other devices (same model as the web client's localStorage id).
 */
class DeviceIdentity(private val context: Context) {
    private val key = stringPreferencesKey("device_id")
    @Volatile private var cached: String? = null

    suspend fun deviceId(): String = cached ?: run {
        var id: String? = null
        context.ottlibPreferences.edit { preferences ->
            id = preferences[key] ?: UUID.randomUUID().toString().also { preferences[key] = it }
        }
        id!!.also { cached = it }
    }

    /** For OkHttp interceptors, which run on background threads; only blocks on the very first request. */
    fun deviceIdBlocking(): String = cached ?: runBlocking { deviceId() }

    suspend fun peek(): String? = cached ?: context.ottlibPreferences.data.first()[key]
}
