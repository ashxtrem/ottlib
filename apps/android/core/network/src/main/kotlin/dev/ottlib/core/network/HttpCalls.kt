package dev.ottlib.core.network

import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Response
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Executes the call and returns its body text, or throws [ApiException] with the server's error message.
 * The body is read on OkHttp's thread (never the caller's, which may be the main thread), and the call is
 * cancelled with the coroutine.
 */
internal suspend fun Call.awaitBody(): String = suspendCancellableCoroutine { continuation ->
    continuation.invokeOnCancellation { cancel() }
    enqueue(object : Callback {
        override fun onResponse(call: Call, response: Response) {
            runCatching { response.bodyOrThrow() }
                .onSuccess { continuation.resume(it) }
                .onFailure { continuation.resumeWithException(it) }
        }
        override fun onFailure(call: Call, e: IOException) = continuation.resumeWithException(e)
    })
}

private fun Response.bodyOrThrow(): String = use {
    val text = body?.string().orEmpty()
    if (!isSuccessful) throw ApiException(code, errorMessage(text) ?: "Server returned HTTP $code")
    text
}

/** The `{ error }` text; when `error` is a code (`TRANSCODE_BUSY`) and a `message` comes with it, the message. */
private fun errorMessage(body: String): String? = runCatching {
    val json = OttlibJson.parseToJsonElement(body).jsonObject
    val error = json["error"]?.jsonPrimitive?.content
    val message = json["message"]?.jsonPrimitive?.content
    if (error != null && message != null && errorCode.matches(error)) message else error
}.getOrNull()

private val errorCode = Regex("^[A-Z][A-Z0-9_]+$")
