package dev.ottlib.tv

import android.app.Application
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.allowRgb565
import coil3.request.crossfade

class OttlibApplication : Application(), SingletonImageLoader.Factory {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }

    /** Posters and backdrops are served by the Ottlib server over the same client (and device header). */
    override fun newImageLoader(context: PlatformContext): ImageLoader = ImageLoader.Builder(context)
        .components { add(OkHttpNetworkFetcherFactory(callFactory = { container.httpClient })) }
        .crossfade(true)
        // Posters are opaque JPEGs: 16-bit bitmaps halve decode memory and upload time on low-end TV chips.
        .allowRgb565(true)
        .build()
}

@Composable
fun appContainer(): AppContainer = (LocalContext.current.applicationContext as OttlibApplication).container
