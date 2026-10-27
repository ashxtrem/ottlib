# Player polish: credits skip, fullscreen on next, live scrubbing, web parity, TV background pause

Approved by the advisor (Fable 5.1 · high, 2026-10-27: "approve with the changes below"; its must/should lines are applied).
Issue: #51

The user asked for this on 2026-10-27: "auto skip credits media wise; when next playing, auto fullscreen if player was full
screen; seek visible media when moving the time, via time and not via 10s skip - both web and android players; bring
features from android player into web player like smartfill zooms, subtitle finder etc; when android is send in background
pause the player". The user asked for the Fable advisor, so every call below is the advisor's.

## 1. Why
- **No credits data anywhere.** There are no credits columns, no chapter reads and no skip UI. Up next starts 20 s before the
  end on web (`packages/client/src/utils/upNextTiming.ts:2,4`) and on `STATE_ENDED` on Android
  (`core/presentation/.../player/PlayerViewModel.kt:136-143`). ffprobe already runs at scan time, but without chapters
  (`packages/server/src/services/mediaProbeService.ts:124`). Measured on 60 sample files: 12% of movies (5/40) and 30% of
  episodes (6/20) have a chapter named for the credits. Generic "Chapter N" last chapters start anywhere from 1 s to 680 s
  before the end. Chapters alone can't do the job.
- **Web fullscreen is lost on the next title.** `WatchPlayer` is keyed per title (`pages/WatchPage.tsx:44`). Fullscreen
  targets the container inside it (`WatchPage.tsx:116`, `hooks/useFullscreen.ts:24`). Up next calls
  `navigate(..., {replace:true})` (`hooks/useUpNext.ts:53`), which remounts that container and drops fullscreen. Browsers
  block re-requesting fullscreen without a user gesture. Android already stays fullscreen: phone is always immersive
  (`mobile/.../FullscreenEffect.kt:18-33`), and the TV app has no system bars to hide (no fullscreen code under
  `apps/android/tv/src/main`).
- **Scrubbing shows no picture.** On web, the `<input range>` sets `currentTime` only on release (`components/player/SeekBar.tsx:18-19,37-40`).
  On TV, D-pad steps are accumulated and seeked once when they settle (`tv/.../ui/player/RemoteSeeker.kt:26-51`,
  `core/player/SeekAccumulator.kt`). The phone slider seeks only in `onValueChangeFinished`
  (`mobile/.../ui/player/PlayerControls.kt:107-132`). There are no previews anywhere, and no `SeekParameters` (Media3 1.8.0,
  `apps/android/gradle/libs.versions.toml:13`). Each seek on a server HLS stream restarts ffmpeg at that segment
  (`services/hls/hlsSession.ts:108-129`), so seeking on every drag step is not an option there.
- **The web player lacks Android features.** It only ever fits the picture (`object-contain`, `VideoSurface.tsx:114`) and
  ignores the `pictureArea` it already receives (built server-side in `packages/server/src/services/playbackService.ts:57`,
  `packages/shared/src/playback.ts:73`; nothing in `packages/client/src` reads it). Subtitle search exists only on the movie
  page (`MovieDetailPage.tsx:135`, `components/SubtitleDialog.tsx`), and audio/subtitle choices aren't remembered
  (`hooks/usePlayerTracks.ts`). Android has all three: `PictureMode.kt:4-14`/`PictureGeometry.kt`,
  `SubtitleSearchController.kt`, `TrackMemory.kt`.
- **The TV app keeps playing in the background.** TV `ON_STOP` only cancels autoplay (`tv/.../ui/player/PlayerScreen.kt:50-51`).
  The phone already pauses on `ON_STOP` (`mobile/.../ui/player/PlayerScreen.kt:70-72`), and while playing it auto-enters PiP on
  Home (`PictureInPicture.kt:48-71`).

## 2. Decisions
User (2026-10-27):
- **Server PC playback stays as is.** The user asked "when playing on local machine - still streaming?" The answer is yes:
  the browser player direct-plays over loopback when it can and transcodes when it can't, because the decider has no
  locality input (`services/playbackDecider.ts:28-37`). The user chose to keep it that way, which keeps the 2026-10-24 call
  of the browser player everywhere.

