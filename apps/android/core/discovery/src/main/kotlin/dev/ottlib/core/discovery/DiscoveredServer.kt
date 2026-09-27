package dev.ottlib.core.discovery

import java.net.Inet4Address
import java.net.InetAddress

/** An Ottlib server found over mDNS (`_ottlib._tcp`, advertised by the server's DiscoveryService). */
data class DiscoveredServer(val name: String, val host: String, val port: Int, val apiVersion: Int?) {
    val url: String get() = "http://${if (':' in host) "[$host]" else host}:$port/"
}

/** Prefers a routable IPv4 address: Windows hosts also advertise 169.254.x.x and link-local IPv6 addresses. */
internal fun preferredAddress(addresses: List<InetAddress>): InetAddress? =
    addresses.firstOrNull { it is Inet4Address && !it.isLinkLocalAddress && !it.isLoopbackAddress }
        ?: addresses.firstOrNull { !it.isLinkLocalAddress && !it.isLoopbackAddress }
        ?: addresses.firstOrNull()

private val ipv4Literal = Regex("""^(\d{1,3}\.){3}\d{1,3}$""")

/**
 * The LAN address the server put in its TXT record. Preferred over the resolved host address, because the host's
 * A records can also list unreachable virtual adapters and older Android versions return just one of them.
 */
internal fun advertisedAddress(txtValue: ByteArray?): String? =
    txtValue?.let { String(it) }?.takeIf { ipv4Literal.matches(it) && !it.startsWith("169.254.") }
