# Baked-in letterbox detection

Approved by the user (2026-10-25: "Approved — go ahead: issue, commit on claude/letterbox-detection.").
Issue: #48

Some releases encode a scope film inside a 16:9 frame with the black bars burned into the picture. Found on
`Z:\vdo\mummy\The Mummy (1999) [2160p] [4K] [BluRay] [5.1] [YTS.MX]`: the frame is 3840×2160 (SAR 1:1, DAR 16:9), the
picture is 3840×1632 at y=264 (2.35:1). On a 16:9 TV every Android picture mode (Fit, Zoom, Stretch, Smart fill, 16:9)
draws the same thing, and the forced ratios squash the bars along with the picture.

## 1. Why
- **Picture modes only know the frame, not the picture.** `PictureModeController` sizes from `player.videoSize`
  (`apps/android/core/player/src/main/kotlin/dev/ottlib/core/player/PictureModeController.kt:80`). A 16:9 frame on a 16:9
  screen leaves Zoom nothing to trim, and Smart fill's `sqrt(video × screen)` (`PictureGeometry.kt:16`) comes out at 16:9.
- **Nothing measures the picture today.** The probe reads width, height, codec, profile, bit rate, duration and HDR
  (`packages/server/src/services/mediaProbeService.ts:68-80`). There is no `cropdetect` anywhere in `packages/` or `apps/`.
- **The playback response has no geometry.** `playbackSourceSchema` (`packages/shared/src/playback.ts:46-63`) has no size
  fields. The Android DTO `PlaybackSource` (`apps/android/core/model/.../Playback.kt:7-22`) has none either.

## 2. Decisions
User (2026-10-25):
- **Android only (TV and phone).** The web player gets no picture modes in this plan: it keeps `object-contain`
  (`packages/client/src/components/player/VideoSurface.tsx:105-114`).
- **Every mode uses the real picture, Fit included.** On a 16:9 TV, Fit looks the same as today. On a 20:9 phone or the
  Fold's inner screen, a 2.35 film fills far more of the screen.
- **Backfill automatically.** After each scan, a background pass checks every file that hasn't been checked yet, so an
  existing library is covered by the first scan after the update.
- **Show it on the web title page.** `MediaInfoPanel` gets one line, e.g. `Picture 3840×1632 (2.35:1) in a 16:9 frame`.

My calls:
- **Sample 8 points spread evenly over 10–90% of the runtime, 3 frames each, and take the union.** Measured on the Mummy
  file over the `Z:` network drive: 8 points took 7.4 s, about 0.9 s per point. Dark scenes report a smaller box (one
  sample gave 2406×1632, another 2826×898). The union of all samples gave the correct 3840×1632+0+264. A union can only
  err toward cropping too little, never too much.
- **`cropdetect=limit=0.1:round=2:reset=0`.** A fractional limit works for 8- and 10-bit sources. The absolute default of
  24 found no bars on this 10-bit HEVC, because 10-bit limited-range black is 64.
- **Store the area in source pixels in the database, and send it as fractions (0–1) of the frame.** "Play via server" can
  scale the video down to 1080p (`packages/server/src/services/hls/transcodeTarget.ts:5-8`), so pixels would be wrong
  there. Fractions stay valid at any scale.
- **Ignore bars thinner than 1% of the frame per side.** That is noise or edge softness: the result is `none`, meaning no
  area.
- **Distrust results below 50%.** A union narrower or shorter than 50% of the frame becomes `failed` and sends no area.
  Fewer than 3 usable samples also counts as `failed`.
- **Separate status column, not part of `media_probe`.** The probe stays fast and inline. Detection runs in its own pass
  after the scan finishes, one file at a time, and is never awaited by the scan.
- **No area while subtitles are burned in.** When the plan's `burnSubtitleOrder` is non-null
  (`services/playbackPlanner.ts:72`), the server sends `pictureArea: null`. `burnInSubtitles` is always an array, even
  when nothing is burned in (`:69`).
  ffmpeg's subtitles filter draws at the bottom of the full frame, which is inside the bar, and Zoom would cut it off.
- **The Android geometry is one pure function** in `PictureGeometry`, so it can be unit-tested. Without an area, the
  controller keeps today's resize-mode path unchanged.
- **No `apiVersion` bump.** The new fields are optional and additive.

## 3. Server: detection and storage
**Migration** `packages/server/src/db/migrations/022_picture_area.ts`, an `ensure*` function like
`021_stream_secret_rotation.ts`, wired in `db/db.ts` next to `:24,52`. It adds these nullable columns to `movies`:
`picture_x`, `picture_y`, `picture_width`, `picture_height` (INTEGER, source pixels), and
`picture_status TEXT NOT NULL DEFAULT 'pending'`, which is one of `pending | done | none | failed`. Existing rows start as
`pending`, which is the backfill.

