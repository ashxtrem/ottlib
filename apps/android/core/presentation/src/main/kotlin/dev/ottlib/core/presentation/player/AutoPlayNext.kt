package dev.ottlib.core.presentation.player

import dev.ottlib.core.model.Movie
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** What the ended screen shows about starting the next title by itself. */
sealed interface AutoPlayState {
    data object Off : AutoPlayState
    data class Counting(val secondsLeft: Int) : AutoPlayState
    /** Several titles in a row started by themselves, so this one waits for the viewer. */
    data object StillWatching : AutoPlayState
    /** The countdown finished: the screen should start [movieId]. */
    data class Due(val movieId: Long) : AutoPlayState
}

fun AutoPlayState.message(next: Movie): String? = when (this) {
    is AutoPlayState.Counting -> "${next.nextLabel()} starts in $secondsLeft s"
    AutoPlayState.StillWatching -> "Still watching? Auto-play paused after ${AutoPlayStreak.LIMIT} titles in a row."
    else -> null
}

/** The settings row's description of [seconds] (0 = off). */
fun autoPlaySummary(seconds: Int): String =
    if (seconds <= 0) "Off  ·  the next title waits for you"
    else "After $seconds seconds  ·  pauses after ${AutoPlayStreak.LIMIT} titles in a row"

/**
 * App-wide count of titles in a row that started by themselves, so a TV left on doesn't play a whole season to an
 * empty room. Any title the viewer starts (from a button, details or a shelf) starts the count again.
 */
class AutoPlayStreak(private val limit: Int = LIMIT) {
    private var count = 0
    private var pending = false

    val limitReached: Boolean get() = count >= limit

    fun autoPlayed() { pending = true }

    /** Called as each player opens: counts it if auto-play opened it, otherwise the viewer did. */
    fun playerOpened() {
        count = if (pending) count + 1 else 0
        pending = false
    }

    companion object {
        const val LIMIT = 3
    }
}

/**
 * The countdown to the next title (on the ended screen, or from the credits). Runs at most once per player: a cancelled
 * countdown stays off. [onDue] runs as it finishes, before [AutoPlayState.Due] is published.
 */
class AutoPlayCountdown(private val scope: CoroutineScope, private val streak: AutoPlayStreak, private val onDue: () -> Unit = {}) {
    private val current = MutableStateFlow<AutoPlayState>(AutoPlayState.Off)
    val state: StateFlow<AutoPlayState> = current.asStateFlow()
    private var started = false
    private var job: Job? = null

    /** [seconds] of 0 means auto-play is switched off. */
    fun start(nextId: Long, seconds: Int) {
        if (started || seconds <= 0) return
        started = true
        if (streak.limitReached) {
            current.value = AutoPlayState.StillWatching
            return
        }
        current.value = AutoPlayState.Counting(seconds) // at once, so callers see the countdown as started
        job = scope.launch {
            for (left in seconds downTo 1) {
                current.value = AutoPlayState.Counting(left)
                delay(1_000)
            }
            streak.autoPlayed()
            onDue()
            current.value = AutoPlayState.Due(nextId)
        }
    }

    /**
     * Stops a running countdown without ruling out a later one: the viewer left the credits early (seeked back, paused),
     * so it may start again when they reach them. A countdown the viewer cancelled, or one that finished, is left alone.
     */
    fun withdraw() {
        if (current.value !is AutoPlayState.Counting) return
        job?.cancel()
        job = null
        started = false
        current.value = AutoPlayState.Off
    }

    fun cancel() {
        started = true
        job?.cancel()
        job = null
        if (current.value is AutoPlayState.Counting) current.value = AutoPlayState.Off
    }
}
