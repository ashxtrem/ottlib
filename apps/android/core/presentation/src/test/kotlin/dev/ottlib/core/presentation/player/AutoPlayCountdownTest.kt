package dev.ottlib.core.presentation.player

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AutoPlayCountdownTest {
    private fun TestScope.countdown(streak: AutoPlayStreak = AutoPlayStreak()) =
        AutoPlayCountdown(CoroutineScope(StandardTestDispatcher(testScheduler)), streak)

    @Test
    fun countsDownEachSecondThenAsksForTheNextTitle() = runTest {
        val streak = AutoPlayStreak()
        val countdown = countdown(streak)
        countdown.start(nextId = 7, seconds = 3)
        runCurrent()
        assertEquals(AutoPlayState.Counting(3), countdown.state.value)
        advanceTimeBy(1_000); runCurrent()
        assertEquals(AutoPlayState.Counting(2), countdown.state.value)
        advanceUntilIdle()
        assertEquals(AutoPlayState.Due(7), countdown.state.value)

        streak.playerOpened()
        assertEquals(false, streak.limitReached)
    }

    @Test
    fun cancelledCountdownStaysOff() = runTest {
        val countdown = countdown()
        countdown.start(nextId = 7, seconds = 10)
        advanceTimeBy(2_000)
        countdown.cancel()
        countdown.start(nextId = 7, seconds = 10)
        advanceUntilIdle()
        assertEquals(AutoPlayState.Off, countdown.state.value)
    }

    @Test
    fun aFailedOnDueHoldsTheScreenInsteadOfMovingOn() = runTest {
        val countdown = AutoPlayCountdown(CoroutineScope(StandardTestDispatcher(testScheduler)), AutoPlayStreak()) { false }
        countdown.start(nextId = 7, seconds = 2)
        advanceUntilIdle()
        assertEquals(AutoPlayState.Off, countdown.state.value)
        countdown.start(nextId = 7, seconds = 2)
        advanceUntilIdle()
        assertEquals(AutoPlayState.Off, countdown.state.value)
    }

    @Test
    fun zeroSecondsMeansAutoPlayIsOff() = runTest {
        val countdown = countdown()
        countdown.start(nextId = 7, seconds = 0)
        advanceUntilIdle()
        assertEquals(AutoPlayState.Off, countdown.state.value)
    }

    @Test
    fun waitsForTheViewerAfterSeveralAutoPlaysInARow() = runTest {
        val streak = AutoPlayStreak(limit = 2)
        streak.playerOpened() // started by the viewer
        repeat(2) { streak.autoPlayed(); streak.playerOpened() }

        val countdown = countdown(streak)
        countdown.start(nextId = 7, seconds = 5)
        advanceUntilIdle()
        assertEquals(AutoPlayState.StillWatching, countdown.state.value)
    }

    @Test
    fun aTitleTheViewerStartsResetsTheStreak() {
        val streak = AutoPlayStreak(limit = 2)
        repeat(2) { streak.autoPlayed(); streak.playerOpened() }
        assertEquals(true, streak.limitReached)
        streak.playerOpened()
        assertEquals(false, streak.limitReached)
    }
}
