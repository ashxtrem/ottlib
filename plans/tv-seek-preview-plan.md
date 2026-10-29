# TV scrubbing with frame previews

Approved by the user (2026-10-29: "Approved").
Issue: #54

The ask came from the user on 2026-10-29: "In tv player seek on timeline is not there. Only forward using left right or select on
10s seek works. Unable to see the frames I am going forward for."

## 1. Why
- **The TV timeline can't be scrubbed.** With the controls showing, the seek bar is Media3's stock `DefaultTimeBar`. It moves one
  skip step per press (the per-profile skip setting, default 10 s: `PlayerViewModel.kt:182`, `PlaybackPreferences.kt:32`),
  with no speed-up and no picture (`tv/.../ui/player/PlayerSurface.kt:155`). With the controls
  hidden, ←/→ skips via `RemoteSeeker`, and `RemoteKeys` hands every key to the PlayerView once the controller is showing
  (`tv/.../ui/player/RemoteKeys.kt:35`).
- **A hold shows no frame on direct play.** Holding ←/→ speeds up to 30 s and then 60 s steps (`core/player/SeekAccumulator.kt:72-76`).
  `ScrubController` tries to move the real video with Media3 scrubbing mode (`core/player/ScrubController.kt:98-110`,
  `ExoScrubTarget.kt:16-31`). On large direct-play files the steps outrun the decoder, so the user sees only the
  "+1:20 → 42:10" text. The jump lands the moment the key is released (`RemoteSeeker.kt:41`), or 0.4 s after the last
  tap (`:45`), with no time to look.
- **The server can already draw a preview frame for any title.** `GET /api/movies/:id/frame?t=` (`packages/server/src/routes/frames.ts:7`,
  `services/frames/frameService.ts:25-48`) takes 150–540 ms per frame, with 2 runs at once, cancel-older per `x-device-id`, and
  an LRU cache of 300. Every playback source carries `framePreviewUrl` (`packages/shared/src/playback.ts:80`). Android uses it
  only on "Play via server": `frameTemplate = source.framePreviewUrl.takeIf { source.sessionUrl != null }`
  (`core/presentation/.../player/PlayerViewModel.kt:315`).
- Background: `plans/player-polish-plan.md` §2 ("Scrubbing via time") rejected frame previews for direct play because the
  video was meant to move by itself. On the TV it doesn't do that well enough, which is what this plan fixes.

## 2. Decisions
User (2026-10-29):
- **TV, plus phone direct play.** The phone's seek slider shows the server frame above the thumb on direct play too, instead of
  moving the video live. The web is unchanged.
- **On TV: a thumbnail over the bar.** A scrub opens a timeline at the bottom with a server frame above the scrub head and the
  target time. The video stays paused on its old frame until the jump. It works the same on direct play and on "Play via server".
- **The jump happens on OK, or after 2 s with no key.** Moving the head never jumps. Back cancels and returns to where you were.
- **A quick tap stays an instant skip.** With the controls hidden, a single ←/→ tap (or a burst of taps) skips the skip step as
  today, with the small text hint. Only a hold, or ←/→ on the focused timeline, opens the scrub. Taps stop fetching frames:
  today they go through `ScrubController` too (`RemoteSeeker.kt:74-80`), and on "Play via server" the hint shows a frame
  (`PlayerSurface.kt:215`). With this plan, taps show text only on every source.

My calls (change any at approval):
- **No server change.** The frame route, its cache and its limits are reused as they are. Rejected: a per-title trickplay
  sprite strip (smoother, but a new background job and storage; maybe later if the frame lag bothers us).
- **Steps inside the scrub:** a tap moves the head by the skip step, and a hold uses today's acceleration (10 s, 30 s after 1 s,
  60 s after 3 s; `SeekAccumulator.kt:72-76`). No new step sizes.
- **Idle jump after 2 000 ms** (`SCRUB_IDLE_MS`), counted from the last ←/→ key.
- **TV pauses during the scrub and restores the play state** on jump or cancel. If it was playing, it plays again after the jump.
- **The phone doesn't pause while dragging,** the same as "Play via server" today. Its video keeps playing until release, then
  seeks once.
- **The phone's swipe seek stays as is** (`mobile/.../PlayerSurface.kt:137-147`, text hint only). Only the slider gets frames.
- **The TV app leaving the foreground mid-scrub cancels it** (today it settles where it is; `RemoteSeeker.kt:48-54`). The
  user never confirmed the target, and TV pauses on `ON_STOP` anyway.
- **Up/Down are swallowed during a scrub.** Menu/Info and OK long-press do nothing until the scrub closes.
- **Fallback for an older server** (`framePreviewUrl` null in the Kotlin DTO, `core/model/.../Playback.kt:28`): the TV
  scrub bar shows times only, and `ScrubController` keeps today's live-moving video. The phone behaves as today.
