package dev.ottlib.core.presentation.profiles

import androidx.compose.ui.graphics.Color
import dev.ottlib.core.model.PROFILE_COLORS
import dev.ottlib.core.model.PROFILE_PIN_INVALID
import dev.ottlib.core.model.ProfileSummary
import dev.ottlib.core.network.ApiException
import dev.ottlib.core.presentation.theme.OttlibColors
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Mirrors packages/client/src/utils/profileRights.test.ts. */
class ProfileRightsTest {
    private val lockedOwner = owner.copy(hasPin = true)
    private val guest = ProfileSummary(4, "Guest", "#006fee", hasPin = false, isOwner = false)

    @Test fun theOwnerEditsAndDeletesOthersAndClearsTheirPinDirectly() {
        assertEquals(ProfileRights(canEdit = true, canDelete = true, needsCurrentPin = false, canClearPinDirectly = true), profileRights(owner, locked))
        assertEquals(ProfileRights(canEdit = true, canDelete = true, needsCurrentPin = false, canClearPinDirectly = false), profileRights(owner, guest))
    }

    @Test fun theOwnerProfileIsNeverDeletedAndItsOwnPinNeedsTheCurrentOne() {
        assertEquals(ProfileRights(canEdit = true, canDelete = false, needsCurrentPin = true, canClearPinDirectly = false), profileRights(lockedOwner, lockedOwner))
        // The server refuses the owner clearing its own PIN without it (profileService.test.ts): never offered directly.
        assertFalse(profileRights(lockedOwner, lockedOwner).canClearPinDirectly)
        assertTrue(profileRights(lockedOwner, lockedOwner).canClearPin)
        assertFalse(profileRights(owner, owner).canClearPin)
    }

    @Test fun otherProfilesEditOnlyThemselves() {
        assertEquals(ProfileRights(canEdit = true, canDelete = false, needsCurrentPin = true, canClearPinDirectly = false), profileRights(locked, locked))
        assertEquals(ProfileRights.None, profileRights(kid, guest))
        assertEquals(ProfileRights.None, profileRights(kid, owner))
        assertFalse(profileRights(kid, locked).canClearPin)
        assertFalse(profileRights(guest, guest).needsCurrentPin)
        assertFalse(profileRights(null, guest).canEdit)
    }

    @Test fun onlyTheOwnerAddsAndOnlyBelowTheLimit() {
        assertTrue(canAddProfile(owner, 5))
        assertFalse(canAddProfile(owner, 6))
        assertFalse(canAddProfile(kid, 2))
        assertFalse(canAddProfile(null, 1))
    }

    @Test fun theAvatarLetterIsTheFirstOfTheName() {
        assertEquals("K", profileInitial(" kid"))
        assertEquals("?", profileInitial("  "))
    }

    @Test fun coloursParseAndANewProfileGetsTheFirstUnusedOne() {
        assertEquals(Color(0xFFE50914), profileColor("#e50914"))
        assertEquals(OttlibColors.Muted, profileColor("red"))
        assertEquals(PROFILE_COLORS[0], nextProfileColor(emptyList()))
        assertEquals("#006fee", nextProfileColor(listOf(owner, kid, locked)))
        assertEquals("#f5a524", nextProfileColor(listOf(owner, locked)))
        val all = PROFILE_COLORS.mapIndexed { index, color -> guest.copy(id = index, color = color.uppercase()) }
        assertEquals(PROFILE_COLORS.first(), nextProfileColor(all))
    }

    @Test fun pinErrorsReadLikeTheWeb() {
        val wrong = ApiException(403, "Wrong PIN.", PROFILE_PIN_INVALID)
        val notOwner = ApiException(403, "Only the owner profile can do that.")
        val lockout = ApiException(429, "Too many wrong PINs. Try again in 30 seconds.")
        assertEquals("Wrong PIN. Try again.", pinErrorMessage(wrong))
        assertEquals("Only the owner profile can do that.", pinErrorMessage(notOwner))
        assertEquals("Too many wrong PINs. Try again in 30 seconds.", pinErrorMessage(lockout))
        assertTrue(isCompletePin("1234"))
        assertFalse(isCompletePin("123"))
        assertFalse(isCompletePin("12a4"))
    }
}
