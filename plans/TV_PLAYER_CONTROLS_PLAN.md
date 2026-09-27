# Ottlib TV — Skip Controls & Picture Modes

> **Status (2026-09-27):** P1 and P2 implemented. Verified on the emulator at TV geometry: tap coalescing ("+30s → 0:35", one seek), configurable steps (⏩ shows the chosen value), hold-OK panel with live preview, Back to cancel, Zoom on a 2.40:1 film, forced 4:3, per-title memory across replays, one-time hint. Hold-to-accelerate is covered by unit tests only (emulator key injection can't hold a key). Still to check on the BenQ: Zoom with HDR/Dolby Vision, bottom subtitles on 4:3 content.

## Context

Two requests from using the TV app on the BenQ GP01:

1. **Skip is too coarse.** ←/→ jump −10s / +30s, hard-coded in `OttlibPlayerFactory` (`PlayerDefaults.SEEK_BACK_MS / SEEK_FORWARD_MS`). Every press also seeks immediately, so five presses on a 4K remux = five re-buffers over Wi-Fi.
2. **No VLC-style picture options.** The player always letterboxes (Fit). There's no way to fill the screen (pan & scan), stretch, or fix files with the wrong aspect ratio.

Both live in the same player code (`tv/ui/player/*`, `core/player/*`), so they ship together.

**Which player?** Ottlib embeds **Media3 ExoPlayer** (not an Android TV system player). Decoding uses the TV's hardware `MediaCodec`, and picture geometry is ours to control through Media3's `PlayerView`. Everything below changes *layout only* — HDR10 / Dolby Vision, hardware decoding and audio passthrough are unaffected.

### Decisions

| Topic | Decision |
|---|---|
| Default skip | **10s back / 10s forward** (Netflix/YouTube convention), adjustable in Settings |
| Skip choices | Back: 5 · 10 · 15 · 30s — Forward: 5 · 10 · 15 · 30 · 60s |
| Holding ←/→ | Accelerates: 10s steps → 30s after 1s held → 60s after 3s held |
| Seeking | Presses are **coalesced**: one seek after input settles (400 ms) or on key release |
| Picture modes (v1) | Fit · Zoom (fill + center crop) · Stretch · 16:9 · 4:3 · 2.39:1 |
| Picture memory | Global default in Settings + **per-title override**, stored on the TV |
| Opening picture options | **Long-press OK** during playback (every remote has OK); also Menu/Info keys where present |
| Subtitles in Zoom | Moved from the video frame to the full-screen overlay, so cropping never cuts them off |

### Non-goals

- Server changes — all of this is per-device TV state.
- Chapter skipping (needs server-side chapter probing; separate plan).
- Zoom steps / moving the crop / 1:1 "Center" (Phase 3, only if wanted).

## Part 1 — Skip controls

### Behaviour

| Input (controls hidden) | Result |
|---|---|
| Tap → / ← | Adds one step to a pending seek; hint shows `+10s` |
| Tap again within 400 ms | Adds another step; hint shows `+20s`; **no seek yet** |
| 400 ms without input | One seek to the accumulated target |
| Hold → / ← | Steps are added every 250 ms, **timed by how long the key is held**, not by key-repeat events (remotes repeat ~20×/s, which would be 200s per second). Step grows 10s → 30s (after 1s) → 60s (after 3s) |
| Release after hold | Seeks immediately |
| Media ⏩ / ⏪ keys | Same as holding → / ← |
| Controls visible, seek bar focused | Seek bar moves by the forward step (`DefaultTimeBar.setKeyTimeIncrement`) |

Hint text shows direction, total and destination, e.g. `+1:20  →  42:10`. Targets are clamped to `[0, duration − 1s]`.

**OK key change:** today OK toggles pause on key *down*. To allow long-press, OK acts on key *up* unless it was held ≥ 500 ms (then it opens picture options and the release is swallowed).

### Design

`SeekAccumulator` — pure Kotlin in `core/player`, no Android types, driven by `(direction, keyDownTime, eventTime, isRelease)` plus a clock. It returns "pending offset" updates and a "commit now" signal. Being pure makes the timing rules unit-testable with a fake clock.

`PlayerKeys.kt` becomes a thin adapter: key events → `SeekAccumulator` → `player.seekTo(target)` + hint.

Skip steps are read from `PlaybackPreferences` when the player is created, and applied to:
- `SeekAccumulator` base steps
- `ExoPlayer.Builder.setSeekBackIncrementMs / setSeekForwardIncrementMs` — PlayerView's ⏪/⏩ buttons show the number automatically
- the controls' `DefaultTimeBar` key increment

## Part 2 — Picture modes

### Modes

| Mode | VLC equivalent | Implementation |
|---|---|---|
| **Fit** (default) | Best fit | `RESIZE_MODE_FIT` |
| **Zoom** | Fill / crop — pan & scan, centered | `RESIZE_MODE_ZOOM` |
| **Stretch** | Stretch | `RESIZE_MODE_FILL` |
| **Smart fill** | — (TV "wide zoom") | `RESIZE_MODE_ZOOM` with the frame set to the geometric mean of video and screen ratios: a 2.40:1 film is trimmed ~14% and stretched ~16% (vs 26% / 35%) — `PictureGeometry` |
| **16:9 · 4:3 · 2.39:1** | Aspect ratio override | `RESIZE_MODE_FIT` + override the video frame's aspect ratio |

All of these use public `PlayerView` API or the documented layout ids of its layout contract:
- `PlayerView.setResizeMode(...)`
- The video frame is `exo_content_frame`, an `AspectRatioFrameLayout` with public `setAspectRatio(float)`. `PlayerView` resets it on every video-size change, so a forced ratio is re-applied from an `AspectRatioListener` / `onVideoSizeChanged` callback (posted after PlayerView's own update).
- `PlayerView.getSubtitleView()` is moved into `PlayerView.getOverlayFrameLayout()` (full-screen) once, at creation. In the stock layout it sits *inside* the video frame, which Zoom enlarges past the screen edges — bottom subtitles would be cropped on 4:3 content.

### UI

Long-press OK opens a **Picture panel** (Compose side sheet, right edge, video keeps playing behind it):

```
Picture
  ● Fit
  ○ Zoom
  ○ Stretch
  ○ 16:9
  ○ 4:3
  ○ 2.39:1
  ─────────────
  [✓] Remember for this title
```

- Moving focus previews the mode live; OK confirms; Back cancels and restores the previous mode.
- The first time a video plays, a one-off hint appears: *"Hold OK for picture options"*.
- Settings → Playback gains **Default picture mode** and **Skip back / Skip forward**.

### Storage

- `PlaybackPreferences`: `skipBackSeconds`, `skipForwardSeconds`, `defaultPictureMode`.
- `PictureModeStore` (new, `core/data`): per-title overrides as a JSON map in DataStore, keyed by movie id, capped at 300 entries (least-recently-used dropped). Kept on the TV like other playback preferences; the server isn't involved.

## Files

```
core/player/
  SeekAccumulator.kt            NEW   pure seek-coalescing + hold-acceleration logic
  SeekAccumulator.test.kt       NEW   (src/test) taps, coalescing window, hold timing, clamping, direction change
  PictureMode.kt                NEW   enum: label, resize mode, forced aspect ratio (nullable)
  OttlibPlayerFactory.kt        EDIT  TrackPreferences → PlayerSettings (adds skip steps)
core/data/
  PlaybackPreferences.kt        EDIT  skip steps + default picture mode
  PictureModeStore.kt           NEW   per-title overrides (LRU-capped)
tv/ui/player/
  PlayerKeys.kt                 EDIT  adapter over SeekAccumulator; OK acts on release; long-press detection
  PictureModeController.kt      NEW   applies a PictureMode to PlayerView; re-applies forced ratios; moves SubtitleView
  PicturePanel.kt               NEW   Compose side sheet with live preview
  PlayerScreen.kt               EDIT  wire panel, hints, controller
  PlayerViewModel.kt            EDIT  load/save picture mode for the title, expose skip settings
tv/ui/settings/
  SettingsScreen.kt / ViewModel EDIT  Skip back, Skip forward, Default picture mode rows
```

Every file stays well under the 300–400-line guideline; `PlayerScreen.kt` (167 lines today) gets its new pieces as separate files rather than growing.

## Milestones

| # | Deliverable | Done when |
|---|---|---|
| **P1** | Skip settings, coalesced taps, hold acceleration, media keys, seek-bar increment | `SeekAccumulator` tests pass; on the projector: 5 quick taps → one re-buffer; holding → reaches +5 min in ~6s |
| **P2** | Picture modes + panel + per-title memory + subtitle relocation + Settings default | Each mode verified on the test matrix below; the choice survives app restart |
| **P3** *(optional)* | 1:1 "Center", zoom steps (110–150%), moving the crop with arrows while zoomed | Only if P2 leaves a real gap |

### Test matrix (on the BenQ GP01)

| Content | Check |
|---|---|
| 2.39:1 scope movie | Zoom fills height, crops sides; subtitles intact |
| 4:3 TV episode | Zoom crops top/bottom; **bottom subtitles still visible**; 4:3 override is a no-op |
| 16:9 1080p | All modes; Stretch = Fit |
| Mis-flagged anamorphic rip | 16:9 override fixes the squeezed image |
| 4K HDR10 / Dolby Vision | Zoom keeps HDR active (projector's HDR indicator stays on) |
| 4K remux over Wi-Fi | Hold → for 5s then release: a single re-buffer |

## Risks

- **PlayerView internals.** `exo_content_frame` and the subtitle move rely on PlayerView's documented layout ids, not private API — but a Media3 upgrade could change them. Mitigation: `PictureModeController` is the only file touching them, and it falls back to plain `setResizeMode` if a view isn't found.
- **Long-press OK discoverability.** It's invisible, hence the one-time hint. If it proves awkward, P3 can add a visible "Picture" button by overriding the controls layout.
- **Seek coalescing delay.** 400 ms feels instant for taps; if it feels laggy it's one constant.