**Repository** (`packages/server/src/repositories/movieRepository.ts`):
- `listPicturePending(limit)` returns the rows with `picture_status = 'pending'` and a file path.
- `applyPictureArea(id, area | null, status)` stores the area and its status.
- Add the 5 columns to `MovieRow` (`:4`) and to `map` (`:431-442`). `map` puts `pictureWidth` and `pictureHeight` into
  `mediaInfo` (`:437-440`) when the status is `done`. It also exposes a `pictureArea` in source pixels on `Movie` for
  `playbackService`. That field is server-internal, not in `movieSchema`.
- In the upsert's size/mtime `CASE` (`:213-221`), next to the reset of `media_probe_status`, also reset `picture_status`
  to `'pending'` and null the area. Do the same in `clearMediaInfo` (`:228-232`).

**Config** `packages/server/src/config/pictureArea.ts`:
- `samplePoints: 8`, `rangeStart: 0.1`, `rangeEnd: 0.9`, `framesPerSample: 3`
- `cropLimit: 0.1`, `cropRound: 2`, `sampleTimeoutMs: 15_000`
- `minBarFraction: 0.01`, `minAreaFraction: 0.5`, `minValidSamples: 3`

**Detector** `packages/server/src/services/pictureArea/cropDetector.ts`:
- For each point, run `ffmpeg -hide_banner -ss <t> -i <file> -frames:v <n> -vf cropdetect=limit=…:round=…:reset=0 -an -sn -f null -`
  through `spawnExec` (`providers/transcode/ffmpegLocator.ts:21-31`), using the `FFMPEG_PATH` binary
  (`config/transcode.ts:9-10`).
- Parse the last `crop=w:h:x:y` from stderr. A sample that fails or times out is skipped.
- `spawnExec` returns `{code, stdout, stderr}` and stops collecting output after 2 MB (`config/transcode.ts:18`). A
  few frames produce far less than that.
- The executable comes from the located ffmpeg (`app.ts:112` `locate()`), passed into the service, not a fresh lookup.

**Pure math** `packages/server/src/services/pictureArea/pictureAreaMath.ts`:
- `parseCropLine(stderr)` returns `{w,h,x,y} | null`.
- `unionArea(samples, frameW, frameH)` returns `{ status, area }`. It applies the union, then the 1% bar threshold, the
  50% sanity check and the minimum sample count.

**Service** `packages/server/src/services/pictureArea/pictureAreaService.ts`:
- `runPending()` is single-flight: a second call while one is running returns the running one.
- It loops over `listPicturePending` in batches, one file at a time, and needs the duration and frame size from the
  stored media info.
- A row with no successful probe is skipped and stays `pending`.
- It calls the detector and the math, then `applyPictureArea`.
- `scanService` (`services/scanService.ts:20-38`) calls `pictureArea.runPending()` without awaiting it, once the scan
  loop ends. Errors are logged, never thrown into the scan.
- Wire it in `app.ts:106`, where `new ScanService(...)` is built: a new constructor argument. The `runPending()` call
  goes after `finish` (`scanService.ts:37`).

## 4. API and contract
**Shared** (`packages/shared`):
- New `pictureAreaSchema = z.object({ x, y, width, height })`, each `z.number().min(0).max(1)`, as fractions of the
  frame. It lives in `playback.ts`.
- `playbackSourceSchema` gets `pictureArea: pictureAreaSchema.nullable().optional()`.
- `mediaInfoSchema` (`packages/shared/src/index.ts:66-70`) gets `pictureWidth` and `pictureHeight`, as
  `z.number().int().nullable().optional()` in source pixels, for the web panel.

**Server:**
- `playbackService.source()` (`services/playbackService.ts:40-61`, which reads the `Movie` at `:45`) sets
  `pictureArea` from the movie's pixel area divided by the `mediaInfo` width and height.
- It sends `null` when there is no area, when the frame size is unknown, or when the plan's `burnSubtitleOrder` is
  non-null.
- `mediaInfo` gets its `pictureWidth` and `pictureHeight` from `movieRepository.map` (§3).
  `libraryService.ts:33` spreads it unchanged.

**Contract:**
- Re-record `contract/fixtures/playback-source.json` and `playback-source-hls.json`
  (`packages/server/src/routes/nativeClient.test.ts:201,224`) with `npx vitest run -u` in `packages/server`.
- Re-record the fixtures that carry `mediaInfo`: `shelf-detail`, `movie`, `next-episode`, `movie-unmatched` and
  `completed-episode`.
- Seed a `done` area in the test, so `playback-source.json` has a non-null `pictureArea` and `movie.json` has
  `pictureWidth`/`pictureHeight`.
- Other readers that must keep passing: `shared/src/playback.test.ts:31-34,53` (round-trip `toEqual`),
  `embeddedSubtitles.test.ts:104-125`, and TV `DetailsScreen.kt:177`, which reads `MediaInfo`.

