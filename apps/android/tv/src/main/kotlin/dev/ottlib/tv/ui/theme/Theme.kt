package dev.ottlib.tv.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.darkColorScheme

/** The web client's dark palette (packages/client/src/styles.css, `:root.dark`). */
object OttlibColors {
    val Canvas = Color(0xFF020617)
    val Surface = Color(0xFF0F172A)
    val SurfaceRaised = Color(0xFF1E293B)
    val Border = Color(0xFF334155)
    val Foreground = Color(0xFFF1F5F9)
    val Muted = Color(0xFF94A3B8)
    val Accent = Color(0xFF22D3EE)
    val AccentForeground = Color(0xFF020617)
    val AccentSoft = Color(0xFF083344)
    val Success = Color(0xFF34D399)
    val Error = Color(0xFFFB7185)
    val Warning = Color(0xFFFBBF24)
}

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
