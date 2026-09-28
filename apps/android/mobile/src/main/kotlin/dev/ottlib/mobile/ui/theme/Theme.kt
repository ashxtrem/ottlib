package dev.ottlib.mobile.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import dev.ottlib.core.presentation.theme.OttlibColors

private val colorScheme = darkColorScheme(
    primary = OttlibColors.Accent,
    onPrimary = OttlibColors.AccentForeground,
    primaryContainer = OttlibColors.AccentSoft,
    onPrimaryContainer = OttlibColors.Foreground,
    secondary = OttlibColors.Muted,
    onSecondary = OttlibColors.Canvas,
    secondaryContainer = OttlibColors.SurfaceRaised,
    onSecondaryContainer = OttlibColors.Foreground,
    background = OttlibColors.Canvas,
    onBackground = OttlibColors.Foreground,
    surface = OttlibColors.Canvas,
    onSurface = OttlibColors.Foreground,
    surfaceVariant = OttlibColors.SurfaceRaised,
    onSurfaceVariant = OttlibColors.Muted,
    surfaceContainerLowest = OttlibColors.Canvas,
    surfaceContainerLow = OttlibColors.Surface,
    surfaceContainer = OttlibColors.Surface,
    surfaceContainerHigh = OttlibColors.SurfaceRaised,
    surfaceContainerHighest = OttlibColors.SurfaceRaised,
    inverseSurface = OttlibColors.Foreground,
    inverseOnSurface = OttlibColors.Canvas,
    error = OttlibColors.Error,
    onError = OttlibColors.Canvas,
    outline = OttlibColors.Border,
    outlineVariant = OttlibColors.SurfaceRaised,
)

/** Always dark, like the TV app and the web client's dark theme. */
@Composable
fun OttlibTheme(content: @Composable () -> Unit) = MaterialTheme(colorScheme = colorScheme, content = content)
