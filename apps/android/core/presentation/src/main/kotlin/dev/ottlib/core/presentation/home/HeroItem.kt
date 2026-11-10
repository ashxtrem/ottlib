package dev.ottlib.core.presentation.home

import dev.ottlib.core.model.Movie
import dev.ottlib.core.presentation.PosterItem
import dev.ottlib.core.presentation.formatPosition

/**
 * The title featured at the top of Home. [backdropUrl], [logoUrl] and [overview] come from the full movie and are
 * null until it has loaded (or when the title has none); URLs are absolute. [resumeLabel] is set for a Continue
 * watching title: "Resume at 42:10", or the row's "Up next" / "Next episode" when nothing was started.
 */
data class HeroItem(
    val item: PosterItem,
    val backdropUrl: String?,
    val logoUrl: String?,
    val overview: String?,
    val resumeLabel: String?,
)

internal fun heroOf(item: PosterItem, fromContinue: Boolean, movie: Movie?, resolve: (String?) -> String?): HeroItem {
    val detail = movie?.takeIf { it.id == item.id }
    return HeroItem(
        item = item,
        backdropUrl = resolve(detail?.backdropUrl),
        logoUrl = resolve(detail?.logoUrl),
        overview = detail?.overview?.takeIf { it.isNotBlank() },
        resumeLabel = if (fromContinue) resumeLabelOf(item) else null,
    )
}

private fun resumeLabelOf(item: PosterItem): String? = when {
    item.resumePositionMs != null && item.resumePositionMs > 0 -> "Resume at ${formatPosition(item.resumePositionMs)}"
    item.badge == "Up next" || item.badge == "Next episode" -> item.badge
    else -> null
}