- **Media FF/REW keys** follow ←/→: a tap skips, a hold opens the scrub.

## 3. Shared Android (core)
- `core/presentation/.../player/PlayerViewModel.kt:315`: `frameTemplate = source.framePreviewUrl`, with no session gate.
  `framePreviewUrl()` (:128) then answers a URL on direct play too. `ScrubController` goes down its frame-only path on both apps
  (`ScrubController.kt:98-103`), with no live seeks. No code infers "server session" from a non-null frame URL. Comments
  that say the frame is null on direct play must be updated: `PlayerViewModel.kt:106,127`, `ScrubController.kt:23-27`, tv
  `PlayerSurface.kt:75,213`, tv `FramePreview.kt:21`, mobile `PlayerSurface.kt:83`, mobile `PlayerControls.kt:59,113-114`.
- New `core/player/ScrubSession.kt`: pure logic, no Android types, unit-tested on the JVM next to `SeekAccumulator`.
  - `open(basePositionMs, durationMs)`, `move(offsetMs)` (adds to the head and clamps to `[0, duration − 1 000]`, the same
    clamp as `RemoteSeeker.target`), and `head`, `base`, `isOpen`.
  - `touched(nowMs)` records the last key. `idleDue(nowMs)` is true at `SCRUB_IDLE_MS` (2 000) after the last key, and never
    while a hold is in progress.
  - `commit(): Long` (the head, then closed) and `cancel(): Long` (the base, then closed).
  - The step sizes stay in `SeekAccumulator`. RemoteSeeker feeds `accumulator.take()` deltas into `move` (or the builder adds
    a small `drain()` to `SeekAccumulator` that keeps the hold state). The builder picks one and keeps `SeekAccumulatorTest`
    green.

