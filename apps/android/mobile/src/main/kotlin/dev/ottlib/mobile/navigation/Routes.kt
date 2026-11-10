package dev.ottlib.mobile.navigation

import android.net.Uri

object Routes {
    const val CONNECT = "connect?auto={auto}"
    const val HOME = "home"
    const val LIBRARY = "library"
    const val SEARCH = "search"
    const val SETTINGS = "settings"
    const val HIDDEN = "hidden"
    const val PROFILES = "profiles"
    const val PROFILES_MANAGE = "profiles/manage"
    const val DETAILS = "details/{id}"
    const val PLAYER = "player/{id}?fromStart={fromStart}"
    /** The library for one actor or one collection; not a top-level tab, so the bar stays hidden as on Details. */
    const val FILTERED = "filtered?actor={actor}&collection={collection}&title={title}"

    fun connect(autoConnect: Boolean) = "connect?auto=$autoConnect"
    fun details(id: Long) = "details/$id"
    fun player(id: Long, fromStart: Boolean) = "player/$id?fromStart=$fromStart"
    fun actor(name: String) = "filtered?actor=${Uri.encode(name)}&title=${Uri.encode(name)}"
    fun collection(id: Long, name: String) = "filtered?collection=$id&title=${Uri.encode(name)}"
}
