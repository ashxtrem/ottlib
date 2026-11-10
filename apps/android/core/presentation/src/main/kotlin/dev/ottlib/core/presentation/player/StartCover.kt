package dev.ottlib.core.presentation.player

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/** What the player shows until its first frame: the title over [imageUrl] (the resume frame, else the backdrop; null for none). */
data class StartCover(val title: String, val imageUrl: String?)

/** The start cover and whether the current media item has rendered a frame yet. UI-neutral, so both apps draw it their own way. */
class StartCoverTracker {
    private val cover = MutableStateFlow<StartCover?>(null)
    val startCover: StateFlow<StartCover?> = cover.asStateFlow()
    private val shown = MutableStateFlow(false)
    val firstFrameShown: StateFlow<Boolean> = shown.asStateFlow()

    /** A new media item is about to play (a start, or the swap to the server's stream): its first frame isn't up yet. */
    fun newItem() {
        shown.value = false
    }

    /** Details arrived: the title over its backdrop. */
    fun detailsLoaded(title: String, backdropUrl: String?) {
        cover.value = StartCover(title, backdropUrl)
    }

    /** Playback resumes at [positionMs]: above 0, the frame there (from [frameUrl]) replaces the backdrop when the source has frames. */
    fun resumeAt(positionMs: Long, frameUrl: (Long) -> String?) {
        if (positionMs <= 0) return
        val url = frameUrl(positionMs) ?: return
        cover.update { it?.copy(imageUrl = url) }
    }

    fun frameRendered() {
        shown.value = true
    }
}
