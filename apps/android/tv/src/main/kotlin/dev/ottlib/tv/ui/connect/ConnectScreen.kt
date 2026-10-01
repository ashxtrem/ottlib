package dev.ottlib.tv.ui.connect

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.Button
import androidx.tv.material3.ListItem
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import dev.ottlib.core.discovery.DiscoveredServer
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.connect.ConnectViewModel
import dev.ottlib.core.presentation.connect.localSubnetPrefix
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.tv.ui.components.LoadingMessage
import dev.ottlib.tv.ui.components.ScreenPadding
import dev.ottlib.tv.ui.components.TvTextField
import dev.ottlib.tv.ui.components.tryRequestFocus

@Composable
fun ConnectScreen(autoConnect: Boolean, onConnected: () -> Unit) {
    val container = appContainer()
    val viewModel = viewModel { ConnectViewModel(container.connection, container.discovery, autoConnect) }
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val servers by viewModel.servers.collectAsStateWithLifecycle()

    LaunchedEffect(state.connected) { if (state.connected) onConnected() }

    if (state.restoring || state.connected) {
        LoadingMessage("Connecting to your Ottlib server…")
        return
    }
    state.pinFor?.let { server ->
        PinEntry(server, checking = state.connecting != null, error = state.error, onSubmit = viewModel::submitPin, onCancel = viewModel::cancelPin)
        return
    }

    val context = LocalContext.current
    var address by rememberSaveable { mutableStateOf(localSubnetPrefix(context)) }
    val firstFocus = remember { FocusRequester() }

    Column(Modifier.fillMaxSize().padding(ScreenPadding), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Text("Connect to Ottlib", style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold, color = OttlibColors.Foreground)
        Text(
            "Pick the PC running the Ottlib server, or enter the address shown in the web app under Settings → Server info.",
            style = MaterialTheme.typography.bodyLarge,
            color = OttlibColors.Muted,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(48.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("On your network", style = MaterialTheme.typography.titleMedium, color = OttlibColors.Foreground)
                if (servers.isEmpty()) {
                    Text("Searching…", style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Muted)
                } else {
                    ServerList(servers, connecting = state.connecting, onSelect = viewModel::connect, firstFocus = firstFocus)
                }
            }
            Column(Modifier.width(420.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Enter address", style = MaterialTheme.typography.titleMedium, color = OttlibColors.Foreground)
                TvTextField(
                    value = address,
                    onValueChange = { address = it },
                    placeholder = "192.168.1.20:8081",
                    keyboardType = KeyboardType.Uri,
                    imeAction = ImeAction.Go,
                    onSubmit = { viewModel.connectTo(address) },
                    modifier = Modifier.fillMaxWidth().then(if (servers.isEmpty()) Modifier.focusRequester(firstFocus) else Modifier),
                )
                Button(onClick = { viewModel.connectTo(address) }, enabled = state.connecting == null) { Text("Connect") }
            }
        }
        state.connecting?.let { Text("Connecting to $it…", style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Accent) }
        state.error?.let { Text(it, style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Error) }
    }

    LaunchedEffect(servers.isEmpty()) { firstFocus.tryRequestFocus() }
}

@Composable
private fun ServerList(servers: List<DiscoveredServer>, connecting: String?, onSelect: (DiscoveredServer) -> Unit, firstFocus: FocusRequester) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(servers, key = { it.name }) { server ->
            ListItem(
                selected = false,
                enabled = connecting == null,
                onClick = { onSelect(server) },
                headlineContent = { Text(server.name) },
                supportingContent = { Text("${server.host}:${server.port}") },
                modifier = if (server == servers.first()) Modifier.focusRequester(firstFocus) else Modifier,
            )
        }
    }
}
