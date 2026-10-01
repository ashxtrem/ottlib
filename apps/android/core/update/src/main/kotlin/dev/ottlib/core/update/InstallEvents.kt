package dev.ottlib.core.update

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/** What the system installer reported for the session [ApkInstaller] committed. */
sealed interface InstallEvent {
    /** The system asked the user to confirm. */
    data object WaitingForUser : InstallEvent
    /** The user backed out of the confirmation. */
    data object Cancelled : InstallEvent
    data class Failed(val message: String) : InstallEvent
}

/** Bridges [InstallResultReceiver] (created by the system) to whoever is following the update. */
object InstallEvents {
    private val events = MutableSharedFlow<InstallEvent>(extraBufferCapacity = 8)
    val flow: SharedFlow<InstallEvent> = events.asSharedFlow()
    internal fun emit(event: InstallEvent) { events.tryEmit(event) }
}
