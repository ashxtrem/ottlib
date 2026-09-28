package dev.ottlib.core.presentation.connect

import android.content.Context
import android.net.ConnectivityManager
import java.net.Inet4Address

/** `192.168.0.` from the TV's own IPv4 address, to pre-fill manual entry so only the last number needs typing. */
fun localSubnetPrefix(context: Context): String {
    val connectivity = context.getSystemService(ConnectivityManager::class.java) ?: return ""
    val address = connectivity.getLinkProperties(connectivity.activeNetwork)?.linkAddresses
        ?.map { it.address }
        ?.firstOrNull { it is Inet4Address && !it.isLoopbackAddress && !it.isLinkLocalAddress }
        ?.hostAddress ?: return ""
    return address.substringBeforeLast('.') + "."
}
