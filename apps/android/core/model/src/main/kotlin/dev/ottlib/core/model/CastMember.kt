package dev.ottlib.core.model

import kotlinx.serialization.Serializable

/** Mirrors `castMemberSchema` in packages/shared/src/index.ts. [photoUrl] is server-relative. */
@Serializable
data class CastMember(
    val name: String,
    val photoUrl: String?,
)
