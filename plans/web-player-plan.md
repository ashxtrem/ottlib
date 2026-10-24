# Web player with on-the-fly remux and transcode

Approved by the user (2026-10-24: "Approve").
Issue: #20

The user asked (2026-10-24) for an in-browser player on the web app (desktop browsers, iOS Safari), like the TV and phone apps
have. Files the browser can play stream untouched; others are remuxed or transcoded on the fly, with as little lag as LAN
allows; a skip restarts the stream at the new position; progress feeds continue-watching on every device.

## 1. Why
- **The web app can't play anything itself.** Play hands off: VLC on the server PC (`POST /play-local`), an `intent://` URL on
  Android browsers, or an `.m3u` download everywhere else (`packages/client/src/components/PlayButton.tsx:33-62`). There is no
  `<video>` anywhere in `packages/client/src`, and iOS Safari can do nothing with an `.m3u`.
- **Web plays never reach continue-watching.** The web client never calls `PUT /api/movies/:id/progress`
  (`packages/server/src/routes/playbackProgress.ts:13`); only the Android apps do (`OttlibApi.kt:99-100`, every 15 s,
  `ProgressReporter.kt:22`).
- **Most of the library can't be played by a browser as-is.** Of 683 probed files: 588 MKV (no browser plays MKV), 305 HEVC
  (Safari, and Chrome/Edge with GPU support only), ~460 AC-3/E-AC-3/DTS/TrueHD audio tracks (Chrome plays none of them), 643
  PGS/VobSub image subtitle tracks, 52 HDR10/Dolby Vision files. (Measured 2026-10-24 on `data/library.sqlite`; 137 files not
  yet probed.)
- **The server only streams bytes.** `/api/stream/:id` serves single byte ranges (`services/streamService.ts:12-22`); the
  playback answer only knows `kind: 'direct'` (`packages/shared/src/playback.ts:26-33`, `services/playbackService.ts:33-43`).
  No ffmpeg is used or shipped; the full bundle ships only ffprobe (`scripts/package-server.mjs:60-68`). `plans/PLAN.md:91`
  left transcoding out of v1, and `plans/ANDROID_TV_PLAN.md:104,199` put remux/HLS in a "Phase 2" — this is it.
- **Android has no way out when its decoder fails** but "Play in another app" (`tv/.../ProblemDialog.kt:29-49`,
  `mobile/.../ProblemDialog.kt:17-35`); `retry()` just re-prepares the same source (`PlayerViewModel.kt:226-229`).

## 2. Decisions
User (2026-10-24):
- **Play opens the browser player on every web client** (desktop, iPhone/iPad, Android browser, the server PC). "Open in VLC",
  "Open in app" (Android) and "Play on the server PC" (loopback) move to a small "more" menu next to Play.
- **v1 extras: audio track switching, text subtitles, image subtitles by burn-in, up next for episodes.**
- **HDR is tone-mapped to SDR when a transcode is needed**; remux and direct keep HDR for browsers and screens that show it.
- **The TV and phone apps get the server stream as a fallback**: their problem dialog offers "Play via server".

