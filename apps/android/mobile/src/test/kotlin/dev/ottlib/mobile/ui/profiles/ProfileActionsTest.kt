package dev.ottlib.mobile.ui.profiles

import dev.ottlib.core.model.ProfileSummary
import dev.ottlib.core.presentation.profiles.profileRights
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProfileActionsTest {
    private val owner = ProfileSummary(1, "Owner", "#e50914", hasPin = true, isOwner = true)
    private val kid = ProfileSummary(2, "Kid", "#17c964", hasPin = true, isOwner = false)
    private val guest = ProfileSummary(3, "Guest", "#006fee", hasPin = false, isOwner = false)

    @Test
    fun ownerGetsEveryActionOnOthersButCannotDeleteItself() {
        assertEquals(listOf(ProfileAction.Edit, ProfileAction.Pin, ProfileAction.Delete), profileActions(profileRights(owner, kid)))
        assertEquals(listOf(ProfileAction.Edit, ProfileAction.Pin), profileActions(profileRights(owner, owner)))
    }

    @Test
    fun anotherProfileOnlyManagesItself() {
        assertEquals(listOf(ProfileAction.Edit, ProfileAction.Pin), profileActions(profileRights(kid, kid)))
        assertEquals(emptyList<ProfileAction>(), profileActions(profileRights(kid, guest)))
        assertEquals(emptyList<ProfileAction>(), profileActions(profileRights(kid, owner)))
        assertEquals(emptyList<ProfileAction>(), profileActions(profileRights(null, kid)))
    }

    @Test
    fun pinDialogAsksTheCurrentPinOnlyForYourOwnPin() {
        val own = pinDialogFields(kid, profileRights(kid, kid))
        assertTrue(own.askCurrentPin)
        assertTrue(own.canClear)
        assertEquals("Change PIN for Kid", own.title)

        val ownerResettingKid = pinDialogFields(kid, profileRights(owner, kid))
        assertFalse(ownerResettingKid.askCurrentPin)
        assertTrue(ownerResettingKid.canClear)

        val noPinYet = pinDialogFields(guest, profileRights(owner, guest))
        assertFalse(noPinYet.askCurrentPin)
        assertFalse(noPinYet.canClear)
        assertEquals("Set PIN for Guest", noPinYet.title)
    }
}
