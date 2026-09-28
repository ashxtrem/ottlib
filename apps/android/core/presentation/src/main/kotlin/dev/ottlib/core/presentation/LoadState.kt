package dev.ottlib.core.presentation

import android.util.Log
import dev.ottlib.core.network.ApiException
import java.io.IOException

sealed interface LoadState<out T> {
    data object Loading : LoadState<Nothing>
    data class Loaded<T>(val value: T) : LoadState<T>
    data class Failed(val message: String) : LoadState<Nothing>
}

/** A short, user-facing explanation for a failed request. */
fun Throwable.userMessage(): String = also { Log.w("Ottlib", "Request failed", it) }.let { when (this) {
    is ApiException -> message ?: "The server returned an error"
    is IOException -> "Can't reach the Ottlib server. Check that it is running and on the same network."
    else -> message ?: "Something went wrong"
} }
