package dev.ottlib.core.presentation.update

/** Wording for update states, shared by the TV and phone banners and Settings rows. */
object UpdateText {
    fun headline(state: UpdateState): String = when (state) {
        UpdateState.Idle -> "Check for updates"
        UpdateState.Checking -> "Checking for updates…"
        UpdateState.UpToDate -> "OttLib is up to date"
        UpdateState.LocalBuild -> "Updates unavailable for this build"
        is UpdateState.Available -> "OttLib ${state.release.version.name} is available"
        is UpdateState.Downloading -> "Downloading OttLib ${state.release.version.name}…" + (state.progress?.let { " ${(it * 100).toInt()}%" } ?: "")
        is UpdateState.NeedsPermission -> "Allow OttLib to install its update"
        is UpdateState.Installing -> "Installing OttLib ${state.release.version.name}…"
        is UpdateState.Failed -> "Update failed"
    }

    fun detail(state: UpdateState): String? = when (state) {
        UpdateState.LocalBuild -> "This copy is signed with a debug key (a local build), so it can't install releases from GitHub."
        is UpdateState.Available -> "Downloaded from the OttLib GitHub release and checked before installing."
        is UpdateState.NeedsPermission ->
            if (state.settingsOpened) "Turn on \"Allow from this source\" for OttLib, then come back here."
            else "Open the system Settings → Apps → Security & restrictions → Unknown sources (Google TV), or Apps → Special app access → " +
                "Install unknown apps (phones), and allow OttLib."
        is UpdateState.Installing -> "Confirm the install when Android asks."
        is UpdateState.Failed -> state.message
        else -> null
    }

    /** Label for the main action, or null when there's nothing to press. */
    fun action(state: UpdateState): String? = when (state) {
        is UpdateState.Available -> "Update"
        is UpdateState.NeedsPermission -> "Open settings"
        is UpdateState.Failed -> if (state.release != null) "Try again" else "Check again"
        UpdateState.Idle, UpdateState.UpToDate -> "Check now"
        else -> null
    }

    /** Label for putting the update off (or stopping a download), or null when not offered. */
    fun dismiss(state: UpdateState): String? = when (state) {
        is UpdateState.Downloading -> "Cancel"
        is UpdateState.Available, is UpdateState.NeedsPermission, is UpdateState.Failed -> "Later"
        else -> null
    }
}

/** Runs the action [UpdateText.action] names for the current state. */
fun AppUpdates.performAction() {
    when (val current = state.value) {
        is UpdateState.Available, is UpdateState.NeedsPermission -> update()
        is UpdateState.Failed -> if (current.release != null) update() else check()
        UpdateState.Idle, UpdateState.UpToDate -> check()
        else -> Unit
    }
}
