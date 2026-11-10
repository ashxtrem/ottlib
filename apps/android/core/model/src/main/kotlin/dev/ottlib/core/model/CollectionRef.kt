package dev.ottlib.core.model

import kotlinx.serialization.Serializable

/** Mirrors `collectionRefSchema` in packages/shared/src/index.ts: the film collection (saga) a title belongs to. */
@Serializable
data class CollectionRef(
    val id: Long,
    val name: String,
)