**Kotlin** (same task, because `ContractFixturesTest.kt:17` decodes strictly):
- `Playback.kt`: add `@Serializable data class PictureArea(val x: Float, val y: Float, val width: Float, val height: Float)`
  and add `val pictureArea: PictureArea? = null` to `PlaybackSource`.
- `Movie.kt:39-43` `MediaInfo`: add `pictureWidth: Int? = null` and `pictureHeight: Int? = null`.
- Add `ContractFixturesTest` assertions on the decoded `pictureArea`.

## 5. Android: picture modes on the real picture
**Geometry** (`core/player/.../PictureGeometry.kt`): a new pure
`frameRect(scaling, forcedAspect: Float?, videoAspect, area: PictureArea, screenW, screenH): FrameRect(width, height, left, top)`,
in px. The active aspect is `A = videoAspect × area.width / area.height`. The rectangle the picture is drawn into on the
screen (`Wa×Ha`) is:

| Mode | Wa×Ha |
|---|---|
| Fit | fit A into the screen |
| Crop (Zoom) | cover the screen with A |
| Stretch | the full screen |
| Balanced (Smart fill) | cover the screen with `F = sqrt(A × S)`, where S = screen aspect |
| forced ratio R | fit R into the screen |

The video frame is then `Wa / area.width × Ha / area.height`, placed so that the active area's centre sits at the screen's
centre: `left = W/2 − (area.x + area.width/2) × frameW`, and the same for top.

**Controller** (`PictureModeController.kt`):
- Add `setPictureArea(area: PictureArea?)`.
- With an area and a known video size, it sets `RESIZE_MODE_FILL` on the content frame and gives `exo_content_frame` the
  explicit size and position from `frameRect`. The frame may be larger than the `PlayerView`, which clips it, as Zoom
  already does.
- The existing video-size and layout listeners re-apply this.
- With `null`, it restores `MATCH_PARENT` layout params and today's path exactly.
- Subtitles already live in the overlay (`keepSubtitlesOnScreen`), so they stay on screen.

**ViewModel** (`core/presentation/.../player/PlayerViewModel.kt`):
- Expose `pictureArea: StateFlow<PictureArea?>` from the fetched source (`:153`).
- Update it when `playViaServer` (`:242-268`) fetches a new source.

**Surfaces:**
- `tv/.../PlayerSurface.kt:85,105` and `mobile/.../VideoView.kt:26,36` collect the flow and call `setPictureArea` in the
  same `LaunchedEffect` that applies the mode.
- `PlayerScreen` in each app passes the flow down next to `pictureMode`.

## 6. Screens
- **TV:** no new controls, and no change to focus or Back. With an area, the Picture panel's modes behave differently on
  screen.
- **Phone:** the same, on every width class. On the Fold's inner screen (close to square), Fit shows the 2.35 picture
  with bars that the player draws rather than the file's. Tabletop and PiP use the same geometry, which recomputes from
  the layout listener.
- **Web:** `MediaInfoPanel.tsx:52` gets a line under `width × height · container` when `pictureWidth` is set:
  `Picture {w}×{h} ({ratio}:1) in a {frameRatio} frame`. Ratios use 2 decimals, and the frame shows as 16:9 / 4:3 when it
  is within 1% of those. It works at phone and desktop widths and in dark mode, using the panel's existing text classes.

## 7. Tests to change or add
- `pictureAreaMath.test.ts`:
  - parse a real cropdetect line
  - the union of the Mummy samples from §2 gives 3840×1632+0+264 → `done`
  - bars under 1% → `none`
  - a union under 50% → `failed`
  - fewer than 3 samples → `failed`
  - a pillarboxed 4:3-in-16:9 → `done` with x > 0
- `pictureAreaService.test.ts`, with the detector faked:
  - a pending row becomes done or none
  - a file change resets it to pending
  - a second `runPending` while one is running doesn't start another
  - an unprobed row is skipped
- `playbackService` test:
  - fractions are right for a done row
  - `null` when burning in subtitles
  - `null` when pending
- `nativeClient.test.ts`: the fixtures, re-recorded.
- Android `PictureGeometryTest`:
  - `frameRect` for each mode, using the Mummy area on a 16:9 screen. Zoom gives a frame of 1.333 × screen height with
    the area covering the screen; Fit gives the area fitted.
  - a full-frame area (0,0,1,1) on a 16:9 screen reproduces today's Fit and Zoom sizes
  - a 20:9 screen with Fit gives an area wider than the 16:9 case
- Android `ContractFixturesTest`: `pictureArea` decodes.
- Web: a new `MediaInfoPanel.test.tsx` (none exists today): the line renders when the fields are set and is hidden
  when they're null.

