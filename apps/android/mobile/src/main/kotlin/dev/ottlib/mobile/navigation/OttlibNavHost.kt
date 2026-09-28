package dev.ottlib.mobile.navigation

import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfo
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffold
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffoldDefaults
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteType
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import dev.ottlib.mobile.ui.connect.ConnectScreen
import dev.ottlib.mobile.ui.details.DetailsScreen
import dev.ottlib.mobile.ui.home.HomeScreen
import dev.ottlib.mobile.ui.library.LibraryScreen
import dev.ottlib.mobile.ui.player.PlayerScreen
import dev.ottlib.mobile.ui.search.SearchScreen
import dev.ottlib.mobile.ui.settings.SettingsScreen

@Composable
fun OttlibNavHost() {
    val nav = rememberNavController()
    val entry by nav.currentBackStackEntryAsState()
    val current = TopLevel.entries.firstOrNull { it.route == entry?.destination?.route }
    // Follows the window, not the device: a bottom bar on the Fold's cover screen, a rail when unfolded.
    val layoutType = if (current == null) NavigationSuiteType.None else NavigationSuiteScaffoldDefaults.calculateFromAdaptiveInfo(currentWindowAdaptiveInfo())
    val openMovie: (Long) -> Unit = { nav.navigate(Routes.details(it)) }

    NavigationSuiteScaffold(
        layoutType = layoutType,
        navigationSuiteItems = {
            TopLevel.entries.forEach { destination ->
                item(
                    selected = destination == current,
                    onClick = { if (destination != current) nav.navigateTop(destination) },
                    icon = { Icon(destination.icon, contentDescription = null) },
                    label = { Text(destination.label) },
                )
            }
        },
    ) {
        NavHost(nav, startDestination = Routes.CONNECT) {
            composable(Routes.CONNECT, arguments = listOf(navArgument("auto") { type = NavType.BoolType; defaultValue = true })) { backStackEntry ->
                ConnectScreen(
                    autoConnect = backStackEntry.arguments?.getBoolean("auto") ?: true,
                    onConnected = { nav.navigate(Routes.HOME) { popUpTo(nav.graph.id) { inclusive = true } } },
                )
            }
            composable(Routes.HOME) { HomeScreen(onOpenMovie = openMovie) }
            composable(Routes.LIBRARY) { LibraryScreen(onOpenMovie = openMovie) }
            composable(Routes.SEARCH) { SearchScreen(onOpenMovie = openMovie) }
            composable(Routes.SETTINGS) {
                SettingsScreen(onChangeServer = { nav.navigate(Routes.connect(autoConnect = false)) { popUpTo(nav.graph.id) { inclusive = true } } })
            }
            composable(Routes.DETAILS, arguments = listOf(navArgument("id") { type = NavType.LongType })) { backStackEntry ->
                DetailsScreen(
                    movieId = backStackEntry.arguments!!.getLong("id"),
                    onPlay = { id, fromStart -> nav.navigate(Routes.player(id, fromStart)) },
                    onBack = { if (!nav.popBackStack()) nav.navigate(Routes.HOME) },
                )
            }
            composable(
                Routes.PLAYER,
                arguments = listOf(navArgument("id") { type = NavType.LongType }, navArgument("fromStart") { type = NavType.BoolType; defaultValue = false }),
            ) { backStackEntry ->
                PlayerScreen(
                    movieId = backStackEntry.arguments!!.getLong("id"),
                    fromStart = backStackEntry.arguments!!.getBoolean("fromStart"),
                    onExit = { nav.popBackStack() },
                )
            }
        }
    }
}

/** Top-level tabs share one back stack rooted at Home, so Back from any tab returns Home, then exits. */
private fun NavHostController.navigateTop(destination: TopLevel) {
    navigate(destination.route) {
        popUpTo(Routes.HOME) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}
