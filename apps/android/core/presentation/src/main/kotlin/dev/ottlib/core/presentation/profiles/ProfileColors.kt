package dev.ottlib.core.presentation.profiles

import androidx.compose.ui.graphics.Color
import dev.ottlib.core.model.PROFILE_COLORS
import dev.ottlib.core.model.ProfileSummary
import dev.ottlib.core.presentation.theme.OttlibColors

/** A profile's `#rrggbb` avatar colour as a Compose [Color]; [OttlibColors.Muted] when the text isn't one. */
fun profileColor(hex: String): Color {
    val digits = hex.removePrefix("#")
    if (digits.length != 6) return OttlibColors.Muted
    val rgb = digits.toLongOrNull(16) ?: return OttlibColors.Muted
    return Color(0xFF000000 or rgb)
}

/** The first of [PROFILE_COLORS] no profile uses yet, for a new profile; the first colour when all are taken. */
fun nextProfileColor(profiles: List<ProfileSummary>): String {
    val used = profiles.map { it.color.lowercase() }.toSet()
    return PROFILE_COLORS.firstOrNull { it !in used } ?: PROFILE_COLORS.first()
}
