package dev.ottlib.core.presentation.update

import android.content.Context
import android.util.Log
import dev.ottlib.core.data.UpdatePreferences
import dev.ottlib.core.data.UpdateSettings
import dev.ottlib.core.update.ApkDownloader
import dev.ottlib.core.update.ApkInstaller
import dev.ottlib.core.update.AppRelease
import dev.ottlib.core.update.GitHubReleases
import dev.ottlib.core.update.InstallEvent
import dev.ottlib.core.update.InstallEvents
import dev.ottlib.core.update.isDebugSigned
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import java.io.File

/** This install: its version, and the prefix of the release APK that updates it (`ottlib-tv-`, `ottlib-mobile-`). */
data class InstalledApp(val versionCode: Int, val versionName: String, val apkPrefix: String)

sealed interface UpdateState {
    data object Idle : UpdateState
    data object Checking : UpdateState
    data object UpToDate : UpdateState
    /** This build can't update itself from GitHub (signed with the debug key). */
    data object LocalBuild : UpdateState
    data class Available(val release: AppRelease) : UpdateState
    data class Downloading(val release: AppRelease, val progress: Float?) : UpdateState
    /** Installs from OttLib aren't allowed yet; [settingsOpened] is false when the device has no page to allow them. */
    data class NeedsPermission(val release: AppRelease, val settingsOpened: Boolean) : UpdateState
    data class Installing(val release: AppRelease) : UpdateState
    data class Failed(val release: AppRelease?, val message: String) : UpdateState
}

/**
 * App-wide update flow shared by the TV and phone apps: check GitHub, then download, verify and install the release
 * APK. Lives in the AppContainer so the banner, Settings and the Connect screen all show the same state.
 */
class AppUpdates(
    context: Context,
    private val scope: CoroutineScope,
    client: OkHttpClient,
    private val installed: InstalledApp,
    private val preferences: UpdatePreferences,
) {
    private val releases = GitHubReleases(client)
    private val downloader = ApkDownloader(client)
    private val installer = ApkInstaller(context)
    private val downloads = File(context.cacheDir, "updates")
    private val localBuild = isDebugSigned(context)
    private val current = MutableStateFlow<UpdateState>(if (localBuild) UpdateState.LocalBuild else UpdateState.Idle)
    private var work: Job? = null

    val state: StateFlow<UpdateState> = current.asStateFlow()
    val settings: StateFlow<UpdateSettings> = preferences.settings.stateIn(scope, SharingStarted.Eagerly, UpdateSettings())
    val versionName: String get() = installed.versionName

    /** What the Home/Connect banner shows: an update the user hasn't put off, or one in progress. Null hides it. */
    val banner: StateFlow<UpdateState?> = combine(current, settings) { state, prefs ->
        when (state) {
            is UpdateState.Available -> state.takeIf { it.release.version.code > prefs.dismissedVersionCode }
            is UpdateState.Downloading, is UpdateState.NeedsPermission, is UpdateState.Installing -> state
            is UpdateState.Failed -> state.takeIf { it.release != null }
            else -> null
        }
    }.stateIn(scope, SharingStarted.Eagerly, null)

    init {
        scope.launch { InstallEvents.flow.collect(::onInstallEvent) }
        scope.launch {
            downloads.deleteRecursively()
            if (!localBuild && preferences.settings.first().autoCheck) check(manual = false)
        }
    }

    /** Looks for a newer release. Automatic checks fail silently (offline, rate-limited); manual ones report why. */
    fun check(manual: Boolean = true) {
        if (localBuild || work?.isActive == true) return
        work = scope.launch {
            current.value = UpdateState.Checking
            current.value = try {
                val release = releases.latest(installed.apkPrefix)
                if (release != null && release.version.code > installed.versionCode) UpdateState.Available(release) else UpdateState.UpToDate
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                Log.w(TAG, "Update check failed", error)
                if (manual) UpdateState.Failed(null, "Couldn't check for updates: ${error.message ?: "network error"}") else UpdateState.Idle
            }
        }
    }

    /** Downloads and installs the available release, first sending the user to allow installs if needed. */
    fun update() {
        val release = releaseInProgress() ?: return
        if (work?.isActive == true) return
        if (!installer.canInstall()) {
            current.value = UpdateState.NeedsPermission(release, settingsOpened = installer.openInstallPermissionSettings())
            return
        }
        work = scope.launch {
            try {
                current.value = UpdateState.Downloading(release, null)
                val apk = downloader.download(release, File(downloads, release.apkName)) { progress -> current.value = UpdateState.Downloading(release, progress) }
                current.value = UpdateState.Installing(release)
                installer.install(apk)
            } catch (error: Exception) {
                if (error is CancellationException) { current.value = UpdateState.Available(release); throw error }
                Log.w(TAG, "Update failed", error)
                current.value = UpdateState.Failed(release, error.message ?: "The update failed.")
            }
        }
    }

    /** Stops a download, or puts off this release until a newer one appears. */
    fun later() {
        val release = releaseInProgress() ?: return
        work?.cancel()
        current.value = UpdateState.Available(release)
        scope.launch { preferences.dismiss(release.version.code) }
    }

    /** Call when the app comes back to the foreground: continues once the user has allowed installs. */
    fun onResume() {
        if (current.value is UpdateState.NeedsPermission && installer.canInstall()) update()
    }

    fun setAutoCheck(enabled: Boolean) {
        scope.launch {
            preferences.setAutoCheck(enabled)
            if (enabled && current.value == UpdateState.Idle) check(manual = false)
        }
    }

    private fun onInstallEvent(event: InstallEvent) {
        val release = releaseInProgress() ?: return
        current.value = when (event) {
            InstallEvent.WaitingForUser -> UpdateState.Installing(release)
            InstallEvent.Cancelled -> UpdateState.Available(release)
            is InstallEvent.Failed -> UpdateState.Failed(release, event.message)
        }
    }

    private fun releaseInProgress(): AppRelease? = when (val state = current.value) {
        is UpdateState.Available -> state.release
        is UpdateState.Downloading -> state.release
        is UpdateState.NeedsPermission -> state.release
        is UpdateState.Installing -> state.release
        is UpdateState.Failed -> state.release
        else -> null
    }

    private companion object { const val TAG = "AppUpdates" }
}
