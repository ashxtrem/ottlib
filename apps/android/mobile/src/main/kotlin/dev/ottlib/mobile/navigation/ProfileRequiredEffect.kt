package dev.ottlib.mobile.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.navigation.NavHostController
import dev.ottlib.core.data.ProfileState
import dev.ottlib.core.presentation.appContainer

/**
 * Mid-session, the server refusing the profile (a `409 PROFILE_REQUIRED`, or the profile in use was deleted) makes the
 * picker the only screen. A switch the user started (canCancel) is routed by its caller; while connecting, the
 * connect screen routes on its outcome; [ProfileState.Unknown] never navigates.
 */
@Composable
fun ProfileRequiredEffect(nav: NavHostController) {
    val session = appContainer().profileSession
    LaunchedEffect(nav, session) {
        session.state.collect { state ->
            if (state !is ProfileState.NeedsPick || state.canCancel) return@collect
            val route = nav.currentDestination?.route ?: return@collect
            if (route == Routes.CONNECT) return@collect
            // Already the only screen; a picker opened by a switch still has its caller underneath, so replace it.
            if (route == Routes.PROFILES && nav.previousBackStackEntry == null) return@collect
            nav.navigate(Routes.PROFILES) { popUpTo(nav.graph.id) { inclusive = true } }
        }
    }
}
