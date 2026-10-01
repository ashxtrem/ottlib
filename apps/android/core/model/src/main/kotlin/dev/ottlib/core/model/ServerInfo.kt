package dev.ottlib.core.model

import kotlinx.serialization.Serializable

/** The server API version this client was written against (`apiVersion` in packages/shared/src/playback.ts). */
const val SUPPORTED_API_VERSION = 1

/** Mirrors `serverInfoSchema` in packages/shared/src/playback.ts. */
@Serializable
data class ServerInfo(
    val name: String,
    val version: String,
    val apiVersion: Int,
    val port: Int,
    val addresses: List<String>,
    /** True when the server has an access PIN: sign in (`POST /api/auth/login`) before calling anything else. */
    val authRequired: Boolean = false,
)
