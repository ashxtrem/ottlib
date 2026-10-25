package dev.ottlib.core.presentation.connect

import dev.ottlib.core.data.ProfileState

/** Where the app goes once a server is connected and its profile resolved. */
enum class ConnectOutcome {
    Home,
    /** The server has several profiles (or a PIN-locked one) and none is selected: show the profile picker. */
    PickProfile,
}

fun connectOutcome(profile: ProfileState): ConnectOutcome =
    if (profile is ProfileState.NeedsPick) ConnectOutcome.PickProfile else ConnectOutcome.Home
