package dev.ottlib.core.model

import kotlinx.serialization.Serializable

/** What this device remembers about a title the viewer hid, so the hidden list needs no server round trip. */
@Serializable
data class HiddenTitle(
    val key: String,
    val id: Long,
    val title: String,
    val year: Int?,
    val posterUrl: String?,
    val isShow: Boolean,
)

/** What "hide" means for a title: a whole TV show (every episode shares [showKey]) or a single movie. Mirrors `hideKeyOf` in packages/shared. */
fun hideKeyOf(id: Long, showKey: String?): String = showKey ?: "m:$id"

private val episodeSuffix = Regex("""\s·\sS\d+E\d+""")

/** TV rows are titled "Show · S1E2 · Episode"; hiding applies to the show, so display just its name. */
fun hiddenDisplayTitle(title: String, showKey: String?): String {
    if (showKey == null) return title
    val match = episodeSuffix.find(title) ?: return title
    return title.substring(0, match.range.first)
}

fun Movie.hideKey(): String = hideKeyOf(id, showKey)

fun MovieListItem.hideKey(): String = hideKeyOf(id, showKey)

fun Movie.toHiddenTitle() = HiddenTitle(hideKey(), id, hiddenDisplayTitle(title, showKey), year, posterUrl, showKey != null)
