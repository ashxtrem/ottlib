package dev.ottlib.core.presentation.player

import dev.ottlib.core.model.Credits
import dev.ottlib.core.presentation.formatPosition
import dev.ottlib.core.presentation.userMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/** What the player shows about the end credits, and what the Credits panel edits. */
data class CreditsUiState(
    /** Where the credits start, or null when the server doesn't know (no pill, no early countdown). */
    val credits: Credits? = null,
    /** Whether credits are skipped for this title (the viewer's override, or their default for movies/series). */
    val autoSkip: Boolean = false,
    /** The override the viewer picked in this session's panel, or null if untouched (the server doesn't say which applies). */
    val choice: AutoSkipChoice? = null,
    /** The "Skip credits" pill is up. */
    val showSkip: Boolean = false,
    /** The up-next countdown started at the credits; the player shows it with "Watch credits". */
    val counting: Boolean = false,
    val saving: Boolean = false,
    val error: String? = null,
)

enum class AutoSkipChoice(val enabled: Boolean?, val label: String) {
    On(true, "On"),
    Off(false, "Off"),
    Default(null, "Use my default"),
}

/** The Credits panel's description of where the credits start, and how that is known. */
fun creditsSummary(credits: Credits?): String = when (credits?.source) {
    null -> "No credits found for this title  ·  mark where they start"
    "mark" -> "Credits start at ${formatPosition(credits.startMs)}  ·  marked"
    "chapter" -> "Credits start at ${formatPosition(credits.startMs)}  ·  from the chapters"
    else -> "Credits start at ${formatPosition(credits.startMs)}  ·  learned from another episode"
}

/**
 * Follows the playhead against the title's credits. With auto-skip on and a next title, the up-next countdown
 * ([AutoPlayCountdown], so its streak limit applies) starts at the credits instead of at the end; otherwise a "Skip
 * credits" pill shows while they run. Marking the title watched is the player's job, when the countdown fires or the
 * pill is pressed. Null credits change nothing.
 */
class CreditsController(
    private val scope: CoroutineScope,
    private val countdown: AutoPlayCountdown,
    private val upcoming: () -> Long?,
    private val autoPlaySeconds: () -> Int,
    private val saveMark: suspend (startMs: Long?) -> Credits?,
    private val saveAutoSkip: suspend (enabled: Boolean?) -> Boolean,
) {
    private val current = MutableStateFlow(CreditsUiState())
    val state: StateFlow<CreditsUiState> = current.asStateFlow()
    private var position: Long? = null
    private var playing = false
    /** Back on the pill: it stays away for the rest of this title. */
    private var dismissed = false
    /** "Watch credits": no countdown and no pill; the end screen takes over as usual. */
    private var watching = false
    /** Skipped or ended: nothing more to show, and the end screen owns the countdown. */
    private var finished = false
    private var follower: Job? = null

    fun load(credits: Credits?, autoSkip: Boolean) {
        current.update { it.copy(credits = credits, autoSkip = autoSkip) }
        evaluate()
    }

    /** Samples the playhead (position, playing) every [intervalMs] until [stop]; null while there is no player. */
    fun follow(intervalMs: Long = FOLLOW_INTERVAL_MS, sample: () -> Pair<Long, Boolean>?) {
        follower?.cancel()
        follower = scope.launch {
            while (isActive) {
                sample()?.let { (at, isPlaying) -> onPosition(at, isPlaying) }
                delay(intervalMs)
            }
        }
    }

    fun stop() {
        follower?.cancel()
        follower = null
    }

    fun onPosition(positionMs: Long, isPlaying: Boolean) {
        position = positionMs
        playing = isPlaying
        evaluate()
    }

    fun watchCredits() {
        watching = true
        countdown.cancel()
        evaluate()
    }

    fun dismiss() {
        dismissed = true
        evaluate()
    }

    /** The pill was pressed, the countdown fired, or the title ended. */
    fun finish() {
        finished = true
        stop()
        evaluate()
    }

    fun mark(positionMs: Long) = edit { current.update { it.copy(credits = saveMark(positionMs.coerceAtLeast(0))) } }

    fun clearMark() = edit { current.update { it.copy(credits = saveMark(null)) } }

    fun chooseAutoSkip(choice: AutoSkipChoice) = edit {
        val enabled = saveAutoSkip(choice.enabled)
        current.update { it.copy(autoSkip = enabled, choice = choice) }
    }

    private fun edit(change: suspend () -> Unit) {
        current.update { it.copy(saving = true, error = null) }
        scope.launch {
            try {
                change()
                current.update { it.copy(saving = false) }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                current.update { it.copy(saving = false, error = "Couldn't save: ${error.userMessage()}") }
            }
            evaluate()
        }
    }

    private fun evaluate() {
        val shown = current.value
        val start = shown.credits?.startMs
        val at = position
        val inCredits = !finished && start != null && at != null && at >= start
        val nextId = upcoming()
        val seconds = autoPlaySeconds()
        val countdownWanted = inCredits && shown.autoSkip && nextId != null && seconds > 0 && !watching
        when {
            countdownWanted && playing -> countdown.start(nextId!!, seconds)
            // Paused or back before the credits: stop counting, and count again when they play on.
            !finished -> countdown.withdraw()
        }
        val countdownOwnsCredits = countdownWanted && countdown.state.value !is AutoPlayState.StillWatching
        current.update {
            it.copy(
                showSkip = inCredits && !countdownOwnsCredits && !dismissed && !watching,
                counting = !finished && countdown.state.value is AutoPlayState.Counting,
            )
        }
    }

    private companion object {
        const val FOLLOW_INTERVAL_MS = 500L
    }
}
