package dev.ottlib.mobile.ui.profiles

import dev.ottlib.mobile.ui.components.WindowWidth
import org.junit.Assert.assertEquals
import org.junit.Test

class ProfileGridColumnsTest {
    @Test
    fun columnsFollowTheWindowWidthClass() {
        assertEquals(2, WindowWidth.Compact.profileColumns)
        assertEquals(3, WindowWidth.Medium.profileColumns)
        assertEquals(4, WindowWidth.Expanded.profileColumns)
    }
}
