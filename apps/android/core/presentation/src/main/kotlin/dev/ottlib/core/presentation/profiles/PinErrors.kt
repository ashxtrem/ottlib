package dev.ottlib.core.presentation.profiles

import dev.ottlib.core.model.PROFILE_PIN_INVALID
import dev.ottlib.core.network.ApiException

/** A profile PIN is 4 to 8 digits (`profilePinSchema`). */
fun isCompletePin(pin: String): Boolean = pin.length in 4..8 && pin.all { it in '0'..'9' }

/** Text shown under a PIN field after a failed pick or PIN change; mirrors the web's `pinErrorMessage`. */
fun pinErrorMessage(error: Throwable): String {
    if (error is ApiException) {
        // Only the PIN code: another 403 ("Only the owner profile can do that.") keeps its own text.
        if (error.errorCode == PROFILE_PIN_INVALID || error.statusCode == 401) return "Wrong PIN. Try again."
        if (error.statusCode == 429) return error.message ?: "Too many wrong PINs. Wait a moment and try again."
    }
    return errorMessage(error)
}

/** The server's message as is, or a generic line when there is none. */
fun errorMessage(error: Throwable): String = error.message?.takeIf { it.isNotBlank() } ?: "Something went wrong."