My calls (each can be changed at approval):
- **HLS (fMP4 segments) for everything that isn't direct.** iOS Safari plays only MP4/MOV progressively and needs HLS for the
  rest; HEVC in HLS must be fMP4 for Safari. Safari (and any browser that reports native HLS) uses it natively; others use
  hls.js. Rejected: a piped fragmented-MP4 stream (no Range, so iOS can't play it, and seeking needs a custom timeline).
- **Three modes, picked per file by the server:** `direct` (today's byte-range stream), `remux` (video copied, audio copied or
  made AAC), `transcode` (H.264 8-bit via a hardware encoder, else x264). The client sends what it can play; the server decides.
- **The server writes the whole VOD playlist up front** from the duration, so the seek bar shows the full film at once and a
  skip is just a request for segment *n*. When *n* is not near what ffmpeg is producing, ffmpeg is killed and restarted at *n*.
- **Remux segments cut at every video keyframe** read from the Matroska Cues (a small EBML read, no full-file scan), so the
  playlist matches exactly where a copy-mode ffmpeg can cut, from any restart point. Files with no usable keyframe index
  (MP4/AVI that need a remux, MKV without Cues, average Cue gap > 10 s) use `transcode`.
- **Transcode segments are a fixed 4 s** with forced keyframes on the boundaries. Shorter starts faster, longer means fewer
  requests; 4 s is the usual LAN middle.
- **Encoders are plug-ins** (AGENTS.md pattern): `VideoEncoder` interface, one file each for NVENC, QSV, AMF, x264, tried in
  that order with a one-frame test encode, cached. New setting `transcodeEncoder: 'auto' | 'nvenc' | 'qsv' | 'amf' | 'x264'`
  (default `auto`). VideoToolbox/VAAPI are later, one file each. Rejected: hard-coding NVENC (only this PC has it).
- **Keyframe readers are plug-ins** too: `KeyframeReader` interface, `matroskaCues.ts` first; an MP4 `stss` reader can be
  added later as one file.
- **Transcode quality, no quality menu** (LAN): source resolution kept (capped at 2160p, or the client's `maxHeight`);
  target bitrate min(source, 2160p 30 Mbps / 1440p 20 / 1080p 12 / 720p 6 / below 4), maxrate 1.5×, bufsize 2×.
- **Audio:** copied when the client plays the codec; else AAC, 2 ch at 192k, 6 ch at 384k, 7.1 downmixed to 5.1.
- **Tone-mapping:** `libplacebo` on the GPU when the ffmpeg build has it, else `tonemap_opencl`, else `zscale`+`tonemap` on the
  CPU (scaled to ≤1080p so it stays real-time). The builder picks by probing the filters once.
- **Embedded text subtitles** (SRT/ASS/MOV_TEXT) are extracted to WebVTT on first request and cached in
  `data/subtitles/embedded/<movieId>-<order>.vtt`. Extraction reads the whole file, so the first time it can take seconds to a
  minute; the menu shows "Preparing…" until it's ready. ASS styling is dropped.
- **Image subtitles** are offered only by burn-in: turning one on starts a `transcode` session with the subtitle overlaid.
- **Switching audio track or a burn-in subtitle** asks for a new playback answer at the current position and drops the old
  session (about 1–2 s gap). Text subtitles switch instantly (`<track>`).
- **Session limits and cleanup** (`config/transcode.ts`): at most 3 `transcode` and 6 `remux` sessions at once (503 with a
  message after that); a device starting a new session ends its previous one (`x-device-id`); a session with no request for
  45 s is killed and its folder removed (sweep every 10 s); segments more than 30 behind the last request are deleted; ffmpeg is
  stopped when it is 150 segments ahead and restarted when the player gets within 30.
- **Segment wait:** a request for segment *n* waits (≤ 20 s) when *n* is between the restart point and 4 past the newest
  produced segment; anything else restarts ffmpeg at *n*.
- **Temp folder** `os.tmpdir()/ottlib-hls/<sessionId>` (override `OTTLIB_TRANSCODE_DIR`), not under `data/`: segments are
  large and throwaway, and `data/` is also served at `/media/` (`app.ts:99`). Emptied at server start and on close. (The small
  VTT cache in §6 does live in `data/subtitles/`, next to the downloaded subtitles of `subtitleLibraryService.ts:17`.)
- **ffmpeg binary:** `FFMPEG_PATH` env, else `ffmpeg` on PATH, like `FFPROBE_PATH` (`mediaProbeService.ts:113`). The full
  bundle ships a pinned ffmpeg build with NVENC/QSV/AMF/libplacebo/zimg (BtbN GPL for Windows and Linux; macOS keeps PATH),
  checksum-verified; the launchers set `FFMPEG_PATH`. The full zip grows by roughly 100 MB. With no ffmpeg, playback answers
  `direct` only and the web player says "This file needs ffmpeg on the server to play in the browser" with "Open in VLC".
- **Unprobed files** (137 today) are probed on the playback request when it carries capabilities (existing 20 s ffprobe
  timeout, `mediaProbeService.ts:127`), so the decision has codec facts.
- **Android-safe capabilities for "Play via server":** after `UnsupportedAudio`, the app asks for its normal video codecs plus
  AAC only (so it's a cheap remux); after `UnsupportedVideo` or `Error`, H.264 + AAC (a transcode).
- **Old clients see no change.** Without capabilities the playback answer is byte-for-byte today's `direct` answer, so the
  current contract fixture, the Kotlin DTO and `apiVersion` (1) stay; the new fields are optional.
- **Web progress:** `PUT /progress` every 10 s while playing, and on pause, seek end and `pagehide` (`fetch` with `keepalive`,
  so the profile headers go along); `POST /complete` on `ended`.
- **Resume:** the player opens at `resumePositionMs` and shows "Resumed at 41:20 · Start over" for 5 s.
- **Up next:** for episodes, when 20 s remain the player shows the next episode (`GET /api/movies/:id/next`,
  `routes/nextPlayback.ts:12`) with a 10 s countdown after the end; Cancel stays on the finished episode.

## 3. Playback decision (server)
- `packages/shared/src/playback.ts`: new `playbackRequestSchema` (query) and an extended `playbackSourceSchema` (§7).
- `services/playbackDecider.ts` (pure): input = probe info (`ProbedMediaInfo`, `movieRepository.ts:35`), tracks
  (`mediaTrackRepository.ts:41`; `track_order` is the ffprobe stream index, `mediaProbeService.ts:86`), keyframe availability,
  ffmpeg availability, the request. Output = `{ mode: 'direct' | 'remux' | 'transcode', audioOrder, burnSubtitleOrder,
  toneMap, reasons[] }`. Rules:
  - `direct`: container mp4/m4v/mov (as `mp4`) or webm is in `containers`, the video codec is in `video`, the chosen audio is
    the file's first audio track and its codec is in `audio`, no burn-in, and not (HDR and `hdr` false).
  - `remux`: the video codec is in `video`, HDR is fine (`hdr` true or SDR file), no burn-in, and a keyframe index exists.
  - `transcode`: everything else; `toneMap` when the file is HDR and `hdr` is false.
  - No ffmpeg → `direct`, with reason `ffmpeg-missing`.
- `services/playbackService.ts:33-43`: `source(id, viewer, request?)`; with no request it returns today's answer unchanged;
  with a request it probes if needed, runs the decider, and for `remux`/`transcode` opens a session (§5) and returns
  `kind: 'hls'`.
- `routes/playback.ts:19-22`: parse `playbackRequestSchema` from the query; 503 `TRANSCODE_BUSY` when the session limit is
  hit.

## 4. ffmpeg, encoders and keyframes (server)
- `providers/transcode/ffmpegLocator.ts`: resolves the binary (`FFMPEG_PATH` → `ffmpeg`), `-version` once, lists encoders and
  filters (`-encoders`, `-filters`), cached.
- `providers/transcode/VideoEncoder.ts`: `interface VideoEncoder { name; probe(ffmpeg): Promise<boolean>; args(o: EncodeOptions): string[] }`
  (hw decode/upload flags, scale, encoder, bitrate, forced keyframes).
- One file each: `nvencEncoder.ts` (`h264_nvenc`, `-hwaccel cuda`), `qsvEncoder.ts` (`h264_qsv`), `amfEncoder.ts`
  (`h264_amf`), `x264Encoder.ts` (`libx264 -preset veryfast`). `encoderRegistry.ts`: the ordered list and the pick for the
  `transcodeEncoder` setting (`auto` = first whose probe passes; a forced one that fails falls back to `auto` with a log line).
- `providers/transcode/toneMapFilters.ts`: the three filter chains (§2) and the pick by available filters.
- `providers/keyframes/KeyframeReader.ts`: `interface KeyframeReader { name; supports(container): boolean; read(path): Promise<number[] | null> }`
  (keyframe times in ms, for the first video track).
- `providers/keyframes/matroskaCues.ts`: reads the EBML header, the SeekHead, then the Cues element (seeking, not scanning),
  returns the CueTime list for the video track scaled by TimecodeScale; `null` when there are no Cues or the average gap is
  > 10 s. In-memory LRU (50 entries) keyed by path + mtime.
- `config/transcode.ts`: every value from §2 (segment length, limits, timeouts, bitrate ladder, audio bitrates, LRU size).

## 5. HLS sessions and routes (server)
- `services/hls/segmentPlan.ts` (pure): remux → one segment per keyframe interval (last ends at the duration); transcode →
  4 s segments. Returns `{ start, duration }[]` and the target duration.
- `services/hls/hlsPlaylist.ts` (pure): VOD playlist (`#EXT-X-VERSION:7`, `#EXT-X-PLAYLIST-TYPE:VOD`,
  `#EXT-X-TARGETDURATION`, `#EXT-X-INDEPENDENT-SEGMENTS`, `#EXT-X-MAP:URI="init.mp4"`, one `#EXTINF` per segment,
  `#EXT-X-ENDLIST`), relative URIs carrying the stream key query (`accessPinService.ts:67-70`).
- `services/hls/ffmpegCommand.ts` (pure): the argument list for a session started at segment *n*: `-ss` at the segment
  start, `-map 0:v:0`, `-map 0:<audioOrder>`, video `copy` (`-tag:v hvc1` for HEVC) or the encoder args, audio copy or AAC,
  burn-in `overlay` from `0:<subtitleOrder>` (software decode for that path), tone-map chain, `-f hls -hls_segment_type fmp4
  -hls_playlist_type vod -start_number n`, segment names `seg-%d.m4s`, timestamps kept on the film's timeline after a
  restart. **Spec partial:** the builder proves with the real-ffmpeg test (§9) that (a) copy-mode cuts land exactly on the
  planned keyframes from any restart point, (b) segments after a restart line up with the playlist in hls.js and Safari (no
  stall, no A/V drift), (c) `init.mp4` from a restart is the same as the first one. If (a) fails for a muxer option set, it may
  use `-f segment -segment_times` with fMP4 options instead, and must say which in the progress log.
- `services/hls/transcodeSessionService.ts`: `open(movie, decision, deviceId)` → `{ sessionId, playlistUrl }`; `segment(id, n)`
  → waits or restarts (§2 rules); `init(id)`; `close(id)`; the reaper, the limits, the device replacement, the
  ahead/behind window, emptying the temp root at start and in `onClose` (`app.ts:105` adds a second hook). ffmpeg is spawned
  through an injected `spawn` so tests use a fake. stderr's last 50 lines are kept for the error message.
- `routes/hls.ts`: `GET /api/hls/:id/:sessionId/main.m3u8`, `GET .../init.mp4`, `GET .../seg-:n.m4s`
  (`video/mp4`, `cache-control: no-store`), `DELETE /api/hls/:id/:sessionId`, `GET /api/transcode/encoders` (detected
  encoders, the active one, ffmpeg version). `:id` is the movie id, so the stream key check works as for `/api/stream/:id`; a
  session for another movie id answers 404.
- `routes/authGuard.ts:11`: add the three GET patterns to `streamKeyRoutes`. No profile needed (like `stream.ts:17-19`);
  the session itself was opened by the profile-checked playback request.
- `app.ts:84-97`: build `TranscodeSessionService` and the registry, register `routes/hls.ts`, pass the session service to
  `PlaybackService`.
- `config/defaults.ts:12-31`: `transcodeEncoder: 'auto'`.

## 6. Embedded text subtitles (server)
- `services/embeddedSubtitleService.ts`: `vtt(movieId, order)` → cached path or extracts with
  `ffmpeg -i <file> -map 0:<order> -f webvtt` into `data/subtitles/embedded/` (temp name, then rename); one extraction per
  track at a time; text codecs only (SRT, ASS/SSA, MOV_TEXT); 202 + `Retry-After: 2` while extracting.
- `routes/embeddedSubtitles.ts`: `GET /api/movies/:id/subtitles/embedded/:order.vtt` (`text/vtt`); added to
  `streamKeyRoutes`; registered in `app.ts`.
- `playbackService.ts:37`: with a request, the `subtitles` list also carries the embedded text tracks (URL above, codec
  `WEBVTT`), and `burnInSubtitles` lists the image tracks. Without a request the list stays today's (Android reads embedded
  subtitles itself in direct play).

## 7. API and contract
- `playbackRequestSchema` (query, all optional, comma lists): `containers`, `video` (`h264,hevc,av1,vp9`), `audio`
  (`aac,ac3,eac3,mp3,opus,flac,dts,truehd`), `hdr` (bool), `maxHeight`, `audioOrder`, `burnSubtitleOrder`, `startMs`.
  Its presence is what turns the decision on.
- `playbackSourceSchema`: `kind: z.enum(['direct', 'hls'])`, new optional `mode` (`direct | remux | transcode`), `reasons`
  (string[]), `sessionUrl` (the `DELETE` URL), `audioTracks` (`{ order, language, title, codec, channels, isDefault }[]`),
  `audioOrder`, `burnInSubtitles` (`{ order, language, title, codec, isForced }[]`), `burnSubtitleOrder`. For `hls`,
  `streamUrl` is the playlist URL and `mimeType` `application/vnd.apple.mpegurl`.
- No `apiVersion` bump (`playback.ts:4`): nothing changes without a request.
- Settings: `transcodeEncoder` in `settingsSchema` (`packages/shared/src/index.ts:156-176`).
- Contract fixtures: `contract/fixtures/playback-source.json` stays as is (pinned by `nativeClient.test.ts:152-228`); a new
  `playback-source-hls.json` recorded from a request with capabilities. Kotlin `PlaybackSource`
  (`core/model/.../Playback.kt:7-14`) gains the new fields with defaults; `ContractFixturesTest` (strict,
  `ContractFixturesTest.kt:17`) decodes both fixtures — the new one needs an entry in its fixture map (`:20-45`), since
  `:50-53` fails on any fixture without one. `ContractFixturesTest.kt:78` keeps asserting `"direct"` for the old fixture.
- Other readers of the playback answer that must keep working: `useSubtitles.ts:10` (web, no capabilities → unchanged),
  `PlayButton.tsx:54-55` (intent URL from `streamUrl`, moves to `PlayMoreMenu`), `nativeClient.test.ts:152-160,194-200,223,311`.
- `PlaybackService`'s constructor gains the session service (`playbackService.ts:20`): its callers `app.ts:88`,
  `playbackHandoff.test.ts:27` (three positional args) and `streamService.test.ts:20` (one) are updated — make it a trailing
  optional argument so the tests need no change.

## 8. Screens
**Web `/watch/:id`** (`pages/WatchPage.tsx`), full-screen black page outside the header layout but inside `PinGate` and
`ProfileGate` (`App.tsx:44-57`):
- `utils/browserCaps.ts` (pure mapping + a thin probe): `canPlayType` / `MediaSource.isTypeSupported` for mp4 avc1, hvc1
  (Main and Main 10), av01, vp9, webm; mp4a, ac-3, ec-3, opus, flac, mp3; native HLS via
  `canPlayType('application/vnd.apple.mpegurl')`; `hdr` from `matchMedia('(dynamic-range: high)')`.
- `hooks/usePlaybackSource.ts`: GET the playback answer with the capabilities (+ `audioOrder`, `burnSubtitleOrder`, `startMs`
  on a switch); `DELETE sessionUrl` on unmount, `pagehide` and on switch.
- `components/player/VideoSurface.tsx`: `<video playsInline>`; native HLS when supported, else hls.js loaded with a dynamic
  `import()` (own chunk; `packages/client/package.json` adds `hls.js` ^1.5); `<track>` per text subtitle.
- `hooks/usePlaybackProgress.ts`: the progress rules from §2; `utils/progressSchedule.ts` holds the pure "when to send" logic.
- `components/player/PlayerControls.tsx`: play/pause, ±10 s, seek bar with buffered range, time, volume/mute, subtitles,
  audio, fullscreen, back. Auto-hide after 3 s without pointer movement while playing; always shown when paused. Phone width:
  bigger touch targets, double-tap left/right third = ∓10 s. iOS: fullscreen uses `video.webkitEnterFullscreen()` (Safari's own
  controls take over; `<track>` subtitles still show).
- `components/player/TrackMenu.tsx`: audio tracks; subtitles (Off, text tracks with "Preparing…" while the VTT is 202, image
  tracks marked "burned in"). Reuses the `ShelfCardMenu.tsx:18-30` menu pattern (role menu, Escape, outside click).
- `hooks/usePlayerShortcuts.ts` + pure `utils/playerShortcuts.ts`: Space/K play-pause, ←/→ 10 s, ↑/↓ volume, F fullscreen,
  M mute, C subtitles on/off, Esc leaves fullscreen, then goes back.
- `components/player/ResumeChip.tsx`, `components/player/UpNextOverlay.tsx` (+ pure `utils/upNextTiming.ts`).
- Errors (`ffmpeg-missing`, `TRANSCODE_BUSY`, media error): a centred message with "Open in VLC" and Back.
- Dark only (the page is black); desktop and phone widths; landscape on phones fills the screen.

**Web movie page:** `PlayButton.tsx` navigates to `/watch/:id` (label "Play", or "Resume 41:20" when there's a resume
position). New `components/PlayMoreMenu.tsx` (a "⋯" button beside Play in `MovieActionButtons.tsx:27`): "Open in VLC" (the
`.m3u`), "Open in app" (only where `supportsExternalPlaybackHandoff` matches, `/Android|OculusBrowser/i` at `PlayButton.tsx:18-20`;
the Quest Browser case is pinned by `PlayButton.test.tsx:38-40`), "Play on the server PC" (only when
`useIsLocalClient`).

**TV ProblemDialog** (`tv/.../ProblemDialog.kt:29-49`): buttons "Play via server" (new, initial focus), "Play in another app",
then Retry / Watch without sound / none as today, "Back". Back key = today's dismiss rule (`:31`). Focus moves up/down the
column.
**Mobile ProblemDialog** (`mobile/.../ProblemDialog.kt:17-35`): content becomes a vertical button list in the same order
(AlertDialog has only two slots); works on the cover and inner screens and in tabletop (it's a dialog; no layout branch).
Both apps: "Play via server" keeps the current position, the progress reporter and the subtitles.

## 9. Tests to change or add
Server (vitest, next to code; route tests per `routes/auth.test.ts:10-27` or the lighter `playbackHandoff.test.ts:18-30`):
- `playbackDecider.test.ts`: a table built from the library mix (MKV H.264 + AC-3 on Chrome → remux, AAC; MKV HEVC Main 10
  HDR10 on an SDR Chrome → transcode + toneMap; MP4 H.264 AAC → direct; PGS burn-in → transcode; no Cues → transcode; no ffmpeg
  → direct; Safari caps with AC-3 → remux with audio copy).
- `matroskaCues.test.ts`: a small hand-built EBML buffer (header, SeekHead, Cues) and a file with no Cues.
- `segmentPlan.test.ts`, `hlsPlaylist.test.ts` (exact text, key query), `ffmpegCommand.test.ts` (args for copy, each
  encoder, burn-in, tone-map, restart at *n*).
- `transcodeSessionService.test.ts` with a fake spawner: near request waits; far request restarts; idle reaper; device
  replacement; limits → busy; ahead cap stops and restarts; temp root emptied.
- `routes/hls.test.ts`: 401 without session or key, 200 with `?key=`, 404 for an unknown session or another movie id.
- `hlsRealFfmpeg.test.ts` (skipped when ffmpeg isn't on PATH): makes a 30 s MKV (H.264 with irregular GOPs + AC-3) with
  lavfi, then plays it through the session service: the playlist and segment 0, a far segment (restart), and checks each
  segment starts at the planned time with ffprobe; logs time-to-first-segment for remux and transcode.
- `nativeClient.test.ts`: records `playback-source-hls.json`; the existing `playback-source.json` must not change.
- `embeddedSubtitleService.test.ts` (real ffmpeg, skipped without): SRT in MKV → VTT; 202 while running.

Client (vitest; tests are pure functions and `renderToStaticMarkup`, `PlayButton.test.tsx:1`):
- `browserCaps.test.ts`, `progressSchedule.test.ts`, `playerShortcuts.test.ts`, `upNextTiming.test.ts`.
- `PlayButton.test.tsx`: update its three cases (`:18`, `:28`, `:38`) for the link to `/watch/:id` and the resume label;
  `PlayMoreMenu.test.tsx` for which items show (local, Android UA, plain).

Android:
- `OttlibApiTest.kt:86-95`: `playbackSource` with capabilities builds the query.
- `ContractFixturesTest.kt`: decodes `playback-source-hls.json`.
- New `MediaItemsTest.kt`: `kind = "hls"` sets `MimeTypes.APPLICATION_M3U8`; `direct` sets none.
- New pure `ServerFallbackCaps` test in `core/presentation` (problem → capabilities).

## 10. Tasks
| Task | Files | Spec | Depends on | Checks |
|---|---|---|---|---|
| T1 Shared schemas | `packages/shared/src/playback.ts`, `packages/shared/src/index.ts` (settingsSchema) | full | – | `playbackRequestSchema` parses comma lists and bools; `playbackSourceSchema` accepts today's fixture unchanged and an `hls` answer; `transcodeEncoder` in settings with default handled server-side; `npm run build` of shared passes |
| T2 ffmpeg locator, encoders, tone-map | `packages/server/src/providers/transcode/*`, `packages/server/src/config/transcode.ts` | partial | – | four encoder files implement `VideoEncoder`, registry order NVENC→QSV→AMF→x264; a failing forced encoder falls back to auto; tone-map pick by available filters; no file over 300 lines |
| T3 Keyframes, segment plan, playlist | `packages/server/src/providers/keyframes/*`, `packages/server/src/services/hls/segmentPlan.ts`, `hlsPlaylist.ts` + tests | partial | – | Cues read by seeking (no full scan) on a 2 GB+ MKV in < 200 ms; `null` without Cues or with > 10 s average gap; playlist text matches §5 with key query |
| T4 Decider and playback answer | `services/playbackDecider.ts`, `services/playbackService.ts`, `routes/playback.ts`, `routes/nativeClient.test.ts`, `contract/fixtures/playback-source-hls.json`, `apps/android/core/model/.../Playback.kt`, `apps/android/core/model/src/test/.../ContractFixturesTest.kt` | full | T1, T3 | decider table test passes; a request without capabilities returns today's answer (`playback-source.json` unchanged, `nativeClient.test.ts:196-200` and `ContractFixturesTest.kt:78` still pass); `playback-source-hls.json` has an entry in `ContractFixturesTest.kt:20-45` and decodes strictly into the extended Kotlin `PlaybackSource` (AGENTS.md: fixture and DTO change together); unprobed file is probed on a capability request; 503 `TRANSCODE_BUSY` mapped |
| T5 Sessions, HLS routes, wiring | `services/hls/ffmpegCommand.ts`, `services/hls/transcodeSessionService.ts`, `routes/hls.ts`, `routes/authGuard.ts`, `app.ts`, `config/defaults.ts` + tests incl. `hlsRealFfmpeg.test.ts` | partial | T2, T3, T4 | real-ffmpeg test: copy cuts land on planned keyframes after a restart; far seek restarts, near waits; idle session killed and folder gone; `/api/hls` guarded and accepts `?key=`; time-to-first-segment logged for remux and transcode |
| T6 Embedded text subtitles | `services/embeddedSubtitleService.ts`, `routes/embeddedSubtitles.ts`, `routes/authGuard.ts`, `app.ts`, `services/playbackService.ts` | full | T5 | SRT/ASS track → cached VTT; 202 + Retry-After while extracting; capability answer lists embedded text tracks and `burnInSubtitles`; no-capability answer unchanged |
| T7 Bundle ships ffmpeg | `scripts/package-server.mjs`, `scripts/bundle/start.bat`, `start.sh`, `start.command`, `.github/workflows/release.yml`, `docs/install.md` | partial | – | full variant contains `runtime/ffmpeg(.exe)` with a verified checksum and NOTICE entry; all three launchers set `FFMPEG_PATH` (macOS `start.command` only when a bundled binary exists); lite docs say ffmpeg on PATH; `-encoders` of the shipped build lists h264_nvenc, h264_qsv, h264_amf and `-filters` lists libplacebo |
| T8 Web player core | `packages/client/src/pages/WatchPage.tsx`, `components/player/VideoSurface.tsx`, `hooks/usePlaybackSource.ts`, `hooks/usePlaybackProgress.ts`, `utils/browserCaps.ts`, `utils/progressSchedule.ts`, `App.tsx`, `packages/client/package.json` + tests | partial | T1 | `/watch/:id` renders outside the header; hls.js only in its own chunk and not loaded on Safari; progress PUT every 10 s, on pause, seek end and pagehide; session DELETE on leave |
| T9 Player controls, tracks, up next | `components/player/PlayerControls.tsx`, `TrackMenu.tsx`, `ResumeChip.tsx`, `UpNextOverlay.tsx`, `hooks/usePlayerShortcuts.ts`, `utils/playerShortcuts.ts`, `utils/upNextTiming.ts`, `WatchPage.tsx` + tests | partial | T8 | audio switch and burn-in reopen at the current position; text subtitle switch instant; shortcuts per §8; up next at 20 s remaining with 10 s countdown; phone width double-tap seek |
| T10 Play button and more menu | `components/PlayButton.tsx`, `PlayButton.test.tsx`, `components/PlayMoreMenu.tsx` + test, `components/MovieActionButtons.tsx` | full | T8 | Play goes to `/watch/:id`, "Resume mm:ss" with a position; menu shows VLC always, app only where `supportsExternalPlaybackHandoff` matches (Android and Quest), server PC only when local; existing handoffs still work from the menu (`playbackHandoff.test.ts:83-85` still passes) |
| T11 Settings: encoder | `packages/client/src/pages/SettingsPage.tsx` (new section beside the ones at `:100-102`, `:142-143`; it builds the payload at `:55-114`), new `components/settings/TranscodeSection.tsx`, `hooks/useSettings.ts` (if needed) | partial | T1, T5 | select auto/NVENC/QSV/AMF/x264 saves `transcodeEncoder`; shows detected encoders and ffmpeg version from `/api/transcode/encoders`, or "ffmpeg not found" |
| T12 Android "Play via server" | `apps/android/gradle/libs.versions.toml`, `core/player/build.gradle.kts`, `core/player/.../MediaItems.kt`, `core/network/.../OttlibApi.kt`, `core/presentation/.../player/PlayerViewModel.kt`, new `ServerFallbackCaps.kt`, `tv/.../ProblemDialog.kt`, `tv/.../PlayerScreen.kt`, `mobile/.../ProblemDialog.kt`, `mobile/.../PlayerScreen.kt` + tests | partial | T4, T5 | `media3-exoplayer-hls` (1.8.0) added; "Play via server" resumes at the current position via HLS; TV initial focus on it and Back as today; session DELETE on release; `./gradlew test :tv:assembleDebug :mobile:assembleDebug` passes |

Runs alongside: T1, T2, T3, T7 at the start; T8 after T1; T4 after T1+T3; T5 after T2+T4; then T6, T11 and T12 after T5
(T6 and T5 share `app.ts`/`authGuard.ts`, so T6 waits); T9 and T10 after T8, in parallel.

Manual checks after the merge (on the user's LAN): first frame and a far skip on a 1080p MKV H.264+AC-3 in Chrome (remux,
target ≤ 1.5 s), a 4K HEVC HDR10 file on an SDR Chrome (NVENC transcode + tone-map, target ≤ 3 s), the same files on an iPhone
in Safari (native HLS, fullscreen, subtitles), a PGS burn-in, an audio switch, continue-watching picking up on the TV app
where the web left off, and "Play via server" on the TV for a TrueHD file.

## 11. Risks and known gaps
- **Copy-mode cut alignment** is the hard part: ffmpeg's HLS muxer must cut exactly on the planned keyframes from any restart.
  T5's real-ffmpeg test pins it; the fallback is the segment muxer, and a file that still misaligns uses `transcode`.
- **Cues that don't list every keyframe** make the plan cut where ffmpeg can't; the > 10 s average-gap rule catches sparse
  ones, but a file with uneven Cues may still stall. Watch for it in the manual checks.
- **Dolby Vision profile 5** has no HDR10 base layer; correct colours need `libplacebo`. Without it the tone-map is off.
- **Burn-in with hardware decode** needs frames in system memory (software decode for that path); 4K PGS burn-in leans on the
  CPU.
- **First embedded subtitle extraction** reads the whole file (seconds on SSD, up to minutes on a slow disk).
- **Bundle size:** the full zip grows by about 100 MB; GPL ffmpeg build — NOTICE must list it.
- **Chrome's own HLS** (if a version reports `canPlayType` for m3u8) is used as native; if it misbehaves, prefer hls.js when
  MSE exists and the browser isn't Safari.
- **Not in this plan:** quality menu / bandwidth adaptation, WAN streaming, VideoToolbox/VAAPI encoders, an MP4 keyframe
  reader, ASS styling, pre-extracting subtitles during scans.

## 12. Progress log
- 2026-10-24: plan written and approved.
- 2026-10-24: built by /plan-runner (12 tasks, each reviewed; full checks and a Fable gate, then a second gate on its fixes).
  - **Muxer deviation (T5):** neither `-f hls` nor `-f segment`. The HLS muxer cut copy-mode segments on the planned
    keyframes but zero-based `tfdt` on every restart (so `init.mp4` differed between runs), and the segment muxer dropped
    `frag_discont`. ffmpeg now writes fragmented MP4 to stdout (`frag_keyframe+empty_moov+default_base_moof+frag_discont`,
    `-use_editlist 0`, copy mode `-copyts`, +10 s `output_ts_offset`) and the server splits it into `init.mp4` and
    `seg-n.m4s` by matching fragment times to the plan. Measured: cuts within 2 ms of the planned keyframes from any
    restart, restarted video `tfdt` within 1 ms, `init.mp4` byte-identical. A segment is served only once the next one
    opens (or ffmpeg exits cleanly).
  - Time to first segment (30 s lavfi test clip, this PC): remux 315 ms, transcode 726 ms (NVENC, CPU decode: this ffmpeg
    crashes with frames kept on the GPU, so a 3-frame check per encoder+codec falls back to CPU decode).
  - Encoder probes on this PC (ffmpeg 2024-01-01 gyan): NVENC, QSV and x264 pass, AMF does not; auto picks NVENC; tone-map
    picks libplacebo. The OpenCL tone-map chain is untested (tonemap_opencl segfaults here).
  - Matroska Cues read on real library files: 28.2 GB in 40 ms (110 KB read), 26.6 GB in 58 ms, 23.1 GB in 34 ms, 19.5 GB in
    44 ms. Some muxers write a Cue only about every 10 s (one UHD file averages 9.5 s), so its remux segments are ~10 s.
  - Bundle: BtbN autobuild-2026-10-23 (ffmpeg n9.0.2 GPL) for win64, linux64 and linux-arm64, SHA-256 pinned; the full zip
    grows by about 65 MB (not 100). The shipped build lists h264_nvenc/qsv/amf and libplacebo.
  - hls.js chunk 595 kB (186 kB gzip), loaded only when the browser has no native HLS.
  - Left for the manual checks: Safari native HLS with the +10 s `tfdt` offset; the Windows runner unzipping ffmpeg with
    bsdtar (release CI); the qsv/amf hardware paths against real files.
