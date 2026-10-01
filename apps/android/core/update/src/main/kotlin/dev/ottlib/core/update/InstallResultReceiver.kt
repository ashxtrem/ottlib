package dev.ottlib.core.update

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build

/**
 * Receives the install session's status. When the system needs the user to confirm, it hands back an intent for
 * its confirmation screen, which is started from here. On success the app is replaced, so nothing else is reported.
 */
class InstallResultReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                val confirm = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
                else @Suppress("DEPRECATION") intent.getParcelableExtra(Intent.EXTRA_INTENT)
                if (confirm == null) {
                    InstallEvents.emit(InstallEvent.Failed("The system installer didn't open."))
                } else {
                    context.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    InstallEvents.emit(InstallEvent.WaitingForUser)
                }
            }
            PackageInstaller.STATUS_SUCCESS -> Unit
            PackageInstaller.STATUS_FAILURE_ABORTED -> InstallEvents.emit(InstallEvent.Cancelled)
            else -> InstallEvents.emit(InstallEvent.Failed(failureMessage(status, intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE))))
        }
    }

    private fun failureMessage(status: Int, detail: String?): String = when (status) {
        PackageInstaller.STATUS_FAILURE_CONFLICT, PackageInstaller.STATUS_FAILURE_INCOMPATIBLE ->
            "This copy of OttLib was signed with a different key (for example a local build). Uninstall it, then install the APK from the GitHub release."
        PackageInstaller.STATUS_FAILURE_STORAGE -> "Not enough storage to install the update."
        else -> "Install failed${detail?.let { ": $it" } ?: "."}"
    }
}
