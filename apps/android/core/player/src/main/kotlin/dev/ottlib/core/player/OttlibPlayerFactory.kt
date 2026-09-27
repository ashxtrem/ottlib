@file:OptIn(UnstableApi::class)

package dev.ottlib.core.player

import android.content.Context
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import io.github.anilbeesetti.nextlib.media3ext.ffdecoder.NextRenderersFactory
import okhttp3.OkHttpClient

/**
 * Per-viewer player settings. Language codes as the server reports them (`eng`, `hin`); a null subtitle language
 * means off (forced subtitles still show). Skip steps drive the ⏪/⏩ buttons and the seek bar.
 */
data class PlayerSettings(
    val audioLanguage: String? = null,
    val subtitleLanguage: String? = null,
    val skipBackMs: Long = 10_000,
    val skipForwardMs: Long = 10_000,
)

object PlayerDefaults {
    // Large LAN buffers smooth over Wi-Fi dips on high-bitrate 4K remuxes; bytes are still capped by the default target.
    const val MIN_BUFFER_MS = 30_000
    const val MAX_BUFFER_MS = 90_000
    const val START_BUFFER_MS = 2_500
    const val REBUFFER_MS = 5_000
}

/** Builds the ExoPlayer used for direct play of files streamed from `/api/stream/:id`. */
class OttlibPlayerFactory(private val context: Context, private val httpClient: OkHttpClient) {
    fun create(settings: PlayerSettings): ExoPlayer {
        val dataSource = DefaultDataSource.Factory(context, OkHttpDataSource.Factory(httpClient))
        // Platform decoders first; FFmpeg only for formats the device cannot decode (e.g. DTS, TrueHD).
        val renderers = NextRenderersFactory(context).setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_ON)
        val trackSelector = DefaultTrackSelector(context).apply { parameters = trackParameters(this, settings) }
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(PlayerDefaults.MIN_BUFFER_MS, PlayerDefaults.MAX_BUFFER_MS, PlayerDefaults.START_BUFFER_MS, PlayerDefaults.REBUFFER_MS)
            .build()
        return ExoPlayer.Builder(context, renderers)
            .setMediaSourceFactory(DefaultMediaSourceFactory(dataSource))
            .setTrackSelector(trackSelector)
            .setLoadControl(loadControl)
            .setSeekBackIncrementMs(settings.skipBackMs)
            .setSeekForwardIncrementMs(settings.skipForwardMs)
            .setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).build(), true)
            .setHandleAudioBecomingNoisy(true)
            .setVideoChangeFrameRateStrategy(C.VIDEO_CHANGE_FRAME_RATE_STRATEGY_ONLY_IF_SEAMLESS)
            .build()
    }

    private fun trackParameters(selector: DefaultTrackSelector, preferences: PlayerSettings) = selector.buildUponParameters().apply {
        setPreferredAudioLanguage(preferences.audioLanguage)
        if (preferences.subtitleLanguage == null) {
            setPreferredTextLanguage(null)
            setIgnoredTextSelectionFlags(C.SELECTION_FLAG_DEFAULT)
        } else {
            setPreferredTextLanguage(preferences.subtitleLanguage)
            setSelectUndeterminedTextLanguage(false)
        }
    }.build()
}