Advisor's calls (Fable 5.1 · high, 2026-10-27):
- **One plan, five parts.** Each part is its own commit, so review and revert stay per feature.
- **Credits source.** Picked: a chapter titled credits, or the user's "Credits start here" mark (server-side, shared by all
  profiles and devices), or for episodes a credits length learned from a sibling episode. Rejected: chapters only (12%/30%
  coverage); black-frame/silence detection (fragile, CPU heavy, could be a later plan).
- **"Media wise" = per media type plus a per-title override.** Each profile has a default per media type (series on, movies
  off, because of post-credit scenes). A movie or a whole series can override it. Stored on the server, so every device
  follows it. Rejected: one global toggle; per-device only.
- **Auto-skip behaviour.** With auto-skip on and a next title, the up-next countdown starts at the credits start; "Watch
  credits" cancels it. With auto-skip on and nothing next, there is no countdown: the "Skip credits" button shows, and
  pressing it completes the title and leaves the player. With auto-skip off, the "Skip credits" button shows during the
  credits. The watched rule is under "My calls".
- **Web fullscreen.** Picked: lift the fullscreen container above the keyed player so it survives the next title. Rejected:
  one long-lived `<video>` across titles (a bigger refactor). iOS Safari's native video fullscreen stays a known gap.
  Android: nothing to change.
- **Scrubbing "via time".** Direct-play sources move the real video while you drag or hold. Server-HLS sources show a
  preview frame from a new on-demand frame route instead of restarting the transcode. The ±10 s buttons and keys stay.
  Rejected: frame previews for every source (the video doesn't move); background thumbnail strips for the whole library
  (~820 titles, days of CPU).
- **Web parity scope.** All 7 picture modes using `pictureArea`, remembered per title with a default, per device. The
  subtitle finder inside the player. Audio/subtitle language memory per device. Out of scope: skip-step and autoplay-seconds
  settings, and pinch zoom on phones.
  This supersedes the 2026-10-25 memory call that the web player gets no picture modes: the user asked for it now.
- **Background pause.** TV pauses on `ON_STOP` and stays paused on return. The phone is unchanged: it already pauses, and
  PiP on Home while playing stays.

My calls (values):
- **Credit chapter match:** `/\b(end\s*)?credits?\b|\boutro\b|\bending\b/i`. The chapter must start in the last
  40% of the file and end within 30 s of the file's end, or be followed only by more credit-like chapters. Lives in
  `config/credits.ts`.
- **Series learning:** credits length = sibling duration − sibling credits start. Only siblings whose credits come from a
  mark or a chapter count (never another learned value). Taken from the sibling with the closest duration, and applied only
  when the durations differ by ≤ 120 s. A title's own mark or chapter always wins.
- **Re-detection:** a scan that changes a file's path or duration resets its `credits_status` to `pending` (and clears
  `credits_chapter_ms`; a mark is kept).
- **Commits:** one per task, prefixed with its part letter (`A:` credits, `B:` fullscreen, `C:` scrubbing, `D:` web
  parity, `E:` TV pause), because the parts interleave across the two chains. The PR description groups the commits by
  part.
- **Frame preview:** `-skip_frame nokey -ss <t> -i <file> -frames:v 1 -vf scale=320:-2 -q:v 5`. Measured: 4K HEVC 215–540 ms
  (up to 1.1 s without `nokey`), 1080p 150–210 ms; jpg 3–8 KB. At most 2 ffmpeg runs at once, server-wide. A newer request
  for the same movie and client cancels the older one. LRU cache of 300 frames keyed by movie and `t` rounded to 2 s. The
  client sends at most one request every 150 ms and keeps the last frame shown until the next one lands.
- **Live seek on direct play:** web uses `video.fastSeek(s)` when present, else sets `currentTime`, throttled to 150 ms.
  Android uses Media3 scrubbing mode (`ExoPlayer.setScrubbingModeEnabled`) during the drag or hold if 1.8.0 has it, else
  `SeekParameters.CLOSEST_SYNC` with seeks throttled to 150 ms. Release does one exact seek, with default seek parameters
  restored.
- **When the title is marked watched:** `/complete` is called when the auto-skip countdown fires or "Skip credits" is
  pressed, not at the credits start. Watching the credits through keeps today's end rules (92%, or `ended`).
