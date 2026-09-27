package dev.ottlib.tv.playback

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri

/**
 * Hands the stream to another installed player (e.g. VLC) — the escape hatch for formats the built-in
 * player can't handle, like styled ASS subtitles. Returns false when no app can play it.
 */
fun openInExternalPlayer(context: Context, streamUrl: String, title: String): Boolean {
    val intent = Intent(Intent.ACTION_VIEW)
        .setDataAndType(Uri.parse(streamUrl), "video/*")
        .putExtra("title", title)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return try {
        context.startActivity(Intent.createChooser(intent, "Play with").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
    } catch (_: ActivityNotFoundException) {
        false
    }
}
