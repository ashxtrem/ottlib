package dev.ottlib.core.presentation.find

import dev.ottlib.core.model.FindHandoffRequest
import dev.ottlib.core.model.FindHandoffResult
import dev.ottlib.core.model.ServerInfo
import dev.ottlib.core.network.ApiException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * Hands a Find search to the Hashlark app on the server PC (`POST /api/find/handoff`). UI-neutral: the TV and phone screens show
 * the Find button while [available] and toast whatever [messages] emits (collect it where a snackbar or toast can be shown).
 */
class FindLauncher(
    private val scope: CoroutineScope,
    serverInfo: StateFlow<ServerInfo?>,
    private val handoff: suspend (FindHandoffRequest) -> FindHandoffResult,
) {
    /** True while the active server hands Find to Hashlark (`ServerInfo.findHandoff == "hashlark"`). */
    val available: StateFlow<Boolean> = serverInfo.map { it?.findHandoff == HASHLARK }.stateIn(scope, SharingStarted.Eagerly, serverInfo.value?.findHandoff == HASHLARK)

    private val serverName = serverInfo
    private val outgoing = MutableSharedFlow<String>(extraBufferCapacity = 8)

    /** One user-facing line per [find] call. Not replayed: a collector sees only what happens after it starts. */
    val messages: SharedFlow<String> = outgoing.asSharedFlow()

    /** Opens the search for [title] in Hashlark on the server PC; the outcome arrives on [messages]. Never throws. */
    fun find(title: String, year: Int? = null, imdbId: String? = null) {
        scope.launch {
            val message = try {
                handoff(FindHandoffRequest(title = title, year = year, imdbId = imdbId))
                "Opened in Hashlark on ${serverName.value?.name ?: "the server PC"}."
            } catch (error: CancellationException) {
                throw error
            } catch (error: ApiException) {
                if (error.errorCode == NOT_INSTALLED) "Hashlark isn't installed on the server PC." else error.message?.takeIf { it.isNotBlank() } ?: FAILED
            } catch (error: Exception) {
                error.message?.takeIf { it.isNotBlank() } ?: FAILED
            }
            outgoing.tryEmit(message)
        }
    }

    private companion object {
        const val HASHLARK = "hashlark"
        const val NOT_INSTALLED = "HASHLARK_NOT_FOUND"
        const val FAILED = "Couldn't open Hashlark on the server PC."
    }
}
