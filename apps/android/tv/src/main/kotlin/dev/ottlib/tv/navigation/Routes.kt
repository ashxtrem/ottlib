package dev.ottlib.tv.navigation

import dev.ottlib.tv.ui.components.TopDestination

object Routes {
    const val CONNECT = "connect?auto={auto}"
    const val HOME = "home"
    const val LIBRARY = "library"
    const val SEARCH = "search"
    const val SETTINGS = "settings"
    const val DETAILS = "details/{id}"
    const val PLAYER = "player/{id}?fromStart={fromStart}"

    fun connect(autoConnect: Boolean) = "connect?auto=$autoConnect"
    fun details(id: Long) = "details/$id"
    fun player(id: Long, fromStart: Boolean) = "player/$id?fromStart=$fromStart"

    fun of(destination: TopDestination) = when (destination) {
        TopDestination.Home -> HOME
        TopDestination.Library -> LIBRARY
        TopDestination.Search -> SEARCH
        TopDestination.Settings -> SETTINGS
    }
}