- **Storage keys (web, per device):** `ottlib-picture-modes` (movieId → mode), `ottlib-picture-default`,
  `ottlib-track-choices` (movieId → {audio, subtitle} languages) and `ottlib-track-languages` (last-chosen languages).
  Each hook wraps its own try/catch, as `useHiddenTitles.ts:6` does.

## 3. Server: credits
- **Migration** `db/migrations/023_credits.ts`, registered by hand in `db/db.ts:22-25,33-54`:
  - `movies.credits_chapter_ms INTEGER NULL`, `movies.credits_mark_ms INTEGER NULL`, `movies.credits_status TEXT NOT NULL DEFAULT 'pending'`.
  - Table `profile_auto_skip(profile_id INTEGER NOT NULL, scope_key TEXT NOT NULL, enabled INTEGER NOT NULL, PRIMARY KEY(profile_id, scope_key))`,
    cascading on profile delete like `movie_hides` (`019_profiles.ts:21`). `scope_key` is `default:movie`, `default:tv`,
    `movie:<id>` or the show key from `showKeyOf` (`repositories/movieRepository.ts:29-33`; a module-private function
    today, to be exported).
- **Chapter pass** (`services/credits/chapterReader.ts` + `services/credits/creditsService.ts`, config `config/credits.ts`).
  `ffprobe -v error -show_chapters -of json` is spawned the same way `mediaProbeService.ts:113-124` spawns ffprobe (with
  `FFPROBE_PATH`). `spawnExec` (`providers/transcode/ffmpegLocator.ts:21-31`) is ffmpeg-only today.
  The pass picks the credit chapter per the rule above and sets `credits_status='done'`. It is single-flight with a rerun,
  in batches, copying `pictureAreaService.ts:19-27`. It starts after listen (`packages/server/src/index.ts:10`) and after
  each scan (`services/scanService.ts:44`), next to `pictureArea.runPending()`.
- **Repositories:** `movieRepository` gains `applyCreditsChapter(id, ms|null)`, `setCreditsMark(id, ms|null)`,
  `getCredits(id)` and `creditsOfShow(showKey)` (sibling durations and starts). New `repositories/autoSkipRepository.ts`
  has get/set/clear for (profile, scope).
- **Resolver** `services/credits/creditsResolver.ts`. Credits come from mark, then chapter, then series, giving
  `{startMs, source: 'mark'|'chapter'|'series'} | null`. Auto-skip comes from the title override (movie: `movie:<id>`;
  episode: its show key), then the profile default for its type, then the config defaults (tv on, movie off). A title with
  no type counts as a movie.
- **Routes** `routes/credits.ts`, profile-scoped through `viewerOf` (`routes/viewer.ts:16-19`), with no logic beyond
  parsing:
  - `PUT /api/movies/:id/credits` `{startMs: number|null}` sets or clears the mark.
  - `PUT /api/movies/:id/auto-skip` `{enabled: boolean|null}` sets or clears the override; for an episode it applies to the
    whole series.
  - `GET` and `PUT /api/profiles/current/auto-skip` read and set the defaults `{movie: boolean, tv: boolean}`.

## 4. Server: frame preview
- **Route** `routes/frames.ts`: `GET /api/movies/:id/frame?t=<ms>&key=<k>` returns `image/jpeg` with
  `Cache-Control: private, max-age=3600`. It is added to the per-movie `?key=` routes in `routes/authGuard.ts:13-15`, so
  `<img>` and Coil load it without headers.
- **Service** `services/frames/frameService.ts`: cap, cancel-older and LRU cache per my calls. The client is identified by
  the request IP plus the movie, because `<img>` loads send no `x-device-id` (that header is set only by `api()`,
  `hooks/apiClient.ts:24`). A closed request kills its ffmpeg. Config lives in `config/framePreview.ts`.
- **Playback response** gains `framePreviewUrl`: a server-relative path with the key, and the client appends `&t=`. The app
  still never builds URLs itself.

## 5. API and contract
- `packages/shared/src/playback.ts` (`playbackSourceSchema` :55-74) gains `credits: {startMs, source} | null`,
  `autoSkipCredits: boolean` and `framePreviewUrl: string`. New `packages/shared/src/credits.ts` holds the request bodies
  and the defaults response.