## 8. Tasks
| Task | Files | Spec | Depends on | Checks |
|---|---|---|---|---|
| T1 Server detection and storage | `db/migrations/022_picture_area.ts`, `db/db.ts`, `repositories/movieRepository.ts`, `config/pictureArea.ts`, `services/pictureArea/{cropDetector,pictureAreaMath,pictureAreaService}.ts` + tests, `services/scanService.ts`, `app.ts` | full | – | migration adds the 5 columns, existing rows are `pending`; `MovieRow` and `map` carry the area; `pictureAreaMath.test.ts` covers the §7 cases; scan finishes without waiting for detection and then triggers `runPending`; a size/mtime change resets the status to pending; `npm test --workspace @ottlib/server` passes |
| T2 API, contract and Kotlin DTOs | `packages/shared/src/playback.ts`, `packages/shared/src/index.ts`, `services/playbackService.ts`, the movie → mediaInfo mapper, `routes/nativeClient.test.ts`, `contract/fixtures/*.json`, `core/model/.../Playback.kt`, `core/model/.../Movie.kt`, `ContractFixturesTest.kt` | full | T1 | `pictureArea` holds fractions, or `null` when pending, unknown or `burnSubtitleOrder` is set; fixtures re-recorded with a non-null area; `shared/src/playback.test.ts` and `embeddedSubtitles.test.ts` pass; `./gradlew :core:model:test` passes with the strict decode; `apiVersion` unchanged |
| T3 Web media info line | `packages/client/src/components/MediaInfoPanel.tsx`, new `MediaInfoPanel.test.tsx` | full | T2 | the line shows as in §6 when set and is hidden when null; client tests and the build pass |
| T4 Android picture modes on the area | `core/player/.../PictureGeometry.kt`, `PictureModeController.kt`, `PictureGeometryTest.kt`, `core/presentation/.../PlayerViewModel.kt`, `tv/.../PlayerSurface.kt`, `tv/.../PlayerScreen.kt`, `mobile/.../VideoView.kt`, `mobile/.../PlayerSurface.kt`, `mobile/.../PlayerScreen.kt` | partial | T2 | the `frameRect` tests in §7 pass; with `null`, the controller's behaviour is unchanged (same resize modes, `MATCH_PARENT` frame); the area is re-applied on video-size, layout and `playViaServer` changes; `./gradlew test :tv:assembleDebug :mobile:assembleDebug` passes |

T3 and T4 can run alongside each other once T2 is merged.

## 9. Risks and known gaps
- **Sizing `exo_content_frame` directly** relies on PlayerView's layout, as the existing controller already does
  (`PictureModeController.kt:17-22`). If a Media3 update changes it, the frame lookup returns null and the area is
  ignored. The SurfaceView stays a SurfaceView, so the HDR and tunnelled paths are untouched. This needs a check on a
  real TV during review.
- **Films whose aspect varies** (IMAX scenes): the union keeps the tallest picture, so the narrower scenes keep thin
  bars. That is the safe side.
- **A bright logo or burned-in subtitle inside a bar** widens the union toward the full frame. That too is the safe side:
  it means less crop, never wrong crop.
- **First scan after the update:** about 7 s per 4K file over the network share, in the background, one file at a time.
  A 500-title library takes around an hour. The scan itself is not slowed down.
- **Image subtitles burned in by server fallback** turn the area off for that session (§2), so the bars come back while
  burn-in is on.
- **No manual override** and no per-title "re-detect" button. To re-check a file, change it on disk or clear its status.
  A follow-up can add one if detection proves wrong somewhere.
- **Web player:** no change by decision.

## 10. Progress log
- 2026-10-25: plan written and approved.
- 2026-10-25: built by /plan-runner (run 20261025-letterbox-detection), 4 tasks, all reviewed; checks and gate passed.
  - Change from §3: the server-only area is read with `movieRepository.getPictureArea(id)`, not a field on `Movie`
    (`Movie` is the zod type and is serialized to clients).
  - T1 review fixes: `applyPictureArea` only writes when size/mtime still match, so a file changed mid-detection keeps
    `pending`; a `runPending()` during a pass queues one more pass.
  - Contract fixture: `playback-source.json` `pictureArea` = {x 0, y 0.125, width 1, height 0.75}; the HLS fixture is `null`
    (subtitles burned in); `movie.json` has `pictureWidth` 3840, `pictureHeight` 1620.
  - Geometry, Mummy area on 1920×1080: Fit frame 1920×1080 (picture 1920×816 at top 132); Zoom ≈2541×1429 at −311,−175;
    Stretch 1920×1429 at 0,−175; forced 4:3 picture 1440×1080 at 240,0. Fit on 2400×1080 (20:9): picture 2400 wide.
  - Open: a real-TV check of sizing `exo_content_frame` (§9); no PlayerViewModel test (no VM test setup exists yet).
