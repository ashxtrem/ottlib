package dev.ottlib.core.presentation.connect

import dev.ottlib.core.data.ProfileState
import dev.ottlib.core.model.ProfileSummary
import org.junit.Assert.assertEquals
import org.junit.Test

class ConnectOutcomeTest {
    private val owner = ProfileSummary(1, "Owner", "#e50914", hasPin = false, isOwner = true)

    @Test
    fun needingAPickRoutesToThePicker() =
        assertEquals(ConnectOutcome.PickProfile, connectOutcome(ProfileState.NeedsPick(listOf(owner, owner.copy(id = 2)))))

    @Test
    fun everythingElseGoesHome() {
        listOf(ProfileState.Unsupported, ProfileState.Single(owner), ProfileState.Selected(owner, listOf(owner))).forEach {
            assertEquals(ConnectOutcome.Home, connectOutcome(it))
        }
    }
}
