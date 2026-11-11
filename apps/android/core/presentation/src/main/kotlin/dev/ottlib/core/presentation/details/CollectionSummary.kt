package dev.ottlib.core.presentation.details

import dev.ottlib.core.model.MovieCollection
import dev.ottlib.core.presentation.PosterItem
import dev.ottlib.core.presentation.toPosterItem

/** The saga a title belongs to: the other titles the library owns, and how many parts it lacks. */
data class CollectionSummary(val id: Long, val name: String, val owned: List<PosterItem>, val missingCount: Int, val missing: List<MissingPart>)

/** A part of the saga the library lacks; [posterUrl] is already resolved against the active server. */
data class MissingPart(val title: String, val year: Int?, val posterUrl: String?)

/** [owned] leaves out [currentId], the title the details screen is open on. */
fun MovieCollection.toSummary(currentId: Long, resolve: (String?) -> String?) =
    CollectionSummary(
        id,
        name,
        owned.filter { it.id != currentId }.map { it.toPosterItem(resolve) },
        missing.size,
        missing.map { MissingPart(it.title, it.year, resolve(it.posterUrl)) },
    )
