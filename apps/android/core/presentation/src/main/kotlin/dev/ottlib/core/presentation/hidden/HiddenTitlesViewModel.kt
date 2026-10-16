package dev.ottlib.core.presentation.hidden

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.ottlib.core.data.HiddenTitleStore
import dev.ottlib.core.model.HiddenTitle
import dev.ottlib.core.network.OttlibApi
import dev.ottlib.core.presentation.PosterItem
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Hidden titles come from this device's own list, so nothing is fetched from the server. */
class HiddenTitlesViewModel(private val store: HiddenTitleStore, private val api: OttlibApi) : ViewModel() {
    val items: StateFlow<List<PosterItem>?> = store.titles
        .map { titles -> titles.asReversed().map { it.toPoster(api::resolve) } }
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    fun unhide(key: String) { viewModelScope.launch { store.unhide(key) } }

    fun unhideAll() { viewModelScope.launch { store.unhideAll() } }
}

private fun HiddenTitle.toPoster(resolve: (String?) -> String?) =
    PosterItem(id, title, year, resolve(posterUrl), if (isShow) "Show" else null, watched = false, resumePositionMs = null, durationMs = null, hideKey = key)
