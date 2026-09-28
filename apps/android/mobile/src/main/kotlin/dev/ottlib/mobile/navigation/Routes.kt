package dev.ottlib.mobile.navigation

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
}
