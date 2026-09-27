package dev.ottlib.tv

import android.content.Context
import dev.ottlib.core.data.ConnectionManager
import dev.ottlib.core.data.DeviceIdentity
import dev.ottlib.core.data.PlaybackPreferences
import dev.ottlib.core.data.ServerStore
import dev.ottlib.core.discovery.ServerDiscovery
import dev.ottlib.core.network.DeviceIdInterceptor
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.player.OttlibPlayerFactory
import dev.ottlib.tv.watchnext.WatchNextPublisher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/** Manual dependency wiring for the TV app (no DI framework until a second app module needs one). */
class AppContainer(context: Context) {
    /** Outlives screens: used for work that must finish after a screen closes (final progress save). */
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    val deviceIdentity = DeviceIdentity(context)
    val playbackPreferences = PlaybackPreferences(context)

    val httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(DeviceIdInterceptor { deviceIdentity.deviceIdBlocking() })
        .build()

    val api: OttlibApi = OttlibApi(httpClient) { connection.activeServer.value }
    val connection = ConnectionManager(ServerStore(context)) { api.serverInfo(it) }
    val discovery = ServerDiscovery(context)
    val playerFactory = OttlibPlayerFactory(context, httpClient)
    val watchNext = WatchNextPublisher(context)
}
