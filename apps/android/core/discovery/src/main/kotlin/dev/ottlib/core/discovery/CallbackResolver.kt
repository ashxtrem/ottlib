package dev.ottlib.core.discovery

import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.annotation.RequiresApi
import java.net.InetAddress
import java.util.concurrent.Executor

/** Android 14+: `registerServiceInfoCallback` reports every address and can run concurrently. */
@RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
internal class CallbackResolver(private val nsd: NsdManager) : ServiceResolver {
    private val handler = Handler(Looper.getMainLooper())
    // Unregistration is asynchronous: Android still uses this executor for the terminal callback.
    // The app's main looper outlives discovery, without leaving a resolver-owned thread running.
    private val executor = Executor { handler.post(it) }
    private val callbacks = mutableSetOf<NsdManager.ServiceInfoCallback>()
    private var closed = false

    override fun resolve(service: NsdServiceInfo, onResolved: (NsdServiceInfo, List<InetAddress>) -> Unit) {
        synchronized(callbacks) {
            if (closed) return
            val callback = object : NsdManager.ServiceInfoCallback {
                override fun onServiceInfoCallbackRegistrationFailed(errorCode: Int) {
                    synchronized(callbacks) { callbacks.remove(this) }
                }

                override fun onServiceUpdated(serviceInfo: NsdServiceInfo) {
                    synchronized(callbacks) {
                        if (!closed && serviceInfo.hostAddresses.isNotEmpty()) {
                            onResolved(serviceInfo, serviceInfo.hostAddresses)
                        }
                    }
                }

                override fun onServiceLost() = Unit
                override fun onServiceInfoCallbackUnregistered() {
                    synchronized(callbacks) { callbacks.remove(this) }
                }
            }
            callbacks += callback
            // Keep registration and close under the same lock so a late service cannot escape cleanup.
            runCatching { nsd.registerServiceInfoCallback(service, executor, callback) }
                .onFailure { callbacks.remove(callback) }
        }
    }

    override fun close() {
        synchronized(callbacks) {
            if (closed) return
            closed = true
            callbacks.toList().forEach { runCatching { nsd.unregisterServiceInfoCallback(it) } }
            callbacks.clear()
        }
    }
}
