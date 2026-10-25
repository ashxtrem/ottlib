package dev.ottlib.tv.ui.profiles

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import dev.ottlib.core.model.ProfileSummary
import dev.ottlib.core.presentation.profiles.profileColor
import dev.ottlib.core.presentation.profiles.profileInitial
import dev.ottlib.core.presentation.theme.OttlibColors

/** A profile's colour circle with its initial. */
@Composable
fun ProfileAvatar(profile: ProfileSummary, size: Dp, modifier: Modifier = Modifier) {
    Box(modifier.size(size).background(profileColor(profile.color), CircleShape), contentAlignment = Alignment.Center) {
        Text(profileInitial(profile.name), color = Color.White, fontWeight = FontWeight.Bold, fontSize = (size.value * 0.42f).sp)
    }
}

/** One "Who's watching?" tile: avatar, name, and a lock when the profile has a PIN. */
@Composable
fun ProfileTile(profile: ProfileSummary, enabled: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Surface(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.width(180.dp),
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(16.dp)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = OttlibColors.Canvas.copy(alpha = 0f),
            contentColor = OttlibColors.Foreground,
            focusedContainerColor = OttlibColors.SurfaceRaised,
            focusedContentColor = OttlibColors.Foreground,
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.08f),
    ) {
        Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            ProfileAvatar(profile, size = 112.dp)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    profile.name,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f, fill = false),
                )
                if (profile.hasPin) Icon(Icons.Filled.Lock, contentDescription = "PIN", modifier = Modifier.size(18.dp), tint = OttlibColors.Muted)
            }
        }
    }
}
