package dev.ottlib.core.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.first

/** Persists the last server the user connected to so the app can reconnect silently on launch. */
class ServerStore(private val context: Context) {
    private val key = stringPreferencesKey("server_url")

    suspend fun savedServerUrl(): String? = context.ottlibPreferences.data.first()[key]

    suspend fun save(url: String) { context.ottlibPreferences.edit { it[key] = url } }

    suspend fun clear() { context.ottlibPreferences.edit { it.remove(key) } }
}
