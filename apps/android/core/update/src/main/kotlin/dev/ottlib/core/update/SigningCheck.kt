package dev.ottlib.core.update

import android.content.Context
import android.content.pm.PackageManager
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate

/**
 * True when this install is signed with the Android debug key (a local or debug build). Release APKs are signed
 * with the release key, and Android won't replace an app signed with a different key, so such builds can't self-update.
 */
fun isDebugSigned(context: Context): Boolean = runCatching {
    val info = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
    val certificates = CertificateFactory.getInstance("X.509")
    info.signingInfo?.apkContentsSigners.orEmpty().any { signature ->
        val certificate = certificates.generateCertificate(signature.toByteArray().inputStream()) as X509Certificate
        certificate.subjectX500Principal.name.contains("CN=Android Debug")
    }
}.getOrDefault(false)
