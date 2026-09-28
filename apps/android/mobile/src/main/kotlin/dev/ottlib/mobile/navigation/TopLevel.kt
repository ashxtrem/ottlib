package dev.ottlib.mobile.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.ui.graphics.vector.ImageVector

/** Destinations in the bottom bar (compact windows) or navigation rail (wider windows, e.g. the Fold's inner screen). */
enum class TopLevel(val route: String, val label: String, val icon: ImageVector) {
    Home(Routes.HOME, "Home", Icons.Filled.Home),
    Library(Routes.LIBRARY, "Library", Icons.Filled.VideoLibrary),
    Search(Routes.SEARCH, "Search", Icons.Filled.Search),
    Settings(Routes.SETTINGS, "Settings", Icons.Filled.Settings),
}
