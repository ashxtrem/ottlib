package dev.ottlib.mobile.ui.profiles

import dev.ottlib.core.model.ProfileSummary
import dev.ottlib.core.presentation.profiles.ProfileRights

/** What a row on the Manage profiles screen offers. */
enum class ProfileAction(val label: String) { Edit("Edit"), Pin("PIN"), Delete("Delete") }

/** The row's actions: only what [rights] lets the profile in use do, so the server never has to refuse. */
fun profileActions(rights: ProfileRights): List<ProfileAction> = buildList {
    // Setting a PIN is part of editing; the dialog itself offers Remove only when canClearPin.
    if (rights.canEdit) {
        add(ProfileAction.Edit)
        add(ProfileAction.Pin)
    }
    if (rights.canDelete) add(ProfileAction.Delete)
}

/** The PIN dialog's fields for [target]: a current PIN field only for your own existing PIN. */
data class PinDialogFields(val title: String, val askCurrentPin: Boolean, val canSet: Boolean, val canClear: Boolean)

fun pinDialogFields(target: ProfileSummary, rights: ProfileRights): PinDialogFields = PinDialogFields(
    title = "${if (target.hasPin) "Change" else "Set"} PIN for ${target.name}",
    askCurrentPin = rights.needsCurrentPin,
    canSet = rights.canEdit,
    canClear = rights.canClearPin,
)
