package dev.ottlib.mobile

import android.app.Application
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.crossfade
import dev.ottlib.core.presentation.AppContainer
import dev.ottlib.core.presentation.AppContainerOwner
import dev.ottlib.core.presentation.ContinueWatchingPublisher

class OttlibApplication : Application(), AppContainerOwner, SingletonImageLoader.Factory {
    override lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        // Phones have no launcher row for in-progress titles; Continue watching lives on the Home screen.
        container = AppContainer(this, continueWatching = ContinueWatchingPublisher.None)
    }

    /** Posters and backdrops are served by the Ottlib server over the same client (and device header). */
    override fun newImageLoader(context: PlatformContext): ImageLoader = ImageLoader.Builder(context)
        .components { add(OkHttpNetworkFetcherFactory(callFactory = { container.httpClient })) }
        .crossfade(true)
        .build()
}
