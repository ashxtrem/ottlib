package dev.ottlib.tv.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.sync.SyncOutcomeToasts
import dev.ottlib.tv.ui.components.TopDestination
import dev.ottlib.tv.ui.connect.ConnectScreen
import dev.ottlib.tv.ui.details.DetailsScreen
import dev.ottlib.tv.ui.home.HomeScreen
import dev.ottlib.tv.ui.library.LibraryScreen
import dev.ottlib.tv.ui.player.PlayerScreen
import dev.ottlib.tv.ui.search.SearchScreen
import dev.ottlib.tv.ui.settings.SettingsScreen
import kotlinx.coroutines.flow.MutableStateFlow

@Composable
fun OttlibNavHost(deepLinkMovieId: MutableStateFlow<Long?>) {
    val nav = rememberNavController()
    SyncOutcomeToasts()
    val activeServer by appContainer().connection.activeServer.collectAsStateWithLifecycle()
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
        if (pendingMovieId != null && activeServer != null && nav.currentDestination?.route != Routes.CONNECT) openPendingMovie()
    }

    val openMovie: (Long) -> Unit = { nav.navigate(Routes.details(it)) }
    val navigateTop: (TopDestination) -> Unit = { nav.navigateTop(it) }

    NavHost(nav, startDestination = Routes.CONNECT) {
        composable(Routes.CONNECT, arguments = listOf(navArgument("auto") { type = NavType.BoolType; defaultValue = true })) { entry ->
            ConnectScreen(
                autoConnect = entry.arguments?.getBoolean("auto") ?: true,
                onConnected = {
                    nav.navigate(Routes.HOME) { popUpTo(nav.graph.id) { inclusive = true } }
                    openPendingMovie()
                },
            )
        }
        composable(Routes.HOME) { HomeScreen(onOpenMovie = openMovie, onNavigate = navigateTop) }
        composable(Routes.LIBRARY) { LibraryScreen(onOpenMovie = openMovie, onNavigate = navigateTop) }
        composable(Routes.SEARCH) { SearchScreen(onOpenMovie = openMovie, onNavigate = navigateTop) }
        composable(Routes.SETTINGS) {
            SettingsScreen(
                onNavigate = navigateTop,
                onChangeServer = { nav.navigate(Routes.connect(autoConnect = false)) { popUpTo(nav.graph.id) { inclusive = true } } },
            )
        }
        composable(Routes.DETAILS, arguments = listOf(navArgument("id") { type = NavType.LongType })) { entry ->
            DetailsScreen(
                movieId = entry.arguments!!.getLong("id"),
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
