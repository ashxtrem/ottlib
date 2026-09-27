package dev.ottlib.core.network

import okhttp3.Interceptor
import okhttp3.Response

/** Sends the per-device id the server uses for watched state and resume position (same header as the web client). */
class DeviceIdInterceptor(private val deviceId: () -> String) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response =
        chain.proceed(chain.request().newBuilder().header("x-device-id", deviceId()).build())
}