- The playback fields are additive, so **no `apiVersion` bump** (`playback.ts:4` stays 1).
- Re-record the `playback-source` and `playback-source-hls` fixtures (`routes/nativeClient.test.ts:202,225`) and add an
  `auto-skip-defaults` fixture. In the Kotlin DTO `core/model/.../Playback.kt:7-24`, add
  `credits: Credits? = null`, `autoSkipCredits: Boolean = false`, `framePreviewUrl: String? = null`, plus a new
  `Credits`/`AutoSkipDefaults` model. `ContractFixturesTest` must pass.

## 6. Web
- **Fullscreen (part B):** `WatchPage` owns the `fixed inset-0` container and `useFullscreen`, above the per-title key
  (`WatchPage.tsx:40-45`). It passes the container and fullscreen state down to `WatchPlayer`, so fullscreen survives up
  next. On iOS (`webkitEnterFullscreen`) it still drops; this is a documented gap.
- **Credits (part A):** `hooks/useCredits.ts` watches the position against `credits.startMs`. With auto-skip on and a next
  title, it starts the up-next countdown early (`useUpNext` gets a `startAt` instead of the fixed 20 s lead,
  `utils/upNextTiming.ts:2`) and shows "Watch credits". Otherwise (auto-skip off, or nothing next) it shows
  `components/player/SkipCreditsButton.tsx` until the end. "Skip credits" calls `/complete`, then plays the next title
  straight away, or goes back to the title page when there is nothing next.
  A new player "More" menu (`components/player/MoreMenu.tsx`) offers "Credits start here" (at the current position), "Clear
  credits mark" and "Auto-skip credits for this movie/series" (on/off/default).
  The Settings page gets a "Player" section (`components/PlayerSettingsSection.tsx`) with the per-profile auto-skip defaults
  and the per-device default picture mode.
- **Scrubbing (part C):** `SeekBar` gains `onScrub(ms)`, fired while dragging. `hooks/useScrub.ts` live-seeks for direct
  sources and loads `framePreviewUrl&t=` for HLS sources. `components/player/ScrubPreview.tsx` draws a 160 px frame and the
  time above the thumb (and the time alone for direct play). Release commits as today.
- **Picture modes (part D):** `utils/pictureGeometry.ts` is a TS port of `PictureGeometry.kt`: given the video size, box size,
  `pictureArea` and mode, it returns the `<video>` rect. The video is absolutely positioned in an `overflow-hidden` box, sized
  through a `ResizeObserver`. There is a "Picture" `TrackMenu` with the 7 modes. `hooks/usePictureMode.ts` remembers the mode
  per title with a default.
- **Subtitle finder (part D):** the subtitle menu gets a "Find subtitles…" item (`TrackMenu` gains a footer slot) that opens
  `SubtitleDialog`. After a download, the playback source refetches and reopens at the current position, the way burn-in
  already reopens (`usePlayerTracks.ts:66-68`).
- **Track memory (part D):** `hooks/useTrackMemory.ts` follows Android's `TrackMemory.kt` rules: the per-title choice comes
  first, then the last-chosen languages. It feeds the audio order request (`utils/browserCaps.ts:79`) and the first text
  track pick (`hooks/usePlayerTracks.ts:82`, `text[0]` today). The audio default pick is at `trackMenuItems.ts:35`.

## 7. Android
- **TV background pause (part E):** `tv/.../ui/player/PlayerScreen.kt:50-51`: `ON_STOP` also calls `viewModel.pauseForBackground()`,
  which pauses and saves progress. On return the player stays paused with the controls shown.
- **Credits (part A):** `core/presentation/.../player/CreditsController.kt` follows the position against `credits` and exposes
  `showSkip` or an early autoplay trigger; it reuses `AutoPlayNext` and its streak limit of 3.
  `PlayerViewModel` (341 lines) only wires it, so keep the logic in the controller. `OttlibApi` gains `setCreditsMark`,
  `setAutoSkip`, `autoSkipDefaults` and `setAutoSkipDefaults`.
  UI: a "Skip credits" pill. On TV:
  - It takes focus when it appears with the controls hidden, and again when the controls hide while it is showing.
  - OK presses it.
  - D-pad directions on it fall through to the player's normal handling (show controls or seek), with focus on the
    controls' initial item.
  - Back dismisses it once for this title.
  - When it goes away (skipped, dismissed, or the credits are over), focus returns to the player surface.

  A "Credits" panel with mark, clear and auto-skip (TV: opened from the controls row like `PicturePanel`; phone: a row in the
  track panel). Settings screens get the two auto-skip default toggles (`SettingsScreen.kt` on TV :114-150 and mobile :95-124).
