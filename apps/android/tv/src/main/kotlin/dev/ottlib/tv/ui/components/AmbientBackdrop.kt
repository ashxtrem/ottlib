package dev.ottlib.tv.ui.components

import androidx.compose.animation.Crossfade
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import coil3.compose.AsyncImage
import coil3.compose.LocalPlatformContext
import coil3.request.ImageRequest
import coil3.size.Size
import dev.ottlib.core.presentation.theme.OttlibColors

/**
 * Full-screen artwork behind a screen, faded into the canvas so text on top stays readable.
 *
 * With [blurred], the image is decoded at a few dozen pixels and scaled up: the upscale looks like a soft blur on
 * every Android version (RenderEffect blur needs 12+) and costs almost nothing, so it can follow D-pad focus.
 */
@Composable
fun AmbientBackdrop(imageUrl: String?, modifier: Modifier = Modifier, blurred: Boolean = true, strength: Float = 0.35f) {
    val context = LocalPlatformContext.current
    Box(modifier.fillMaxSize()) {
        Crossfade(targetState = imageUrl, label = "backdrop") { url ->
            if (url != null) {
                val request = remember(url, blurred) {
                    ImageRequest.Builder(context).data(url).apply { if (blurred) size(Size(BlurredWidthPx, BlurredWidthPx * 3 / 2)) }.build()
                }
                // Painter alpha, not Modifier.alpha: the latter renders a full-screen offscreen layer every frame.
                AsyncImage(model = request, contentDescription = null, contentScale = ContentScale.Crop, alpha = strength, modifier = Modifier.fillMaxSize())
            }
        }
        // One full-screen scrim (fill rate is the bottleneck on TV GPUs): opaque on the left where text sits.
        Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(OttlibColors.Canvas, OttlibColors.Canvas.copy(alpha = 0.7f), OttlibColors.Canvas.copy(alpha = 0.2f)))))
    }
}

private const val BlurredWidthPx = 32
