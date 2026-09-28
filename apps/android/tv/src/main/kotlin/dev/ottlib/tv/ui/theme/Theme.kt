package dev.ottlib.tv.ui.theme

import androidx.compose.runtime.Composable
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.darkColorScheme
import dev.ottlib.core.presentation.theme.OttlibColors

private val colorScheme = darkColorScheme(
    primary = OttlibColors.Accent,
    onPrimary = OttlibColors.AccentForeground,
    primaryContainer = OttlibColors.AccentSoft,
    onPrimaryContainer = OttlibColors.Foreground,
    secondary = OttlibColors.Muted,
    onSecondary = OttlibColors.Canvas,
    background = OttlibColors.Canvas,
    onBackground = OttlibColors.Foreground,
    surface = OttlibColors.Surface,
    onSurface = OttlibColors.Foreground,
    surfaceVariant = OttlibColors.SurfaceRaised,
    onSurfaceVariant = OttlibColors.Muted,
    inverseSurface = OttlibColors.Foreground,
    inverseOnSurface = OttlibColors.Canvas,
    error = OttlibColors.Error,
    onError = OttlibColors.Canvas,
    border = OttlibColors.Border,
    borderVariant = OttlibColors.SurfaceRaised,
)

@Composable
fun OttlibTheme(content: @Composable () -> Unit) = MaterialTheme(colorScheme = colorScheme, content = content)