- **Scrubbing (part C):** `core/player/ScrubController.kt` holds `begin()`, `scrubTo(ms)` and `end(ms)`. Direct play uses
  scrubbing mode or CLOSEST_SYNC, throttled. A server session (`PlayerViewModel.kt:103` `serverSession`) uses only the preview
  URL. The phone slider calls it from `onValueChange` (`PlayerControls.kt:107-132`), with a Coil frame above the thumb for
  server sessions. TV `RemoteSeeker` calls it on every accumulator change, and the seek hint shows the frame for server
  sessions.

## 8. Screens
- **Web, phone and desktop, light and dark:** "Skip credits" and "Watch credits" sit bottom-right above the controls, clear of
  the up-next card. The preview is 160 px wide on phones, stays inside the viewport at both ends of the bar, and is hidden
  while not dragging. The More and Picture menus reuse the `TrackMenu` popover. Fullscreen survives up next on desktop
  Chrome, Firefox and Android Chrome.
- **TV:** initial focus is unchanged. The skip pill follows the focus rules in §7: it takes focus while the controls are
  hidden, D-pad falls through, Back dismisses it once, and focus returns to the surface when it goes. The Credits panel restores focus to its controls-row button on close. During a D-pad hold the picture moves on
  direct play, and the hint shows a frame on "Play via server".
- **Phone:** the pill and panel row work at every width class and on the Fold's cover and inner screens, and in tabletop the
  pill sits on the top half. In PiP no pill is shown, but auto-skip still fires.

## 9. Tests to change or add
- Server: `chapterReader.test.ts` (match rule and edge chapters), `creditsResolver.test.ts` (mark > chapter > series, the
  ±120 s guard, defaults/override), `frameService.test.ts` (cap, cancel-older, cache with a fake ffmpeg),
  `credits.test.ts`/`frames.test.ts` routes (profile scope, the `?key=` guard), `nativeClient.test.ts` fixtures re-recorded.
- Web: `pictureGeometry.test.ts` (the 7 modes × with/without area, matching Kotlin `PictureGeometryTest` values),
  `useCredits`/credits timing, scrub throttle, `useTrackMemory`.
- Android: `ContractFixturesTest`, `CreditsControllerTest`, `ScrubControllerTest` (throttle, direct vs server).

