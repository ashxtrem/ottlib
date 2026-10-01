package dev.ottlib.core.network

import okhttp3.HttpUrl
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Sends the session token for the server a request goes to (API calls, posters, and the player's stream requests
 * all share this client). Servers without an access PIN ignore it.
 */
class AuthTokenInterceptor(private val tokenFor: (HttpUrl) -> String?) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val token = tokenFor(request.url) ?: return chain.proceed(request)
        return chain.proceed(request.newBuilder().header("Authorization", "Bearer $token").build())
    }
}
