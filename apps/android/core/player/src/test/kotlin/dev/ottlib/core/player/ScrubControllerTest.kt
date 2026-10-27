package dev.ottlib.core.player

import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.SeekParameters
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.lang.reflect.Proxy

class ScrubControllerTest {
    private class FakeTarget : ScrubTarget {
        val calls = mutableListOf<String>()
        override fun fastSeeking(enabled: Boolean) { calls += "fast:$enabled" }
        override fun seekTo(positionMs: Long) { calls += "seek:$positionMs" }
        val seeks get() = calls.filter { it.startsWith("seek:") }
    }

    /** A manual clock and scheduler: [advance] runs whatever falls due. */
    private class Time : ScrubScheduler {
        var now = 1_000L
        private val tasks = mutableListOf<Pair<Long, () -> Unit>>()
        override fun schedule(delayMs: Long, action: () -> Unit): () -> Unit {
            val task = (now + delayMs) to action
            tasks += task
            return { tasks.remove(task) }
        }
        fun advance(ms: Long) {
            now += ms
            tasks.filter { it.first <= now }.forEach { tasks.remove(it); it.second() }
        }
        val pending get() = tasks.size
    }

    private val target = FakeTarget()
    private val time = Time()
    private val frames = mutableListOf<String?>()

    private fun controller(server: Boolean) = ScrubController(
        target,
        frameUrl = { if (server) framePreviewPath("/api/movies/1/frame?key=k", it) else null },
        onFrame = { frames += it },
        clock = { time.now },
        scheduler = time,
    )

    @Test fun directPlaySeeksLiveAtMostOncePer150ms() {
        val scrub = controller(server = false)
        scrub.begin()
        scrub.scrubTo(10_000)
        time.advance(50); scrub.scrubTo(11_000)
        time.advance(50); scrub.scrubTo(12_000)
        assertEquals(listOf("fast:true", "seek:10000"), target.calls)
        time.advance(50) // 150 ms after the first seek: the latest position is applied
        assertEquals(listOf("seek:10000", "seek:12000"), target.seeks)
        assertEquals(0, time.pending)
        time.advance(200); scrub.scrubTo(20_000)
        assertEquals("seek:20000", target.calls.last())
        assertTrue(frames.isEmpty())
    }

    @Test fun releaseRestoresDefaultSeekingThenSeeksExactlyOnce() {
        val scrub = controller(server = false)
        scrub.begin()
        scrub.scrubTo(10_000)
        time.advance(10); scrub.scrubTo(15_000)
        scrub.end(16_000)
        assertEquals(listOf("fast:true", "seek:10000", "fast:false", "seek:16000"), target.calls)
        assertFalse(scrub.scrubbing)
        time.advance(500) // the dropped trailing seek never fires
        assertEquals("seek:16000", target.calls.last())
    }

    @Test fun serverSessionShowsFramesAndSeeksOnlyOnRelease() {
        val scrub = controller(server = true)
        scrub.begin()
        scrub.scrubTo(10_100)
        time.advance(150); scrub.scrubTo(10_900) // same 2 s step: no new request
        time.advance(150); scrub.scrubTo(13_200)
        time.advance(20); scrub.scrubTo(15_000) // throttled, then applied when the interval is up
        time.advance(130)
        assertEquals(
            listOf("/api/movies/1/frame?key=k&t=10000", "/api/movies/1/frame?key=k&t=14000", "/api/movies/1/frame?key=k&t=16000"),
            frames,
        )
        assertTrue(target.calls.isEmpty())
        scrub.end(15_000)
        assertEquals(listOf("seek:15000"), target.calls)
        assertEquals(null, frames.last())
    }

    @Test fun framePathsRoundToTwoSecondSteps() {
        assertEquals("/api/movies/1/frame?&t=0", framePreviewPath("/api/movies/1/frame?", 999))
        assertEquals("/api/movies/1/frame?&t=2000", framePreviewPath("/api/movies/1/frame?", 1_000))
        assertEquals("/api/movies/1/frame?&t=0", framePreviewPath("/api/movies/1/frame?", -500))
    }

    @Test fun exoTargetUsesScrubbingModeAndPutsSeekParametersBack() {
        val calls = mutableListOf<String>()
        var parameters = SeekParameters.DEFAULT
        val exo = Proxy.newProxyInstance(ExoPlayer::class.java.classLoader, arrayOf(ExoPlayer::class.java)) { _, method, args ->
            when (method.name) {
                "getSeekParameters" -> parameters
                "setSeekParameters" -> { parameters = args!![0] as SeekParameters; calls += "params"; null }
                "setScrubbingModeEnabled" -> { calls += "scrubbing:${args!![0]}"; parameters = SeekParameters.CLOSEST_SYNC; null }
                "seekTo" -> { calls += "seek:${args!!.last()}"; null }
                else -> error("Unexpected player call: ${method.name}")
            }
        } as ExoPlayer
        val target = ExoScrubTarget(exo)
        target.fastSeeking(true)
        target.seekTo(5_000)
        target.fastSeeking(false)
        target.seekTo(6_000)
        assertEquals(listOf("scrubbing:true", "seek:5000", "scrubbing:false", "params", "seek:6000"), calls)
        assertEquals(SeekParameters.DEFAULT, parameters)
    }
}
