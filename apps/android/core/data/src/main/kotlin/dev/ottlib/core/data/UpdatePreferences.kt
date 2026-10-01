package dev.ottlib.core.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * App update preferences. [autoCheck] asks GitHub for a newer release on launch (it shares the device's IP address with
 * GitHub, so it can be turned off); [dismissedVersionCode] is the release the user chose "Later" for.
 */
data class UpdateSettings(val autoCheck: Boolean = true, val dismissedVersionCode: Int = 0)

class UpdatePreferences(private val context: Context) {
    private val autoCheckKey = booleanPreferencesKey("update_auto_check")
    private val dismissedKey = intPreferencesKey("update_dismissed_version_code")

    val settings: Flow<UpdateSettings> = context.ottlibPreferences.data.map {
        UpdateSettings(autoCheck = it[autoCheckKey] ?: true, dismissedVersionCode = it[dismissedKey] ?: 0)
    }

    suspend fun setAutoCheck(enabled: Boolean) { context.ottlibPreferences.edit { it[autoCheckKey] = enabled } }
    suspend fun dismiss(versionCode: Int) { context.ottlibPreferences.edit { it[dismissedKey] = versionCode } }
}
