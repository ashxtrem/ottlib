package dev.ottlib.core.discovery

import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import android.os.Handler
import android.os.Looper
import java.net.InetAddress

/** Resolves discovered services to addresses, hiding the Android 14 API change. */
internal interface ServiceResolver {
    fun resolve(service: NsdServiceInfo, onResolved: (NsdServiceInfo, List<InetAddress>) -> Unit)
    fun close()

    companion object {
        fun create(nsd: NsdManager): ServiceResolver =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) CallbackResolver(nsd) else QueuedResolver(nsd)
    }
}

/**
 * Before Android 14 only one `resolveService` may run at a time, so requests are queued. A resolve whose host
 * lookup never answers would block the queue, so each one is given [TIMEOUT_MS] before the next starts.
 */
@Suppress("DEPRECATION")
private class QueuedResolver(private val nsd: NsdManager) : ServiceResolver {
    private val queue = ArrayDeque<Pair<NsdServiceInfo, (NsdServiceInfo, List<InetAddress>) -> Unit>>()
    private var busy = false
    private var attempt = 0
    private val handler = Handler(Looper.getMainLooper())
    @Volatile private var closed = false

    override fun resolve(service: NsdServiceInfo, onResolved: (NsdServiceInfo, List<InetAddress>) -> Unit) {
        synchronized(queue) { queue.addLast(service to onResolved) }
        next()
    }

    private fun next() {
        val (current, request) = synchronized(queue) {
            if (busy || closed || queue.isEmpty()) return
            busy = true
            ++attempt to queue.removeFirst()
        }
        val (service, onResolved) = request
        handler.postDelayed({ done(current) }, TIMEOUT_MS)
        nsd.resolveService(service, object : NsdManager.ResolveListener {
            override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) = done(current)
            override fun onServiceResolved(serviceInfo: NsdServiceInfo) {
                serviceInfo.host?.let { onResolved(serviceInfo, listOf(it)) }
                done(current)
            }
        })
    }

    /** Frees the queue for the next request, once per attempt (the timeout and the callback may both fire). */
    private fun done(finished: Int) {
        synchronized(queue) {
            if (finished != attempt || !busy) return
            busy = false
        }
        next()
    }

    companion object {
        const val TIMEOUT_MS = 5_000L
    }

    override fun close() {
        closed = true
        handler.removeCallbacksAndMessages(null)
        synchronized(queue) { queue.clear() }
    }
}
