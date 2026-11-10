package dev.ottlib.mobile.ui.library

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import dev.ottlib.core.presentation.library.LibraryPreset

/**
 * The library narrowed to one actor or one collection, pushed from Details. The usual filter chips still work on top;
 * the preset keeps the actor or collection through every change. Titled with [title], with a back arrow.
 */
@Composable
fun FilteredLibraryScreen(actor: String?, collectionId: Long?, title: String, onOpenMovie: (Long) -> Unit, onBack: () -> Unit) {
    val preset = remember(actor, collectionId) { LibraryPreset(actor = actor, collectionId = collectionId) }
    LibraryScreen(onOpenMovie = onOpenMovie, preset = preset, title = title, onBack = onBack)
}
