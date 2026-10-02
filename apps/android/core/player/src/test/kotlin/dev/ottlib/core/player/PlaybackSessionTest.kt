package dev.ottlib.core.player

import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.lang.reflect.Proxy

class PlaybackSessionTest {
    private class DecoderPlayer(var state: Int = Player.STATE_ENDED) {
        val listeners = mutableListOf<Player.Listener>()
        var decoderOccupied = true
        var releaseCount = 0
        val player = Proxy.newProxyInstance(ExoPlayer::class.java.classLoader, arrayOf(ExoPlayer::class.java)) { _, method, args ->
            check(decoderOccupied) { "Accessed the previous player after release: ${method.name}" }
            when (method.name) {
                "addListener" -> { listeners.add(args!![0] as Player.Listener); null }
                "removeListener" -> { listeners.remove(args!![0] as Player.Listener); null }
                "getPlaybackState" -> state
                "getDuration" -> 1_000_000L
                "getCurrentPosition" -> 150_000L
                "release" -> { decoderOccupied = false; releaseCount++; null }
                else -> error("Unexpected player call: ${method.name}")
            }
        } as ExoPlayer
    }

    private fun session(fake: DecoderPlayer, scope: CoroutineScope, save: suspend (Long, Long) -> Unit = { _, _ -> }): PlaybackSession =
        PlaybackSession(fake.player, object : Player.Listener {}, ProgressReporter(fake.player, scope, scope, null, save = save), TrackMemory(fake.player, null) {})

    @Test fun decoderAndAllListenersAreReleasedBeforeTheNextTitleStarts() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val previous = DecoderPlayer()
            val session = session(previous, scope)
            assertEquals(3, previous.listeners.size)
            session.release() // End-screen navigation happens only after this returns.
            assertFalse("The next title needs the decoder freed before Navigation clears the old ViewModel", previous.decoderOccupied)
            assertTrue(previous.listeners.isEmpty())
            // The old ViewModel is cleared later, after the navigation transition finishes.
            session.release()
            assertEquals(1, previous.releaseCount)
        } finally { scope.cancel() }
    }

    @Test fun leavingMidPlaybackCapturesTheFinalPositionBeforeReleasingThePlayer() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val previous = DecoderPlayer(Player.STATE_READY)
            var saved: Pair<Long, Long>? = null
            val session = session(previous, scope) { position, duration ->
                assertTrue(previous.decoderOccupied)
                saved = position to duration
            }
            session.release()
            assertEquals(150_000L to 1_000_000L, saved)
            assertFalse(previous.decoderOccupied)
        } finally { scope.cancel() }
    }

    @Test fun releasingAFinishedTitleDoesNotWriteAnotherResumePosition() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val previous = DecoderPlayer()
            var saves = 0
            val session = session(previous, scope) { _, _ -> saves++ }
            session.release()
            assertEquals(0, saves)
            assertEquals(1, previous.releaseCount)
        } finally { scope.cancel() }
    }
}
