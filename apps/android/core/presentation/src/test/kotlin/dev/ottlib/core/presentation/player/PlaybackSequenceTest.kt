package dev.ottlib.core.presentation.player

import dev.ottlib.core.model.Movie
import dev.ottlib.core.network.MovieQuery
import dev.ottlib.core.network.MovieSort
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.network.OttlibJson
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PlaybackSequenceTest {
    private val server = MockWebServer().apply { start() }
    private val sequence = PlaybackSequence(OttlibApi(OkHttpClient()) { server.url("/") })
    @After fun close() = server.shutdown()

    private fun movie(id: Long, missing: Boolean = false) = Movie(
        id = id, title = "Movie $id", year = null, rawFilename = "$id.mkv", filePath = "/$id.mkv",
        titleOverride = null, overview = null, posterUrl = null, backdropUrl = null, genres = emptyList(), cast = emptyList(),
        rating = null, runtime = null, imdbId = null, metadataStatus = "matched", metadataSource = null,
        mediaType = "movie", season = null, episode = null, fileSizeBytes = 1, mediaInfo = null, watched = false,
        resumePositionMs = null, missing = missing, addedAt = "2026-01-01", shelves = emptyList(),
    )
    private fun respond(movie: Movie?) {
        server.enqueue(MockResponse().setBody(movie?.let { OttlibJson.encodeToString(Movie.serializer(), it) } ?: "null"))
    }

    @Test fun followsCapturedOrderAndSkipsUnavailableTitles() = runTest {
        sequence.select(listOf(3, 1, 2))
        respond(null); respond(movie(1, missing = true)); respond(movie(2))
        assertEquals(2L, sequence.next(movie(3))?.id)
        assertEquals("/api/movies/3/next", server.takeRequest().path)
        assertEquals("/api/movies/1", server.takeRequest().path)
        assertEquals("/api/movies/2", server.takeRequest().path)
    }

    @Test fun neverFallsBackToAnUnrelatedTitleForTheLastEpisode() = runTest {
        sequence.select(listOf(1, 2))
        respond(null)
        assertNull(sequence.next(movie(1).copy(mediaType = "tv", season = 1, episode = 10)))
        assertEquals(1, server.requestCount)
    }

    @Test fun usesShelfOrderWhenSelectedAndClearsItOnAnotherSource() = runTest {
        sequence.select(listOf(1, 2), shelf = 7)
        respond(movie(2))
        assertEquals(2L, sequence.next(movie(1))?.id)
        assertEquals("/api/movies/1/next?shelfId=7", server.takeRequest().path)
        sequence.select(emptyList())
        respond(null)
        assertNull(sequence.next(movie(1)))
        assertEquals("/api/movies/1/next", server.takeRequest().path)
        assertNull(sequence.collectionFor(1))
    }

    @Test fun fetchesBeyondTheLoadedLibraryPageWithItsOriginalFiltersAndSort() = runTest {
        sequence.select(listOf(1), source = MovieQuery(watched = false, genre = "Animation", sort = MovieSort.Added), nextCursor = "cursor")
        respond(null)
        server.enqueue(MockResponse().setBody("""{"items":[{"id":2,"title":"Movie 2","year":null,"posterUrl":null,"resolution":null,"hdrFormat":null,"watched":false,"resumePositionMs":null,"durationMs":null,"missing":false,"metadataStatus":"matched","shelves":[]}],"nextCursor":null,"total":2}"""))
        respond(movie(2))
        assertEquals(2L, sequence.next(movie(1))?.id)
        server.takeRequest()
        val page = server.takeRequest().requestUrl!!
        assertEquals("false", page.queryParameter("watched"))
        assertEquals("Animation", page.queryParameter("genre"))
        assertEquals("added", page.queryParameter("sort"))
        assertEquals("cursor", page.queryParameter("cursor"))
    }

    @Test fun identifiesEpisodeGapsWithoutWarningForNormalSeasonTransitions() {
        val current = movie(1).copy(mediaType = "tv", season = 1, episode = 9)
        assertNull(movie(2).copy(mediaType = "tv", season = 1, episode = 10).episodeGapAfter(current))
        assertNull(movie(2).copy(mediaType = "tv", season = 2, episode = 1).episodeGapAfter(current))
        assertEquals("Some episodes are unavailable. Next available: S1E11.", movie(2).copy(mediaType = "tv", season = 1, episode = 11).episodeGapAfter(current))
    }
}
