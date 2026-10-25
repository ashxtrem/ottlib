package dev.ottlib.core.network

import dev.ottlib.core.model.ApiError
import dev.ottlib.core.model.PROFILE_REQUIRED
import dev.ottlib.core.model.PROFILE_SESSION_HEADER
import okhttp3.HttpUrl
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Sends the profile session token for the server a request goes to, and reports a `409 PROFILE_REQUIRED` answer
 * (the session is missing or no longer valid) through [onProfileRequired], with the token the request carried (null
 * when none) so a stale answer to an older token can be told apart. The body is only peeked, so the caller still
 * reads it and gets the normal [ApiException].
 */
class ProfileSessionInterceptor(
    private val tokenFor: (HttpUrl) -> String?,
    private val onProfileRequired: (url: HttpUrl, sentToken: String?) -> Unit,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val token = tokenFor(request.url)
        val response = chain.proceed(if (token == null) request else request.newBuilder().header(PROFILE_SESSION_HEADER, token).build())
        if (response.code == 409 && isProfileRequired(response)) onProfileRequired(request.url, token)
        return response
    }

    private fun isProfileRequired(response: Response): Boolean = runCatching {
        OttlibJson.decodeFromString(ApiError.serializer(), response.peekBody(PEEK_LIMIT).string()).error == PROFILE_REQUIRED
    }.getOrDefault(false)

    private companion object {
        const val PEEK_LIMIT = 8L * 1024
    }
}
