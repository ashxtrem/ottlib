package dev.ottlib.mobile.ui.profiles

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.ottlib.core.model.ProfileSummary
import dev.ottlib.core.presentation.profiles.profileColor
import dev.ottlib.core.presentation.profiles.profileInitial

/** A profile's colour circle with its initial. */
@Composable
fun ProfileAvatar(profile: ProfileSummary, size: Dp, modifier: Modifier = Modifier) {
    Box(modifier.size(size).background(profileColor(profile.color), CircleShape), contentAlignment = Alignment.Center) {
        Text(profileInitial(profile.name), color = Color.White, fontWeight = FontWeight.Bold, fontSize = (size.value * 0.42f).sp)
    }
}

/** The Home top bar's "who's watching" chip; a tap switches profile. */
@Composable
fun ProfileChip(profile: ProfileSummary, onClick: () -> Unit) {
    TextButton(onClick = onClick, modifier = Modifier.semantics { contentDescription = "Profile ${profile.name}, switch profile" }) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ProfileAvatar(profile, 28.dp)
            Text(
                profile.name,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.widthIn(max = 120.dp).padding(end = 4.dp),
            )
        }
    }
}
