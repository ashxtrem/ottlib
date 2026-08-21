# Features

Feature checklist for the personal movie library app. Kept in sync with the plan at
`C:\Users\ashxt\.claude\plans\we-want-to-create-effervescent-sunset.md`.

## Core Library
- [x] Folder scanning — one or more root folders, recursive, respects a configurable ignore-list (junk dirs, sample/extras folders)
- [x] Configurable file extensions — which extensions count as "movies" (default mp4/mkv/avi/mov/m4v/wmv/flv/webm)
- [x] Filename/title parsing — strips resolution/codec/source/group tags, extracts year, falls back to folder name
- [x] Metadata matching — TMDb primary, OMDb fallback, confidence-scored, Hollywood + Bollywood coverage
- [x] Poster/backdrop caching — downloaded once to local disk, served locally (works offline after first fetch)
- [x] Manual title override + re-match — fix a bad auto-match from the movie detail page
- [x] Unmatched movies still listed — never hidden just because metadata lookup failed
- [x] Missing-file detection — soft-marks movies whose files disappear from disk, without deleting history; a failed/disconnected scan root doesn't wipe existing records

## Scanning & Automation
- [x] Manual "rescan now" trigger
- [x] Scheduled rescans — cron-based, configurable, enable/disable toggle
- [x] Scan status/progress — live progress banner, scan history log
- [x] No overlapping scans — a second trigger just returns the in-progress run

## Browsing UI
- [x] Library grid — poster wall, responsive (desktop → phone)
- [x] Search by title
- [x] Filter by watched/unwatched, genre, actor, and minimum rating
- [x] Sort (title/year/date added)
- [x] Movie detail page — backdrop, poster, plot, cast, genres, rating, runtime, and IMDb link
- [x] Watched / unwatched toggle — **per-device** (no login; each device gets a locally-generated ID, so phone and PC track watched status independently)
- [x] Dark mode (Tailwind `dark:` variants)

## Playback
- [x] Local PC playback — clicking Play launches the default player (VLC etc.) directly, no browser fiddling
- [x] "Show in folder" — highlight the file in Explorer as an alternative to auto-launch
- [x] LAN playback (PC-to-PC) — `.m3u` handoff so another computer's browser opens it in a registered player
- [x] Android native playback — `intent://` link opens the file straight into VLC/MX Player's app chooser, with an in-browser fallback if no player claims it
- [x] Byte-range streaming — real seeking/scrubbing support, `HEAD` support, proper `206`/`416` handling

## Settings
- [x] Scan folder management — add/remove roots
- [x] Extension & ignore-pattern management
- [x] TMDb/OMDb API key management — masked on read, safe partial updates
- [x] Rescan schedule (cron) configuration
- [x] Server info panel — shows LAN IP:port to type into your phone
- [x] Port/app-data path config (bootstrap-level, restart required)

## Out of scope for v1
- No user accounts/auth (single trusted LAN)
- No transcoding (direct file streaming only — can be added later if a format won't play)
- No resume-position/"continue watching" tracking (just watched/unwatched)
- No mobile app — Android access is via the phone's browser
