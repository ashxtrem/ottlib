package dev.ottlib.tv

import android.content.Intent
import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.tv.navigation.OttlibNavHost
import dev.ottlib.tv.ui.theme.OttlibTheme
import kotlinx.coroutines.flow.MutableStateFlow

class MainActivity : ComponentActivity() {
    private val keyInterceptors = KeyInterceptors()

    /** A movie to open once connected, from an `ottlib://movie/{id}` link (the Watch Next row). */
    private val deepLinkMovieId = MutableStateFlow<Long?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        deepLinkMovieId.value = movieIdFrom(intent)
        setContent {
            OttlibTheme {
                CompositionLocalProvider(LocalKeyInterceptors provides keyInterceptors) {
                    Box(Modifier.fillMaxSize().background(OttlibColors.Canvas)) {
                        OttlibNavHost(deepLinkMovieId = deepLinkMovieId)
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        movieIdFrom(intent)?.let { deepLinkMovieId.value = it }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean = keyInterceptors.dispatch(event) || super.dispatchKeyEvent(event)

    private fun movieIdFrom(intent: Intent?): Long? =
        intent?.data?.takeIf { it.scheme == "ottlib" && it.host == "movie" }?.lastPathSegment?.toLongOrNull()
}
