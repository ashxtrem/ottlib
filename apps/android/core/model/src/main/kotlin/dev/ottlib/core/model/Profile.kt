package dev.ottlib.core.model

import kotlinx.serialization.Serializable

/** Header a client sends its profile session token in; mirrors `PROFILE_SESSION_HEADER` in packages/shared/src/profiles.ts. */
const val PROFILE_SESSION_HEADER = "x-profile-session"

/** 409 `error` code: the request needs a profile session. */
const val PROFILE_REQUIRED = "PROFILE_REQUIRED"

/** 403 `error` code: the profile PIN was wrong. */
const val PROFILE_PIN_INVALID = "PROFILE_PIN_INVALID"

/** Mirrors `MAX_PROFILES`. */
const val MAX_PROFILES = 6

/** Avatar colors a profile can pick, in the order of `profileColors` (the first belongs to the owner profile). */
val PROFILE_COLORS: List<String> = listOf("#e50914", "#f5a524", "#17c964", "#006fee", "#7828c8", "#f31260")

/** Mirrors `profileSummarySchema`. */
@Serializable
data class ProfileSummary(val id: Int, val name: String, val color: String, val hasPin: Boolean, val isOwner: Boolean)

/** Body of `POST /api/profiles/:id/select`; the PIN is only needed when the profile has one. */
@Serializable
data class ProfileSelectRequest(val pin: String? = null)

/** Mirrors `profileSelectResultSchema`: the profile session token to send in [PROFILE_SESSION_HEADER]. */
@Serializable
data class ProfileSelectResult(val token: String, val profile: ProfileSummary)

/** Mirrors `profileMeSchema`. */
@Serializable
data class ProfileMe(val profile: ProfileSummary)

/** Body of `POST /api/profiles`. */
@Serializable
data class ProfileCreateRequest(val name: String, val color: String, val pin: String? = null)

/** Body of `PATCH /api/profiles/:id`. */
@Serializable
data class ProfilePatch(val name: String? = null, val color: String? = null)

/**
 * Body of `PUT /api/profiles/:id/pin`. `pin` has no default on purpose: the schema requires the key, and `null` clears
 * the PIN, so it is always encoded (as `"pin":null`). `currentPin` is omitted when null.
 */
@Serializable
data class ProfilePinUpdate(val currentPin: String? = null, val pin: String?)

/** The server's `{ error, message? }` body; `error` is a code such as [PROFILE_REQUIRED] or plain text. */
@Serializable
data class ApiError(val error: String, val message: String? = null)
