package dev.ottlib.tv

import android.view.KeyEvent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.staticCompositionLocalOf

/**
 * Lets a screen see remote-control keys before any view does. The player needs this because Media3's
 * PlayerView consumes D-pad keys itself (to show its controls) before normal listeners run.
 */
class KeyInterceptors {
    private val handlers = mutableListOf<(KeyEvent) -> Boolean>()

    fun add(handler: (KeyEvent) -> Boolean) { handlers += handler }
    fun remove(handler: (KeyEvent) -> Boolean) { handlers -= handler }
    fun dispatch(event: KeyEvent): Boolean = handlers.asReversed().any { it(event) }
}

val LocalKeyInterceptors = staticCompositionLocalOf { KeyInterceptors() }

/** Registers [handler] while the calling composable is on screen. Return true to consume the key. */
@Composable
fun InterceptKeys(handler: (KeyEvent) -> Boolean) {
    val interceptors = LocalKeyInterceptors.current
    val current = rememberUpdatedState(handler)
    DisposableEffect(interceptors) {
        val registered: (KeyEvent) -> Boolean = { current.value(it) }
        interceptors.add(registered)
        onDispose { interceptors.remove(registered) }
    }
}
