package dev.ottlib.core.discovery

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import java.util.concurrent.ConcurrentHashMap

/** Browses the LAN for Ottlib servers while collected; emits the current list, sorted by name. */
class ServerDiscovery(private val context: Context) {
    fun servers(): Flow<List<DiscoveredServer>> = callbackFlow {
        val nsd = context.getSystemService(NsdManager::class.java)
        val found = ConcurrentHashMap<String, DiscoveredServer>()
        val resolver = ServiceResolver.create(nsd)
        fun publish() { trySend(found.values.sortedBy { it.name.lowercase() }) }

        val listener = object : NsdManager.DiscoveryListener {
            override fun onServiceFound(service: NsdServiceInfo) {
                resolver.resolve(service) { resolved, addresses ->
                    val host = advertisedAddress(resolved.attributes["address"]) ?: preferredAddress(addresses)?.hostAddress ?: return@resolve
                    val apiVersion = resolved.attributes["apiVersion"]?.let { String(it).toIntOrNull() }
                    found[service.serviceName] = DiscoveredServer(service.serviceName, host, resolved.port, apiVersion)
                    publish()
                }
            }
            override fun onServiceLost(service: NsdServiceInfo) { if (found.remove(service.serviceName) != null) publish() }
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) { close() }
            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) = Unit
            override fun onDiscoveryStarted(serviceType: String) = Unit
            override fun onDiscoveryStopped(serviceType: String) = Unit
        }

        publish()
        nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
        awaitClose {
            runCatching { nsd.stopServiceDiscovery(listener) }
            resolver.close()
        }
    }

    companion object {
        /** Must match `discoveryServiceType` in packages/server/src/config/defaults.ts. */
        const val SERVICE_TYPE = "_ottlib._tcp"
    }
}
