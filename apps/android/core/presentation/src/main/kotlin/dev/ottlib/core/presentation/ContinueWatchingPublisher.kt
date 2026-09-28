package dev.ottlib.core.presentation

/** What the system shows for an in-progress title. [posterUrl] must be absolute. */
data class ContinueWatchingEntry(val movieId: Long, val title: String, val posterUrl: String?, val positionMs: Long, val durationMs: Long)

/**
 * Mirrors in-progress titles into a system surface outside the app (the Android TV "Watch Next" row). Each app
 * registers its own; apps without such a surface use [None]. Called from a background thread, best effort.
 */
interface ContinueWatchingPublisher {
    fun upsert(entry: ContinueWatchingEntry)
    fun remove(movieId: Long)

    object None : ContinueWatchingPublisher {
        override fun upsert(entry: ContinueWatchingEntry) = Unit
        override fun remove(movieId: Long) = Unit
    }
}
