package dev.ottlib.core.presentation.player

import dev.ottlib.core.model.Credits
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CreditsControllerTest {
    private val credits = Credits(startMs = 90_000, source = "chapter")
    private var nextId: Long? = 7
    private var seconds = 10
    private val marks = mutableListOf<Long?>()
    private val overrides = mutableListOf<Boolean?>()

    private class Setup(val controller: CreditsController, val countdown: AutoPlayCountdown)

    private fun TestScope.setup(autoSkip: Boolean, streak: AutoPlayStreak = AutoPlayStreak(), loaded: Credits? = credits): Setup {
        val scope = CoroutineScope(StandardTestDispatcher(testScheduler))
        val countdown = AutoPlayCountdown(scope, streak)
        val controller = CreditsController(scope, countdown, { nextId }, { seconds },
            saveMark = { startMs -> marks += startMs; startMs?.let { Credits(it, "mark") } },
            saveAutoSkip = { enabled -> overrides += enabled; enabled ?: false })
        controller.load(loaded, autoSkip)
        return Setup(controller, countdown)
    }

    @Test
    fun nothingHappensBeforeTheCredits() = runTest {
        val (controller, countdown) = setup(autoSkip = true).let { it.controller to it.countdown }
        controller.onPosition(89_000, isPlaying = true)
        runCurrent()
        assertFalse(controller.state.value.showSkip)
        assertFalse(controller.state.value.counting)
        assertEquals(AutoPlayState.Off, countdown.state.value)
    }

    @Test
    fun autoSkipWithANextTitleStartsTheCountdownAtTheCreditsAndWatchCreditsCancelsIt() = runTest {
        val (controller, countdown) = setup(autoSkip = true).let { it.controller to it.countdown }
        controller.onPosition(90_000, isPlaying = true)
        runCurrent()
        assertEquals(AutoPlayState.Counting(10), countdown.state.value)
        assertTrue(controller.state.value.counting)
        assertFalse(controller.state.value.showSkip)

        controller.watchCredits()
        controller.onPosition(95_000, isPlaying = true)
        runCurrent()
        assertEquals(AutoPlayState.Off, countdown.state.value)
        assertFalse(controller.state.value.counting)
        assertFalse(controller.state.value.showSkip)

        // The title ends: the end screen counts down as usual.
        controller.finish()
        countdown.start(7, seconds)
        runCurrent()
        assertEquals(AutoPlayState.Counting(10), countdown.state.value)
    }

    @Test
    fun pausingInTheCreditsWithdrawsTheCountdownAndPlayingRestartsItAtFull() = runTest {
        val (controller, countdown) = setup(autoSkip = true).let { it.controller to it.countdown }
        controller.onPosition(90_000, isPlaying = true)
        advanceTimeBy(3_000); runCurrent()
        assertTrue(countdown.state.value is AutoPlayState.Counting)

        controller.onPosition(93_000, isPlaying = false)
        advanceTimeBy(15_000); runCurrent()
        controller.onPosition(93_000, isPlaying = false)
        runCurrent()
        assertEquals(AutoPlayState.Off, countdown.state.value)
        assertFalse(controller.state.value.counting)

        controller.onPosition(93_000, isPlaying = true)
        runCurrent()
        assertEquals(AutoPlayState.Counting(10), countdown.state.value)
    }

    @Test
    fun anOpenPanelHoldsTheCountdownUntilItCloses() = runTest {
        val (controller, countdown) = setup(autoSkip = true).let { it.controller to it.countdown }
        controller.onPosition(90_000, isPlaying = true)
        runCurrent()
        controller.hold(true)
        advanceTimeBy(15_000); runCurrent()
        assertEquals(AutoPlayState.Off, countdown.state.value)

        controller.hold(false)
        runCurrent()
        assertEquals(AutoPlayState.Counting(10), countdown.state.value)
    }

    @Test
    fun theCountdownFiresTheNextTitle() = runTest {
        val (controller, countdown) = setup(autoSkip = true).let { it.controller to it.countdown }
        seconds = 3
        controller.onPosition(90_000, isPlaying = true)
        advanceTimeBy(3_500); runCurrent()
        assertEquals(AutoPlayState.Due(7), countdown.state.value)
    }

    @Test
    fun seekingBackOutOfTheCreditsWithdrawsTheCountdownUntilTheyPlayAgain() = runTest {
        val (controller, countdown) = setup(autoSkip = true).let { it.controller to it.countdown }
        controller.onPosition(90_000, isPlaying = true)
        advanceTimeBy(2_000); runCurrent()
        controller.onPosition(30_000, isPlaying = true)
        runCurrent()
        assertEquals(AutoPlayState.Off, countdown.state.value)
        controller.onPosition(91_000, isPlaying = true)
        runCurrent()
        assertEquals(AutoPlayState.Counting(10), countdown.state.value)
        controller.onPosition(92_000, isPlaying = false)
        assertEquals(AutoPlayState.Off, countdown.state.value)
        assertFalse(controller.state.value.showSkip)
    }

    @Test
    fun autoSkipWithNothingNextShowsTheSkipPill() = runTest {
        nextId = null
        val (controller, countdown) = setup(autoSkip = true).let { it.controller to it.countdown }
        controller.onPosition(90_000, isPlaying = true)
        runCurrent()
        assertTrue(controller.state.value.showSkip)
        assertEquals(AutoPlayState.Off, countdown.state.value)

        controller.finish()
        assertFalse(controller.state.value.showSkip)
    }

    @Test
    fun autoSkipOffShowsTheSkipPillDuringTheCreditsAndBackDismissesIt() = runTest {
        val (controller, countdown) = setup(autoSkip = false).let { it.controller to it.countdown }
        controller.onPosition(90_000, isPlaying = true)
        runCurrent()
        assertTrue(controller.state.value.showSkip)
        assertEquals(AutoPlayState.Off, countdown.state.value)

        controller.dismiss()
        controller.onPosition(100_000, isPlaying = true)
        assertFalse(controller.state.value.showSkip)
    }

    @Test
    fun afterThreeTitlesInARowTheCountdownWaitsAndThePillShows() = runTest {
        val streak = AutoPlayStreak()
        repeat(AutoPlayStreak.LIMIT) { streak.autoPlayed(); streak.playerOpened() }
        val (controller, countdown) = setup(autoSkip = true, streak = streak).let { it.controller to it.countdown }
        controller.onPosition(90_000, isPlaying = true)
        runCurrent()
        assertEquals(AutoPlayState.StillWatching, countdown.state.value)
        assertTrue(controller.state.value.showSkip)
        assertFalse(controller.state.value.counting)
    }

    @Test
    fun nullCreditsKeepTodaysBehaviour() = runTest {
        val (controller, countdown) = setup(autoSkip = true, loaded = null).let { it.controller to it.countdown }
        controller.onPosition(10_000_000, isPlaying = true)
        runCurrent()
        assertFalse(controller.state.value.showSkip)
        assertEquals(AutoPlayState.Off, countdown.state.value)
    }

    @Test
    fun markClearAndOverrideGoToTheServer() = runTest {
        val controller = setup(autoSkip = false, loaded = null).controller
        controller.mark(80_000)
        runCurrent()
        assertEquals(Credits(80_000, "mark"), controller.state.value.credits)
        controller.chooseAutoSkip(AutoSkipChoice.On)
        runCurrent()
        assertTrue(controller.state.value.autoSkip)
        assertEquals(AutoSkipChoice.On, controller.state.value.choice)
        controller.clearMark()
        runCurrent()
        assertNull(controller.state.value.credits)
        controller.chooseAutoSkip(AutoSkipChoice.Default)
        runCurrent()
        assertEquals(listOf<Long?>(80_000, null), marks)
        assertEquals(listOf<Boolean?>(true, null), overrides)
        assertFalse(controller.state.value.saving)
    }

    @Test
    fun aFailedSaveIsReported() = runTest {
        val scope = CoroutineScope(StandardTestDispatcher(testScheduler))
        val controller = CreditsController(scope, AutoPlayCountdown(scope, AutoPlayStreak()), { null }, { 0 },
            saveMark = { error("offline") }, saveAutoSkip = { false })
        controller.mark(1_000)
        runCurrent()
        assertTrue(controller.state.value.error != null)
        assertFalse(controller.state.value.saving)
    }
}
