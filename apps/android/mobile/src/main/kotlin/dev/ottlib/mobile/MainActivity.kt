package dev.ottlib.mobile

import android.app.PictureInPictureParams
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import dev.ottlib.mobile.navigation.OttlibNavHost
import dev.ottlib.mobile.ui.theme.OttlibTheme

class MainActivity : ComponentActivity() {
    /**
     * Set by the player while a video is playing. Android 12+ enters picture-in-picture by itself (the params'
     * auto-enter flag); older versions need [onUserLeaveHint].
     */
    var pictureInPictureOnLeave: PictureInPictureParams? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)
        setContent { OttlibTheme { OttlibNavHost() } }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        val params = pictureInPictureOnLeave ?: return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) enterPictureInPictureMode(params)
    }
}
