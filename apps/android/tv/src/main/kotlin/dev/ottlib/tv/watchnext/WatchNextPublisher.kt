package dev.ottlib.tv.watchnext

import android.annotation.SuppressLint
import android.content.Context
import android.net.Uri
import androidx.tvprovider.media.tv.TvContractCompat
import androidx.tvprovider.media.tv.WatchNextProgram
import dev.ottlib.core.presentation.ContinueWatchingEntry
import dev.ottlib.core.presentation.ContinueWatchingPublisher

/**
 * Mirrors in-progress titles into the Android TV "Watch Next" row, keyed by movie id. Best effort:
 * launchers that don't expose the TV provider simply ignore it. Call from a background thread.
 */
class WatchNextPublisher(context: Context) : ContinueWatchingPublisher {
    private val resolver = context.applicationContext.contentResolver

    override fun upsert(entry: ContinueWatchingEntry) = safely {
        val program = WatchNextProgram.Builder()
            .setType(TvContractCompat.WatchNextPrograms.TYPE_MOVIE)
            .setWatchNextType(TvContractCompat.WatchNextPrograms.WATCH_NEXT_TYPE_CONTINUE)
            .setLastEngagementTimeUtcMillis(System.currentTimeMillis())
            .setLastPlaybackPositionMillis(entry.positionMs.coerceAtMost(Int.MAX_VALUE.toLong()).toInt())
            .setDurationMillis(entry.durationMs.coerceAtMost(Int.MAX_VALUE.toLong()).toInt())
            .setTitle(entry.title)
            .apply { entry.posterUrl?.let { setPosterArtUri(Uri.parse(it)) } }
            .setPosterArtAspectRatio(TvContractCompat.PreviewProgramColumns.ASPECT_RATIO_2_3)
            .setIntentUri(Uri.parse("ottlib://movie/${entry.movieId}"))
            .setInternalProviderId(entry.movieId.toString())
            .build()
        val existing = programId(entry.movieId)
        if (existing == null) resolver.insert(TvContractCompat.WatchNextPrograms.CONTENT_URI, program.toContentValues())
        else resolver.update(TvContractCompat.buildWatchNextProgramUri(existing), program.toContentValues(), null, null)
    }

    override fun remove(movieId: Long) = safely {
        programId(movieId)?.let { resolver.delete(TvContractCompat.buildWatchNextProgramUri(it), null, null) }
    }

    @SuppressLint("RestrictedApi")
    private fun programId(movieId: Long): Long? =
        resolver.query(TvContractCompat.WatchNextPrograms.CONTENT_URI, WatchNextProgram.PROJECTION, null, null, null)?.use { cursor ->
            while (cursor.moveToNext()) {
                val program = WatchNextProgram.fromCursor(cursor)
                if (program.internalProviderId == movieId.toString()) return@use program.id
            }
            null
        }

    private inline fun safely(block: () -> Unit) {
        try { block() } catch (_: Exception) { /* No TV provider or permission on this launcher. */ }
    }
}
