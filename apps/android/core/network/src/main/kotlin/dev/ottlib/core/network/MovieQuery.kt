package dev.ottlib.core.network

import okhttp3.HttpUrl

enum class MovieSort(val value: String) { Title("title"), Added("added"), Year("year"), Quality("quality") }

/** Query parameters of `GET /api/movies`, kept 1:1 with the web client's filters. */
data class MovieQuery(
    val search: String? = null,
    val watched: Boolean? = null,
    val genre: String? = null,
    val quality: String? = null,
    val mediaType: String? = null,
    val sort: MovieSort = MovieSort.Title,
    val availableOnly: Boolean = true,
    val limit: Int = 48,
    val cursor: String? = null,
) {
    internal fun applyTo(builder: HttpUrl.Builder): HttpUrl.Builder = builder.apply {
        search?.takeIf { it.isNotBlank() }?.let { addQueryParameter("search", it.trim()) }
        watched?.let { addQueryParameter("watched", it.toString()) }
        genre?.let { addQueryParameter("genre", it) }
        quality?.let { addQueryParameter("quality", it) }
        mediaType?.let { addQueryParameter("mediaType", it) }
        if (availableOnly) addQueryParameter("availability", "available")
        addQueryParameter("sort", sort.value)
        addQueryParameter("limit", limit.toString())
        cursor?.let { addQueryParameter("cursor", it) }
    }
}
