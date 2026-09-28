package dev.ottlib.core.presentation

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

/** Implemented by each app's Application class, so shared screens code can reach the [AppContainer]. */
interface AppContainerOwner {
    val container: AppContainer
}

@Composable
fun appContainer(): AppContainer = (LocalContext.current.applicationContext as AppContainerOwner).container
