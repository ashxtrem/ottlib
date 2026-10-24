# HLS false end: keep sessions alive and stop trusting an early `ended`

Approved by the user (2026-10-24: "Approved").
Issue: #23

Bug from the user (2026-10-24): on iPad, the web player said a 23:02 episode was over at 12:32. They had to go back and
play it again.

## 1. Why

RCA from the server log (`data/logs/server-startup.log`), the library DB and a reproduction with the real ffmpeg and
the real `TranscodeSessionService`:

- **Safari loads far ahead, then goes quiet longer than the idle timeout.** iPad Safari's native HLS loads segments about
  150 s past the play position, then sends no requests for 111–140 s. The server counts only segment and init requests
  as activity (`packages/server/src/services/hls/hlsSession.ts:75,85,101`), and the sweep deletes a session idle for 45 s
  (`packages/server/src/config/transcode.ts:49`, `transcodeSessionService.ts:146-150`). Playing or paused makes no
  difference. Nothing on the client keeps the session alive (the progress PUT every 10 s doesn't touch it).
- **A deleted session gives a 404 for every remaining segment, and Safari calls that the end.** The playlist is a
  complete VOD playlist with `#EXT-X-ENDLIST` (`hlsPlaylist.ts:11,20`). With the session gone, `get()` throws
  `SessionNotFoundError` → 404 (`routes/hls.ts:16-21`). Safari asks for every remaining segment in about 10 ms steps
  (≈450 404s at 16:38:27Z), then fires `ended` with `currentTime` still at the play position. A server restart has the
  same effect, because sessions are in memory only (16:53:57Z in the log).
- **The web player believes `ended` without checking.** `usePlaybackProgress.ts:45` → `progressSchedule.ts:23` posts
  `/complete`, which marks the title watched and clears the resume point (`playbackProgressService.ts:36-45`).
  `useVideoState.ts:29` (`ended = video.ended`) starts the up-next countdown (`useUpNext.ts:40-52`), which moves on to the
  next episode. The reopen-on-failure path that exists for exactly this case (a session reaped while paused,
  `WatchPage.tsx:78-94`) never runs, because Safari fires `ended`, not `error`.
- **Incident (KAI 071, movie 302, transcode, 346 × 4 s segments):** false ends at 6:16, 11:51 (server restart), 12:18
  and 12:23. The first one moved on to E20. `playback_history` rows 28–33 have `completed = 1`. The reproduction found
  that every segment in those windows is produced and maps to the plan (0 timeouts, 0 boundary mismatches), so the
  transcode itself is fine.

## 2. Decisions

User (2026-10-24):
- **Guard against a false `ended` on the web player.** Fixes every cause, including server restarts.
- **Keep-alive ping from the watch page** while it is open (playing or paused).
- **Silent reopen** at the same position when the guard catches a false end. If the reopen fails too, show the existing
  playback-failure screen.
- **Out of scope:** the Android "Play via server" ping, and the history `method` label (web plays are recorded as
  `android_app`, `playbackHistoryService.ts:37`).

My calls:
- **The guard applies to HLS sources only.** A direct stream that ends early really did end (a truncated file), so it
  keeps today's behaviour.
- **What counts as the real end:** `positionMs >= durationMs - 15_000`, using the API's `source.durationMs` (ffprobe).
  15 s covers a short last segment and probe drift. A false end in the last 15 s is harmless, because the watched rule is
  already 92%.
- **No loop on a file shorter than its probed duration:** a second `ended` within 5 s of the previous false end's
  position counts as real.
- **Reuse the existing reopen path** (`onPlaybackError('media')`, `WatchPage.tsx:87-94`), with no new failure reason.
  Its once-flag resets on `playing`, so each separate false end recovers once.
- **Keep-alive every 15 s, idle timeout stays 45 s.** That allows three missed pings, and a closed tab still frees its
  transcode slot (max 3) within about a minute. Rejected: raising the idle timeout to a few minutes (dead sessions keep
  ffmpeg slots, and a long pause still dies).
- **The ping's errors are ignored.** If the session is already gone, the guard recovers when Safari ends.
- **No contract change:** the client already has `sessionUrl` (`packages/shared/src/playback.ts:58`). The ping is
  `POST <sessionUrl>/keepalive`. No fixture or Kotlin change, and no `apiVersion` bump.

## 3. Server: keep-alive route

- `hlsSession.ts`: make `touch()` (`:101`) public.
- `transcodeSessionService.ts`: add `touch(movieId, sessionId)`, which does `get()` (`:154-158`, throws
  `SessionNotFoundError`) and then `session.touch()`.
- `routes/hls.ts`: add `keepalive: '/api/hls/:id/:sessionId/keepalive'` to `hlsRoutes` (`:7-12`) and register
  `POST` after the DELETE (`:47-49`). It replies 204, or 404 through the existing error map. It uses the same auth as the
  session DELETE (it isn't a stream-key route, `authGuard.ts:12-14`).

## 4. Client: false-end guard

- New `packages/client/src/utils/playbackEnd.ts` (pure): `END_TOLERANCE_MS = 15_000`, `REPEAT_END_WINDOW_MS = 5_000`, and
  `isRealEnd(positionMs, guardDurationMs, lastFalseEndMs)`. It returns true when `guardDurationMs` is null, not finite or
  ≤ 0, when the position is within the tolerance of the end, or when `lastFalseEndMs` is within the repeat window of the
  position.
- `WatchPage.tsx`: compute `endGuardMs = source?.kind === 'hls' ? source.durationMs ?? null : null` and pass it to
  `useVideoState`, `usePlaybackProgress` and `VideoSurface`. Keep the last false-end position in a ref that a source
  change for a new movie resets. It goes to the three consumers, or they get one shared helper. The builder picks the
  smallest shape.
- `usePlaybackProgress.ts`: `onEnded` (`:45`) sends `'ended'` only on a real end. `ended` passed to `progressAction` is
  `video.ended && real end`.
- `useVideoState.ts`: `ended` (`:29`) is `video.ended && real end`, so up-next doesn't start on a false end.
- `VideoSurface.tsx`: add an `ended` listener for HLS sources. On a false end it records the position and calls
  `onPlaybackError('media')`, so WatchPage reopens at `video.currentTime` (`WatchPage.tsx:70-74`).

## 5. Client: keep-alive

- New `packages/client/src/utils/sessionKeepAlive.ts` (pure, injectable timer and post):
  `SESSION_KEEPALIVE_MS = 15_000`, and `startSessionKeepAlive(sessionUrl, deps) → stop()`. It posts
  `${sessionUrl}/keepalive` every interval and swallows errors.
- `usePlaybackSource.ts`: start it when a source with `sessionUrl` is loaded (effect `:28-49`). Stop it in the same
  cleanup that DELETEs the session (`:44-47`) and on `pagehide` (`:52`). The `pageshow` restore (`:54`) starts it again
  through the new source.

## 6. Tests to change or add

- `transcodeSessionService.test.ts`: a touch keeps a session past the sweep (clock +44 s, touch, +44 s, sweep → still
  open; +46 s more → swept). Touching an unknown session throws `SessionNotFoundError`.
- `routes/hls.test.ts`: `POST …/keepalive` → 204 for an open session, 404 for an unknown one.
- `utils/playbackEnd.test.ts`: mid-file → false; within 15 s of the end → true; null or NaN duration → true; a repeat
  within 5 s of the last false end → true; outside the window → false.
- `utils/sessionKeepAlive.test.ts`: posts to `<sessionUrl>/keepalive` every 15 s (fake timer). `stop()` ends the posts.
  A rejected post doesn't throw.
- Unchanged: `progressSchedule.test.ts:16-20` (the guard sits before `send('ended')`). The existing sweep test
  (`transcodeSessionService.test.ts:131-142`) stays as it is. `sessionUrl` keeps its shape, so `playbackPlanner.test.ts`,
  `nativeClient.test.ts` and the contract fixtures don't change. If `VideoState` changes shape, `PlayerControls.tsx:6`
  imports it.

## 7. Tasks

| Task | Files | Spec | Depends on | Checks |
|---|---|---|---|---|
| T1 Server keep-alive route | `packages/server/src/services/hls/hlsSession.ts`, `transcodeSessionService.ts`, `transcodeSessionService.test.ts`, `routes/hls.ts`, `routes/hls.test.ts` | full | – | `POST /api/hls/:id/:sessionId/keepalive` returns 204 and resets the idle clock; unknown session → 404; sweep test with touch passes; `npx vitest run` in `packages/server` green |
| T2 Web false-end guard | `packages/client/src/utils/playbackEnd.ts` (+test), `pages/WatchPage.tsx`, `hooks/usePlaybackProgress.ts`, `hooks/useVideoState.ts`, `components/player/VideoSurface.tsx` | full | – | an `ended` mid-file on an HLS source posts no `/complete`, doesn't start up-next and reopens at `currentTime`; a real end (within 15 s) and every direct-stream end behave as today; a repeat false end within 5 s counts as real; `playbackEnd.test.ts` green; client `tsc` and vitest green |
| T3 Web keep-alive | `packages/client/src/utils/sessionKeepAlive.ts` (+test), `hooks/usePlaybackSource.ts` | full | – (T1 for a live check) | the watch page posts `<sessionUrl>/keepalive` every 15 s while open, playing or paused; it stops on source switch, unmount and `pagehide`; `sessionKeepAlive.test.ts` green |

T1, T2 and T3 touch separate files and can run alongside each other. Manual check after the merge, on the iPad with
KAI 071: the server log shows keep-alive POSTs every 15 s and no 404 run during a 20-minute play with a 3-minute pause.
Restart the server mid-play, and playback continues at the same spot: the title isn't marked watched and up-next doesn't
start.

## 8. Risks and known gaps

- **Screen locked or tab in the background on iPad:** timers stop, so the session is swept. On return, Safari's false
  end is caught and the player reopens: a short spinner, no lost position.
- **Safari's `currentTime` at a false end** is taken to be the play position. History rows 28–33 support this (the end
  positions match the 404 times). If a Safari version jumps to the duration instead, the guard reads it as a real end.
  That's today's behaviour, not worse.
- The Android "Play via server" fallback can still lose a session during a pause longer than 45 s (out of scope by
  choice). It shows its error dialog rather than a false end.

## 9. Progress log
- 2026-10-24: plan written and approved.
- 2026-10-24: built by /plan-runner (run 20261024-hls-false-end). T1 server keep-alive route (23 route/service tests),
  T2 false-end guard (`playbackEnd.ts`, 5 tests; the false-end position is recorded in `setTimeout(0)` so all three
  `ended` listeners judge against the previous one), T3 15 s keep-alive ping (4 tests). Full suite green: web 543 tests
  in 100 files, Android unit tests pass. Gate note applied: `pause`/`leave` PUTs on a false end now go through the guard.
  Left as known gaps: `lastFalseEnd` isn't cleared within one movie's player (a later false end within 5 s of an old one
  counts as real); `usePlayerCommands.ts:12` still reads raw `video.ended` (harmless, the reopen replaces the source).
  Still to check on the iPad with KAI 071 (§7).
