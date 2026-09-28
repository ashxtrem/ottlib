package dev.ottlib.mobile.ui.player

import android.content.pm.ActivityInfo
import androidx.activity.compose.LocalActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalConfiguration
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

/**
 * Hides the system bars while the player is open (a swipe from the edge shows them briefly), and turns phone-sized
 * screens sideways. Large screens — the Fold's inner display, tablets — keep whatever way the viewer holds them:
 * the near-square inner screen letterboxes either way, and Android 16 ignores orientation requests there anyway.
 */
@Composable
fun FullscreenEffect(inPictureInPicture: Boolean) {
    val activity = LocalActivity.current ?: return
    DisposableEffect(activity) {
        val controller = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.hide(WindowInsetsCompat.Type.systemBars())
        onDispose { controller.show(WindowInsetsCompat.Type.systemBars()) }
    }

    val phoneSized = LocalConfiguration.current.smallestScreenWidthDp < LARGE_SCREEN_DP
    DisposableEffect(activity, phoneSized, inPictureInPicture) {
        // The picture-in-picture window's own (tiny) size says nothing about the screen; leave orientation alone.
        if (inPictureInPicture) return@DisposableEffect onDispose { }
        activity.requestedOrientation = if (phoneSized) ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE else ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        onDispose { activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED }
    }
}

private const val LARGE_SCREEN_DP = 600
