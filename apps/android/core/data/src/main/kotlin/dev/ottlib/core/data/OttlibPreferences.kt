package dev.ottlib.core.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStore

/** The app's single preferences file; each store in this module owns its own keys. */
internal val Context.ottlibPreferences: DataStore<Preferences> by preferencesDataStore(name = "ottlib")
