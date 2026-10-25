package dev.ottlib.tv.navigation

import android.app.Activity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import dev.ottlib.core.data.ProfileState
import dev.ottlib.core.data.current
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.connect.ConnectOutcome
import dev.ottlib.core.presentation.sync.SyncOutcomeToasts
import dev.ottlib.tv.ui.components.TopDestination
import dev.ottlib.tv.ui.compare.CompareScreen
import dev.ottlib.tv.ui.connect.ConnectScreen
import dev.ottlib.tv.ui.details.DetailsScreen
import dev.ottlib.tv.ui.hidden.HiddenTitlesScreen
import dev.ottlib.tv.ui.home.HomeScreen
import dev.ottlib.tv.ui.library.LibraryScreen
import dev.ottlib.tv.ui.player.PlayerScreen
import dev.ottlib.tv.ui.profiles.ProfilesScreen
import dev.ottlib.tv.ui.search.SearchScreen
import dev.ottlib.tv.ui.settings.SettingsScreen
import kotlinx.coroutines.flow.MutableStateFlow

@Composable
fun OttlibNavHost(deepLinkMovieId: MutableStateFlow<Long?>) {
    val nav = rememberNavController()
    SyncOutcomeToasts()
    val container = appContainer()
    val activeServer by container.connection.activeServer.collectAsStateWithLifecycle()
    val pendingMovieId by deepLinkMovieId.collectAsStateWithLifecycle()

    // A movie link (Watch Next row) opens once a server is connected. On a cold start the Connect screen's own
    // "go Home and clear the back stack" runs after connecting, so the link is opened from onConnected instead.
    val openPendingMovie = {
        deepLinkMovieId.value?.let { movieId ->
            deepLinkMovieId.value = null
            nav.navigate(Routes.details(movieId))
        }
    }
    LaunchedEffect(pendingMovieId) {
        val route = nav.currentDestination?.route
        if (pendingMovieId != null && activeServer != null && route != Routes.CONNECT && route != Routes.PROFILES) openPendingMovie()
    }

    // The picker opens from Switch profile (pushed, so Back returns) or from a 409 PROFILE_REQUIRED on any request
    // (the graph is dropped). Connect routes its own outcome; Unknown (while resolving) is never a reason to move.
    val profileState by container.profileSession.state.collectAsStateWithLifecycle()
    var lastProfileId by rememberSaveable { mutableStateOf<Int?>(null) }
    LaunchedEffect(profileState) {
        profileState.current?.let { lastProfileId = it.id }
        val pick = profileState as? ProfileState.NeedsPick ?: return@LaunchedEffect
        val route = nav.currentDestination?.route
        if (route == null || route == Routes.CONNECT || route == Routes.PROFILES) return@LaunchedEffect
        if (pick.canCancel) nav.navigate(Routes.PROFILES)
        else nav.navigate(Routes.PROFILES) { popUpTo(nav.graph.id) { inclusive = true } }
    }

    val openMovie: (Long) -> Unit = { nav.navigate(Routes.details(it)) }
    val navigateTop: (TopDestination) -> Unit = { nav.navigateTop(it) }

    NavHost(nav, startDestination = Routes.CONNECT) {
        composable(Routes.CONNECT, arguments = listOf(navArgument("auto") { type = NavType.BoolType; defaultValue = true })) { entry ->
            ConnectScreen(
                autoConnect = entry.arguments?.getBoolean("auto") ?: true,
                onConnected = { outcome ->
                    if (outcome == ConnectOutcome.PickProfile) {
                        nav.navigate(Routes.PROFILES) { popUpTo(nav.graph.id) { inclusive = true } }
                    } else {
                        nav.navigate(Routes.HOME) { popUpTo(nav.graph.id) { inclusive = true } }
                        openPendingMovie()
                    }
                },
            )
        }
        composable(Routes.PROFILES) {
            val activity = LocalContext.current as? Activity
            ProfilesScreen(
                currentId = lastProfileId,
                // Every screen below the picker belonged to the previous profile: start again from Home.
                onPicked = {
                    nav.navigate(Routes.HOME) { popUpTo(nav.graph.id) { inclusive = true } }
                    openPendingMovie()
                },
                onCancelled = { if (!nav.popBackStack()) nav.navigate(Routes.HOME) { popUpTo(nav.graph.id) { inclusive = true } } },
                onExit = { activity?.finish() },
            )
        }
        composable(Routes.HOME) { HomeScreen(onOpenMovie = openMovie, onNavigate = navigateTop) }
        composable(Routes.LIBRARY) { LibraryScreen(onOpenMovie = openMovie, onNavigate = navigateTop) }
        composable(Routes.SEARCH) { SearchScreen(onOpenMovie = openMovie, onNavigate = navigateTop) }
        composable(Routes.SETTINGS) {
            SettingsScreen(
                onNavigate = navigateTop,
                onOpenHidden = { nav.navigate(Routes.HIDDEN) },
                onChangeServer = { nav.navigate(Routes.connect(autoConnect = false)) { popUpTo(nav.graph.id) { inclusive = true } } },
            )
        }
        composable(Routes.HIDDEN) { HiddenTitlesScreen(onOpenMovie = openMovie) }
        composable(Routes.COMPARE, arguments = listOf(navArgument("id") { type = NavType.LongType })) { entry ->
            CompareScreen(
                movieId = entry.arguments!!.getLong("id"),
                // The viewed copy was deleted: its details page is gone too, so continue on a surviving copy.
                onOpenOther = { id -> nav.navigate(Routes.details(id)) { popUpTo(Routes.DETAILS) { inclusive = true } } },
                onBack = { nav.popBackStack() },
            )
        }
        composable(Routes.DETAILS, arguments = listOf(navArgument("id") { type = NavType.LongType })) { entry ->
            DetailsScreen(
                movieId = entry.arguments!!.getLong("id"),
                onOpenMovie = openMovie,
                onCompare = { nav.navigate(Routes.compare(it)) },
                onPlay = { id, fromStart ->
                        if (id != entry.arguments!!.getLong("id")) {
                            nav.navigate(Routes.details(id)) { popUpTo(Routes.DETAILS) { inclusive = true } }
                        }
                        nav.navigate(Routes.player(id, fromStart))
                    },
                onBack = { if (!nav.popBackStack()) nav.navigate(Routes.HOME) },
            )
        }
        composable(
            Routes.PLAYER,
            arguments = listOf(navArgument("id") { type = NavType.LongType }, navArgument("fromStart") { type = NavType.BoolType; defaultValue = false }),
        ) { entry ->
            PlayerScreen(
                movieId = entry.arguments!!.getLong("id"),
                fromStart = entry.arguments!!.getBoolean("fromStart"),
                onExit = { nav.popBackStack() },
                    onNext = { id ->
                        nav.navigate(Routes.details(id)) { popUpTo(Routes.DETAILS) { inclusive = true } }
                        nav.navigate(Routes.player(id, false))
                    },
                    onDetails = { id -> nav.navigate(Routes.details(id)) { popUpTo(Routes.DETAILS) { inclusive = true } } },
            )
        }
    }
}

/** Top-level tabs share one back stack rooted at Home, so Back from any tab returns Home, then exits. */
private fun NavHostController.navigateTop(destination: TopDestination) {
    val route = Routes.of(destination)
    navigate(route) {
        popUpTo(Routes.HOME) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}
