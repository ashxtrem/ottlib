package dev.ottlib.mobile.ui.profiles

import dev.ottlib.mobile.ui.components.WindowWidth

/** "Who's watching?" columns: 2 on the cover screen or a phone, 3 in a medium window, 4 when expanded. */
val WindowWidth.profileColumns: Int
    get() = when (this) {
        WindowWidth.Compact -> 2
        WindowWidth.Medium -> 3
        WindowWidth.Expanded -> 4
    }
