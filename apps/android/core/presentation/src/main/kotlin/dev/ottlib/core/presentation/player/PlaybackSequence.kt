package dev.ottlib.core.presentation.player

import dev.ottlib.core.model.Movie
import dev.ottlib.core.network.MovieQuery
import dev.ottlib.core.network.OttlibApi
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** The source list is captured on selection, so refreshes cannot change its playback order. */
class PlaybackSequence(private val api: OttlibApi) {
    private val loading = Mutex()
    private var ids: List<Long> = emptyList()
    private var query: MovieQuery? = null
    private var cursor: String? = null
    var shelfId: Long? = null
        private set

    fun select(items: List<Long>, shelf: Long? = null, source: MovieQuery? = null, nextCursor: String? = null) {
        ids = items.toList()
        shelfId = shelf
        query = source
        cursor = nextCursor
    }

    suspend fun next(current: Movie): Movie? = loading.withLock {
        val inSequence = current.id in ids
        val related = api.nextMovie(current.id, if (inSequence) shelfId else null)
        if (related != null || current.mediaType == "tv") return@withLock related
        if (!inSequence) return@withLock null
        var index = ids.indexOf(current.id) + 1
        while (true) {
            while (index < ids.size) {
                val movie = api.movie(ids[index++])
                if (!movie.missing) return@withLock movie
            }
            val source = query ?: return@withLock null
            val nextCursor = cursor ?: return@withLock null
            val page = api.movies(source.copy(cursor = nextCursor))
            ids = ids + page.items.map { it.id }
            cursor = page.nextCursor
        }
        @Suppress("UNREACHABLE_CODE")
        null
    }

    fun collectionFor(id: Long): Long? = shelfId.takeIf { id in ids }
}
