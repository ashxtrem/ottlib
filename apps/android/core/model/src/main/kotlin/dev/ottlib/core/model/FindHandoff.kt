package dev.ottlib.core.model

import kotlinx.serialization.Serializable

/**
 * Body of `POST /api/find/handoff` (`findHandoffRequestSchema` in packages/shared/src/find.ts). Every field is optional and the
 * server rejects an explicit `null`, so these default to null and are left out of the JSON (OttlibJson does not encode defaults).
 */
@Serializable
data class FindHandoffRequest(
    val title: String? = null,
    val year: Int? = null,
    val imdbId: String? = null,
)

/** Mirrors `findHandoffResultSchema`: the app the server opened on its PC. */
@Serializable
data class FindHandoffResult(val app: String)
