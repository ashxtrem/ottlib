package dev.ottlib.core.presentation.library

/** A library grid opened for one actor or one collection: [LibraryViewModel] keeps these filters through every filter change. */
data class LibraryPreset(val actor: String? = null, val collectionId: Long? = null) {
    /** [filters] with the preset's actor and collection put back where they were dropped. */
    fun applyTo(filters: LibraryFilters): LibraryFilters =
        filters.copy(actor = filters.actor ?: actor, collectionId = filters.collectionId ?: collectionId)
}