## 4. TV
- **`RemoteSeeker.kt` gets two modes.**
  - *Skip* (today's tap path, minus the scrub): a tap or burst of taps adds up and calls `player.seekTo` once when it settles
    (the 400 ms window), and shows the text `SeekHint`. It no longer calls `ScrubController` for taps.
  - *Scrub*: opened by the first hold repeat (`accumulator.hold`), or by `openFromTimeline(direction, event)`. On open it
    records `wasPlaying`, pauses, calls `scrub.begin()` and `onScrubbing(true)`, and opens `ScrubSession` at the current
    position. Each ←/→ change calls `move`, then `scrub.scrubTo(head)` (fetches the frame), and updates the scrub UI state. A
    release does not jump.
  - The jump: OK → `commit`, a 2 s idle (checked by a main-thread timer) → `commit`, Back → `cancel`. `commit` calls
    `scrub.end(head)`; `cancel` calls `scrub.cancel()` with no seek. Both restore `wasPlaying`, call `onScrubbing(false)` and
    report `onClosed(fromTimeline)`.
  - Exposes a `scrubState` (head, base, duration, frame on or off) for the UI, through a callback like `onHint`.
- **`RemoteKeys.kt`:**
  - While a scrub is open, it handles first and consumes everything: ←/→ and FF/REW → seeker, OK (on `ACTION_UP`) → commit,
    `KEYCODE_BACK` → cancel, everything else swallowed.
  - With the controller showing and `exo_progress` focused, ←/→ hides the controller and calls `seeker.openFromTimeline`.
    Other keys on the visible controller still go to the PlayerView (the `:35` rule).
- **New `tv/.../ui/player/ScrubBar.kt`** (not focusable; the PlayerView keeps focus): a full-width bar at the bottom inside the
  40 dp safe area. It shows the track, a marker at `base`, the filled part up to `head`, and the head. Above the head,
  `FramePreview` (320 dp, 16:9, keeps the last frame until the next lands; `FramePreview.kt:25-39`) is clamped inside the bar's
  ends. A black box shows until the first frame arrives, and there's no box when frames are off. Beside it: the target time,
  the offset ("+4:30") and the total. Under the bar, small text: "OK to jump · Back to cancel".
- **`PlayerSurface.kt`:** render `ScrubBar` while a scrub is open. The `frame` state (:94) now feeds `ScrubBar` instead of the
  hint block (:215). Drop the `setKeyTimeIncrement` line (:155), since we take the timeline's ←/→. `onScrubbing` still feeds
  `credits::scrubbing` (:99). `ON_STOP` calls the seeker's cancel (§2). The file is at 265 lines: if `ScrubBar` wiring pushes it
  past ~350, move the hint/scrub overlay block into its own file.

## 5. Phone
No phone UI code changes. Once §3 removes the gate, `PlayerControls.kt:141` (`if (scrub != null && frame != null)`) already
draws the 160×90 dp frame over the thumb, clamped to the bar (`mobile/.../FramePreview.kt:23-34`). `onValueChangeFinished` still
seeks once (`PlayerControls.kt:131-132`).

## 6. API and contract
None. `framePreviewUrl` is already in every playback source and in the Kotlin DTO. No fixture change, and no `apiVersion` bump.
Server load: frame requests now also come from direct-play scrubs. They stay throttled on the client (150 ms, only on a new 2 s
step, `ScrubController.kt:114-116`) and on the server (2 at once, cancel-older per `x-device-id`, which both apps send via
`DeviceIdInterceptor.kt:9` and Coil's shared client).

## 7. Screens
- **TV:**
  - Initial focus stays unchanged (the PlayerView).
  - Controls hidden: a tap skips with the text hint, and a hold opens the scrub bar.
  - Controls showing: focus the timeline (stock Media3 focus order), and ←/→ hides the controls and opens the scrub bar.
  - During a scrub, focus stays on the PlayerView and the bar is not focusable. OK jumps; Back cancels (it doesn't exit the
    player or hide anything else).
  - Focus restore: if the scrub was opened from the timeline, the controller comes back with focus on `exo_progress` after the
    jump or cancel. Otherwise the controls stay hidden.
  - The credits pill is held while scrubbing (today's `credits::scrubbing`). The scrub bar is not shown under an open panel
    (panels already disable keys).
- **Phone:** a drag on the slider shows the frame above the thumb on direct play, at every width class and on the Fold's
  cover and inner screens (same composable as "Play via server" today). Nothing new in PiP (no slider there).

## 8. Tests to change or add
- New `core/player/src/test/.../ScrubSessionTest.kt`: open at the base; `move` clamps at 0 and at duration − 1 s; `idleDue`
  is false before 2 000 ms and true at it; a hold in progress is never idle; commit returns the head, cancel returns the base,
  and both close the session.
- `SeekAccumulatorTest.kt` stays green (extend it if `drain()` is added).
- `ScrubControllerTest.kt` stays green (the frame and direct paths are unchanged).
- There's no RemoteKeys or RemoteSeeker test today. Keep the logic in `ScrubSession` so the TV classes stay thin wiring.
- Build/test: `./gradlew test :tv:assembleDebug :mobile:assembleDebug` from `apps/android`.

## 9. Tasks
| Task | Files | Spec | Depends on | Checks |
|---|---|---|---|---|
| T1 Frames on direct play + ScrubSession | `core/presentation/.../player/PlayerViewModel.kt`, new `core/player/.../ScrubSession.kt` + `ScrubSessionTest.kt`, maybe `SeekAccumulator.kt` (+ test) | full | – | `frameTemplate` is set with no `sessionUrl` gate; the "null on direct play" comments listed in §3 are updated in core and mobile; `ScrubSessionTest` covers clamp, the 2 000 ms idle, hold not idle, and commit/cancel results; `SeekAccumulatorTest` and `ScrubControllerTest` pass; `:core:player:test` green |
| T2 TV scrub mode and bar | `tv/.../ui/player/RemoteSeeker.kt`, `RemoteKeys.kt`, `PlayerSurface.kt`, new `ScrubBar.kt` | partial | T1 | taps skip at once with no frame request; a hold or ←/→ on the focused timeline opens the bar paused, with the frame above the head; OK or 2 s idle jumps and restores play, Back cancels to the base; timeline-opened scrubs give focus back to `exo_progress`; `:tv:assembleDebug` builds and no file passes 350 lines; tv comments in §3 updated and `plans/TV_PLAYER_CONTROLS_PLAN.md:47` (seek bar step) marked superseded |

T2 waits for T1. The phone needs no task of its own: T1's gate removal turns it on, and the checker's `:mobile:assembleDebug`
plus a device check cover it.

## 10. Risks and known gaps
- **Frame lag on 4K HEVC.** 215–540 ms per frame means a fast hold (60 s steps every 250 ms) shows frames 2–4 times a second,
  not every step. Cancel-older keeps them current. A trickplay strip is the follow-up if that isn't good enough.
- **Stock `DefaultTimeBar` focus.** The plan relies on Media3 1.8's default controller letting the D-pad reach `exo_progress`.
  If a remote can't reach it, holding ←/→ with the controls hidden still opens the scrub.
- **Phone direct-play drags no longer move the video.** That's the user's call. The video keeps playing until release.
- No automated test of the TV key flow. Check by hand on a TV: tap, hold, timeline, OK, idle, Back, and the app going to the
  background.

- Stale comment, out of scope: `packages/server/src/services/frames/frameService.ts:13` says Coil sends no device id, but it
  does (`AppContainer.kt:55`, `OttlibApplication.kt:25-26`).

## 11. Progress log
- 2026-10-29: plan written and approved.
