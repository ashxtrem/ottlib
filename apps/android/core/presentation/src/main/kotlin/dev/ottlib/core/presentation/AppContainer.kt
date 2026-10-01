package dev.ottlib.core.presentation

import android.content.Context
import dev.ottlib.core.data.AuthTokenStore
import dev.ottlib.core.data.ConnectionManager
import dev.ottlib.core.data.DeviceIdentity
import dev.ottlib.core.data.PictureModeStore
import dev.ottlib.core.data.PlaybackPreferences
import dev.ottlib.core.data.ServerAccess
import dev.ottlib.core.data.ServerStore
import dev.ottlib.core.data.TrackChoiceStore
import dev.ottlib.core.discovery.ServerDiscovery
import dev.ottlib.core.network.AuthTokenInterceptor
import dev.ottlib.core.network.DeviceIdInterceptor
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.player.OttlibPlayerFactory
import dev.ottlib.core.presentation.sync.LibrarySync
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/**
 * Manual dependency wiring shared by the TV and phone apps. Each app supplies what differs between form factors
 * (today only [continueWatching]).
 */
class AppContainer(context: Context, val continueWatching: ContinueWatchingPublisher) {
    /** Outlives screens: used for work that must finish after a screen closes (final progress save). */
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    val deviceIdentity = DeviceIdentity(context)
    val playbackPreferences = PlaybackPreferences(context)
    val pictureModes = PictureModeStore(context)
    val trackChoices = TrackChoiceStore(context)
    val authTokens = AuthTokenStore(context)

    val httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(DeviceIdInterceptor { deviceIdentity.deviceIdBlocking() })
        .addInterceptor(AuthTokenInterceptor { authTokens.tokenBlocking(it) })
        .build()

    val api: OttlibApi = OttlibApi(httpClient) { connection.activeServer.value }
    val connection = ConnectionManager(ServerStore(context), authTokens, ServerAccess(api::serverInfo, api::authStatus, api::login))
    val discovery = ServerDiscovery(context)
    val playerFactory = OttlibPlayerFactory(context, httpClient)
    val librarySync = LibrarySync(appScope, api::startScan, api::scanStatus)
}
