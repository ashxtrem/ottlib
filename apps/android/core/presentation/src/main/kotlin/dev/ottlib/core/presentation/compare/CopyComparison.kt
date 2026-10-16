package dev.ottlib.core.presentation.compare

import dev.ottlib.core.model.Movie
import dev.ottlib.core.presentation.describe
import dev.ottlib.core.presentation.formatBytes
import dev.ottlib.core.presentation.formatRuntime
import dev.ottlib.core.presentation.resolutionLabel

/** One value in the comparison; [best] marks the standout among copies (the better picture, not just a bigger file). */
data class ComparisonCell(val text: String, val best: Boolean = false)

data class ComparisonRow(val label: String, val cells: List<ComparisonCell>)

data class CopyColumn(val movieId: Long, val heading: String, val fileName: String, val filePath: String, val isCurrent: Boolean)

/** Side-by-side technical comparison of the copies of one title, mirroring the web Compare dialog. */
data class CopyComparison(val columns: List<CopyColumn>, val rows: List<ComparisonRow>)

private const val NONE = "—"

fun compareCopies(current: Movie, others: List<Movie>): CopyComparison {
    val copies = listOf(current) + others.sortedWith(compareByDescending<Movie> { it.mediaInfo?.height ?: -1 }.thenBy { it.id })
    val columns = copies.mapIndexed { index, movie ->
        CopyColumn(movie.id, if (index == 0) "This copy" else "Copy ${index + 1}", movie.rawFilename, movie.filePath, isCurrent = index == 0)
    }
    val heights = copies.map { it.mediaInfo?.height?.toLong() }
    val bitRates = copies.map { it.mediaInfo?.videoBitRate }
    val hdr = copies.map { if (it.mediaInfo?.hdrFormat != null) 1L else 0L }
    val rows = listOf(
        ComparisonRow("Resolution", copies.cells(best = standouts(heights)) { resolutionLabel(it.mediaInfo?.height) }),
        ComparisonRow("HDR", copies.cells(best = standouts(hdr)) { it.mediaInfo?.hdrFormat }),
        ComparisonRow("Video", copies.cells { listOfNotNull(it.mediaInfo?.videoCodec, it.mediaInfo?.videoProfile).joinToString(" · ").ifEmpty { null } }),
        ComparisonRow("Bitrate", copies.cells(best = standouts(bitRates)) { it.mediaInfo?.videoBitRate?.let { rate -> "${(rate / 100_000) / 10.0} Mbps" } }),
        ComparisonRow("File size", copies.cells { formatBytes(it.fileSizeBytes) }),
        ComparisonRow("Runtime", copies.cells { formatRuntime(it.runtime, it.mediaInfo?.durationMs) }),
        ComparisonRow("Audio", copies.cells { movie -> movie.mediaInfo?.tracks?.filter { it.isAudio }?.joinToString("\n") { it.describe() }?.ifEmpty { null } }),
        ComparisonRow("Subtitles", copies.cells { movie -> movie.mediaInfo?.tracks?.filter { it.isSubtitle }?.joinToString("\n") { it.describe() }?.ifEmpty { null } }),
        ComparisonRow("Watched", copies.cells { if (it.watched) "Watched" else "Unwatched" }),
    )
    return CopyComparison(columns, rows)
}

private fun List<Movie>.cells(best: Set<Int> = emptySet(), value: (Movie) -> String?): List<ComparisonCell> =
    mapIndexed { index, movie -> ComparisonCell(value(movie) ?: NONE, best = index in best) }

/** Indexes holding the highest value, but only when copies actually differ: a tie is not a standout. */
internal fun standouts(values: List<Long?>): Set<Int> {
    val known = values.filterNotNull()
    if (known.size < 2) return emptySet()
    val top = known.max()
    if (top == known.min() && known.size == values.size) return emptySet()
    return values.indices.filter { values[it] == top }.toSet()
}