## 10. Tasks
| Task | Files | Spec | Depends on | Checks |
|---|---|---|---|---|
| T1 Server credits contract | migration 023, `db/db.ts`, `repositories/movieRepository.ts` (credits methods, export `showKeyOf`), `repositories/autoSkipRepository.ts`, `services/credits/creditsResolver.ts`, `routes/credits.ts`, `services/playbackService.ts` (credits, autoSkipCredits, framePreviewUrl path with key), `packages/shared/src/{playback,credits}.ts`, fixtures, `core/model/Playback.kt` (+Credits, AutoSkipDefaults) | partial | – | Resolver tests cover mark>chapter>series (mark/chapter siblings only) and ±120 s; PUT routes are profile-scoped; fixtures re-recorded incl. `framePreviewUrl` and `ContractFixturesTest` passes; readers still pass: `shared/src/playback.test.ts`, `client/src/utils/playbackProblem.test.ts` (typed literal), `server/src/routes/embeddedSubtitles.test.ts` |
| T1b Server chapter pass | `services/credits/chapterReader.ts`, `services/credits/creditsService.ts`, `config/credits.ts`, `index.ts`, `services/scanService.ts` | full | T1 | Pass fills `credits_chapter_ms` on start and after a scan; single-flight with rerun; path/duration change resets to `pending`, mark kept; `chapterReader.test.ts` covers the match rule |
| T2 Server frame preview | `routes/frames.ts`, `routes/authGuard.ts`, `services/frames/frameService.ts`, `config/framePreview.ts` | full | T1 | `<img src=framePreviewUrl&t=>` loads with a PIN set; at most 2 ffmpeg at once; newer request cancels older; cache hit skips ffmpeg |
| T3 Web fullscreen survives next | `pages/WatchPage.tsx`, `hooks/useFullscreen.ts` | full | – | Fullscreen stays on after up-next navigation (desktop Chrome); exit via Esc/f still works; no regression on iOS path |
| T4 Web credits | `hooks/useCredits.ts`, `hooks/useUpNext.ts`, `utils/upNextTiming.ts`, `components/player/{SkipCreditsButton,MoreMenu}.tsx`, `PlayerControls.tsx`, `WatchPage.tsx`, `components/PlayerSettingsSection.tsx`, `pages/SettingsPage.tsx`, hooks for the new routes | partial | T1, T3 | Auto-skip on: countdown at credits start, "Watch credits" cancels; off: Skip button; mark/clear/override from More menu; defaults in Settings; `utils/upNextTiming.test.ts` updated for the start-at timing |
| T5 Web scrubbing | `SeekBar.tsx`, `hooks/useScrub.ts`, `components/player/ScrubPreview.tsx`, `usePlayerCommands.ts`, `PlayerControls.tsx` | full | T2, T7 | Direct play: picture moves while dragging (≤ 1 seek / 150 ms); HLS: frame preview, no segment restarts until release; release seeks exactly |
| T6 Web picture modes | `utils/pictureGeometry.ts`, `hooks/usePictureMode.ts`, `VideoSurface.tsx`, `PlayerControls.tsx`, `PlayerSettingsSection.tsx` | full | T4 | 7 modes match Kotlin geometry tests; uses `pictureArea`; per-title + default remembered per device; works at phone and desktop widths |
| T7 Web subtitle finder + track memory | `TrackMenu.tsx`, `WatchPage.tsx`, `usePlayerTracks.ts`, `hooks/useTrackMemory.ts`, `trackMenuItems.ts`, `browserCaps.ts`, `useSubtitles.ts` | partial | T6 | "Find subtitles…" downloads and the new track appears without losing position; next title picks the remembered audio/subtitle language; `TrackMenu.test.tsx` passes with the footer slot |
| T8 TV background pause | `tv/.../ui/player/PlayerScreen.kt`, `PlayerViewModel.kt` | full | – | Home/input switch pauses and saves progress; return shows paused with controls; phone unchanged |
| T9 Android credits | `core/presentation/.../player/CreditsController.kt`, `PlayerViewModel.kt`, `core/network/OttlibApi.kt`, tv + mobile player UI (pill, Credits panel), both `SettingsScreen.kt` | partial | T1, T8 | Auto-skip on starts countdown at credits start; pill on TV takes focus only with controls hidden; mark/override hit the server; `CreditsControllerTest` passes |
| T10 Android scrubbing | `core/player/ScrubController.kt`, mobile `PlayerControls.kt`, tv `RemoteSeeker.kt` + seek hint, `PlayerViewModel.kt` | partial | T2, T9 | Direct play: picture moves during drag/hold; server session: Coil frame preview; release seeks exactly; `ScrubControllerTest` passes |

What runs alongside what:
- T3 and T8 can start at once, before T1 ends.
- T1 comes first on the server. T1b and T2 then run alongside each other.
- The web chain is T3→T4→T6→T7→T5, all sharing `WatchPage` and `PlayerControls`. T5 goes last, so the chain never waits on
  T2.
- The Android chain is T8→T9→T10, all sharing `PlayerViewModel`.
- Each task is one commit, prefixed with its part letter (§2).

## 11. Risks and known gaps
- 4K HEVC frame grabs take up to about 0.5 s with `nokey`, so the preview trails a fast drag. The last frame stays shown,
  and the concurrency cap protects the server's transcodes.
- Series learning can misfire on episodes with a different cut. The ±120 s guard and the per-title mark limit this.
- iOS Safari native fullscreen still drops on up next.
- Media3 scrubbing mode: the 1.8.0 jars in the Gradle cache do contain `setScrubbingModeEnabled` and
  `ScrubbingModeParameters`. It is marked experimental, so the CLOSEST_SYNC fallback stays specified in case it misbehaves.
- Titles with neither a chapter nor a mark get no auto-skip until someone marks one episode or the movie.
- PR size: ten tasks across three clients. Keep one commit per part (A–E) for review.

## 12. Progress log
- 2026-10-27: plan written and approved (by the advisor, Fable 5.1 · high; the user decided the server-PC question).
