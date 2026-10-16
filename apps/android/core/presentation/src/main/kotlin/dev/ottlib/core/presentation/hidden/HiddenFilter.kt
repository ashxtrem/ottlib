package dev.ottlib.core.presentation.hidden

import dev.ottlib.core.presentation.PosterItem

/** Posters the viewer has not hidden on this device. */
fun List<PosterItem>.withoutHidden(hidden: Set<String>): List<PosterItem> = if (hidden.isEmpty()) this else filterNot { it.hideKey in hidden }
