package dev.ottlib.core.model

import kotlinx.serialization.Serializable

/** Mirrors `authStatusSchema` in packages/shared/src/auth.ts. */
@Serializable
data class AuthStatus(val pinEnabled: Boolean, val authenticated: Boolean)

/** Body of `POST /api/auth/login`. */
@Serializable
data class PinLoginRequest(val pin: String)

/** Mirrors `pinLoginResultSchema`: the session token to send as `Authorization: Bearer …`. */
@Serializable
data class PinLoginResult(val token: String)
