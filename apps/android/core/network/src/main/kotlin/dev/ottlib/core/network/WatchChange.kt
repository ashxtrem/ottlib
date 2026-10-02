package dev.ottlib.core.network

/** A successful server write that cached Android screens can apply immediately. */
data class WatchChange(val movieId: Long, val watched: Boolean)
