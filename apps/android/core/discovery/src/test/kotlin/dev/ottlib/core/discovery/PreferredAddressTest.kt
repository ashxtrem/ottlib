package dev.ottlib.core.discovery

import org.junit.Assert.assertEquals
import org.junit.Test
import java.net.InetAddress

class PreferredAddressTest {
    private fun address(value: String) = InetAddress.getByName(value)

    @Test
    fun skipsLinkLocalAddressesAdvertisedByWindows() {
        val addresses = listOf(address("169.254.123.64"), address("fe80::28a5:722:a21e:9ee0"), address("192.168.0.75"))
        assertEquals(address("192.168.0.75"), preferredAddress(addresses))
    }

    @Test
    fun fallsBackToWhateverIsAvailable() {
        assertEquals(address("169.254.1.1"), preferredAddress(listOf(address("169.254.1.1"))))
    }

    @Test
    fun bracketsIpv6HostsInUrls() {
        assertEquals("http://[fd00::1]:8081/", DiscoveredServer("x", "fd00::1", 8081, 1).url)
        assertEquals("http://192.168.0.75:8081/", DiscoveredServer("x", "192.168.0.75", 8081, 1).url)
    }

    @Test
    fun prefersTheAddressTheServerAdvertisesInTxt() {
        assertEquals("192.168.0.75", advertisedAddress("192.168.0.75".toByteArray()))
        assertEquals(null, advertisedAddress("169.254.123.64".toByteArray()))
        assertEquals(null, advertisedAddress("not-an-ip".toByteArray()))
        assertEquals(null, advertisedAddress(null))
    }
}
