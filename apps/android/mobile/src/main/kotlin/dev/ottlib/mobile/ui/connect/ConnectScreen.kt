package dev.ottlib.mobile.ui.connect

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.ottlib.core.discovery.DiscoveredServer
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.connect.ConnectUiState
import dev.ottlib.core.presentation.connect.ConnectViewModel
import dev.ottlib.core.presentation.connect.localSubnetPrefix
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.mobile.ui.components.LoadingMessage
import dev.ottlib.mobile.ui.components.WindowWidth
import dev.ottlib.mobile.ui.components.windowWidth

@Composable
fun ConnectScreen(autoConnect: Boolean, onConnected: () -> Unit) {
    val container = appContainer()
    val viewModel = viewModel { ConnectViewModel(container.connection, container.discovery, autoConnect) }
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val servers by viewModel.servers.collectAsStateWithLifecycle()

    LaunchedEffect(state.connected) { if (state.connected) onConnected() }

    Scaffold { padding ->
        if (state.restoring || state.connected) {
            LoadingMessage(Modifier.padding(padding), "Connecting to your Ottlib server…")
            return@Scaffold
        }
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Text("Connect to Ottlib", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text(
                "Pick the PC running the Ottlib server, or enter the address shown in the web app under Settings → Server info. Your phone must be on the same Wi-Fi.",
                style = MaterialTheme.typography.bodyLarge,
                color = OttlibColors.Muted,
            )
            // Side by side when there is room (unfolded, landscape); stacked on the cover screen.
            if (windowWidth() == WindowWidth.Compact) {
                ServerSection(servers, state, viewModel::connect)
                AddressSection(state, viewModel::connectTo)
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(32.dp)) {
                    ServerSection(servers, state, viewModel::connect, Modifier.weight(1f))
                    AddressSection(state, viewModel::connectTo, Modifier.weight(1f))
                }
            }
            state.connecting?.let { Text("Connecting to $it…", style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Accent) }
            state.error?.let { Text(it, style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Error) }
        }
    }
}

@Composable
private fun ServerSection(servers: List<DiscoveredServer>, state: ConnectUiState, onSelect: (DiscoveredServer) -> Unit, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("On your network", style = MaterialTheme.typography.titleMedium)
        if (servers.isEmpty()) Text("Searching…", style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Muted)
        servers.forEach { server ->
            Card {
                ListItem(
                    headlineContent = { Text(server.name) },
                    supportingContent = { Text("${server.host}:${server.port}") },
                    leadingContent = { Icon(Icons.Filled.Dns, contentDescription = null) },
                    colors = ListItemDefaults.colors(containerColor = OttlibColors.Surface),
                    modifier = Modifier.clickable(enabled = state.connecting == null) { onSelect(server) },
                )
            }
        }
    }
}

@Composable
private fun AddressSection(state: ConnectUiState, onConnect: (String) -> Unit, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    var address by rememberSaveable { mutableStateOf(localSubnetPrefix(context)) }
    Column(modifier.widthIn(max = 480.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Enter address", style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(
            value = address,
            onValueChange = { address = it },
            placeholder = { Text("192.168.1.20:8081") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Go),
            keyboardActions = KeyboardActions(onGo = { onConnect(address) }),
            modifier = Modifier.fillMaxWidth(),
        )
        Button(onClick = { onConnect(address) }, enabled = state.connecting == null, modifier = Modifier.align(Alignment.End)) { Text("Connect") }
    }
}
