package dev.ottlib.core.presentation.connect

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.ottlib.core.data.ConnectResult
import dev.ottlib.core.data.ConnectionManager
import dev.ottlib.core.discovery.DiscoveredServer
import dev.ottlib.core.discovery.ServerDiscovery
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import okhttp3.HttpUrl

data class ConnectUiState(
    val connecting: String? = null,
    val error: String? = null,
    val connected: Boolean = false,
    /** True while trying the saved server on launch; the picker is hidden until that fails. */
    val restoring: Boolean = false,
)

class ConnectViewModel(private val connection: ConnectionManager, discovery: ServerDiscovery, autoConnect: Boolean) : ViewModel() {
    private val state = MutableStateFlow(ConnectUiState(restoring = autoConnect))
    val uiState: StateFlow<ConnectUiState> = state.asStateFlow()
    private var attempt: Job? = null

    val servers: StateFlow<List<DiscoveredServer>> = discovery.servers()
        .catch { emit(emptyList()) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    init {
        if (autoConnect) viewModelScope.launch {
            val saved = connection.savedServer()
            if (saved == null) state.update { it.copy(restoring = false) } else connect(saved, silent = true)
        }
    }

    fun connect(server: DiscoveredServer) {
        ConnectionManager.parse(server.url)?.let { connect(it, silent = false) }
    }

    fun connectTo(address: String) {
        val url = ConnectionManager.parse(address)
        if (url == null) state.update { it.copy(error = "“$address” is not a valid address. Try 192.168.1.20 or 192.168.1.20:8081.") }
        else connect(url, silent = false)
    }

    private fun connect(url: HttpUrl, silent: Boolean) {
        attempt?.cancel()
        attempt = viewModelScope.launch {
            state.update { it.copy(connecting = "${url.host}:${url.port}", error = null) }
            when (val result = connection.connect(url)) {
                is ConnectResult.Connected -> state.update { it.copy(connecting = null, connected = true) }
                is ConnectResult.Incompatible -> state.update { it.copy(connecting = null, restoring = false, error = result.message) }
                is ConnectResult.Unreachable -> state.update {
                    it.copy(
                        connecting = null,
                        restoring = false,
                        error = if (silent) "Couldn't reach your Ottlib server at ${url.host}:${url.port}. Pick a server or enter its address." else result.message,
                    )
                }
            }
        }
    }
}
