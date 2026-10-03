package dev.ottlib.core.discovery

import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Looper
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements
import org.robolectric.shadow.api.Shadow
import java.net.InetAddress
import java.util.concurrent.Executor

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [34], shadows = [ServiceInfoNsdShadow::class])
class ServiceResolverTest {
    private val nsd = RuntimeEnvironment.getApplication().getSystemService(NsdManager::class.java)
    private val shadow = Shadow.extract<ServiceInfoNsdShadow>(nsd)
    private val service = NsdServiceInfo().apply {
        serviceName = "Ottlib"
        serviceType = "_ottlib._tcp"
        port = 8081
        hostAddresses = listOf(InetAddress.getByName("192.168.0.75"))
    }

    @Test fun acceptsAndroidUnregistrationCallbackAfterClosing() {
        val resolver = ServiceResolver.create(nsd)
        resolver.resolve(service) { _, _ -> }
        val registration = shadow.registrations.single()

        resolver.close()
        assertEquals(listOf(registration.callback), shadow.unregisterRequests)
        // Android schedules this asynchronously after unregisterServiceInfoCallback returns.
        registration.executor.execute { registration.callback.onServiceInfoCallbackUnregistered() }
        shadowOf(Looper.getMainLooper()).idle()
    }

    @Test fun suppressesAnUpdateAlreadyQueuedWhenDiscoveryCloses() {
        val resolver = ServiceResolver.create(nsd)
        val updates = mutableListOf<NsdServiceInfo>()
        resolver.resolve(service) { info, _ -> updates += info }
        val registration = shadow.registrations.single()

        resolver.close()
        registration.executor.execute { registration.callback.onServiceUpdated(service) }
        shadowOf(Looper.getMainLooper()).idle()
        assertTrue(updates.isEmpty())
    }

    @Test fun ignoresServicesFoundAfterClosingAndClosesOnlyOnce() {
        val resolver = ServiceResolver.create(nsd)
        resolver.resolve(service) { _, _ -> }
        resolver.close()
        resolver.close()
        resolver.resolve(service) { _, _ -> error("Closed resolver published a service") }

        assertEquals(1, shadow.registrations.size)
        assertEquals(1, shadow.unregisterRequests.size)
    }

    @Test fun publishesResolvedAddressesWhileDiscoveryIsOpen() {
        val resolver = ServiceResolver.create(nsd)
        val updates = mutableListOf<List<InetAddress>>()
        resolver.resolve(service) { _, addresses -> updates += addresses }
        val registration = shadow.registrations.single()
        registration.executor.execute { registration.callback.onServiceUpdated(service) }
        shadowOf(Looper.getMainLooper()).idle()

        assertEquals(listOf(service.hostAddresses), updates)
        resolver.close()
    }
}

/** Retains Android's executor so tests can deliver callbacks after an unregister request. */
@Implements(NsdManager::class)
class ServiceInfoNsdShadow {
    data class Registration(val executor: Executor, val callback: NsdManager.ServiceInfoCallback)
    val registrations = mutableListOf<Registration>()
    val unregisterRequests = mutableListOf<NsdManager.ServiceInfoCallback>()

    @Implementation(minSdk = 34)
    fun registerServiceInfoCallback(service: NsdServiceInfo, executor: Executor, callback: NsdManager.ServiceInfoCallback) {
        registrations += Registration(executor, callback)
    }

    @Implementation(minSdk = 34)
    fun unregisterServiceInfoCallback(callback: NsdManager.ServiceInfoCallback) {
        unregisterRequests += callback
    }
}
