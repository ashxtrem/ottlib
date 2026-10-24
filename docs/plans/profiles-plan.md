# Profiles — Phase 1 (server, shared, web)

Up to 6 profiles per library, each with an optional PIN. Watch progress, watched state, hides and play history belong to a
profile instead of a device, so playback started on one device resumes on another. Shelves and settings stay shared.
Android support is the follow-up run (Phase 1b); this run keeps today's Android app working unchanged.

## Decisions (agreed with the user)
- Profile PIN keeps family members out of each other's lists. It is **not** a security boundary: stream URLs stay per-movie
  (`?key=` HMAC when the access PIN is on). The UI says so.
- The access PIN (`access_pin`, `auth_sessions`) is unchanged and independent: it gates the server, profiles gate the lists.
- Resets: the owner profile can clear or change any other profile's PIN and delete profiles. The owner's own PIN and the
  access PIN can be reset from the server machine (a loopback-only endpoint, same check as `play-local`) or with
  `npm run reset-pins --workspace @ottlib/server`.
- Desktop playback stays a handoff to VLC: the m3u carries the resume point, and localhost launches VLC directly with
  `--start-time`. When VLC is not found the user is pointed at videolan.org. No in-browser player, no ffmpeg in this run.
- Shelves and settings stay global.
- No apiVersion bump: endpoint shapes are unchanged, and the single-profile fallback (§3) keeps old clients working.

## 1. Schema — migration `019_profiles.ts`
Idempotent like the other steps, registered in `db/db.ts` after 018, with `019_profiles.test.ts` beside it.
```
profiles(id INTEGER PK AUTOINCREMENT, name TEXT NOT NULL COLLATE NOCASE UNIQUE, color TEXT NOT NULL,
         pin_hash TEXT NULL, is_owner INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)
profile_sessions(token_hash TEXT PK, profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                 device_id TEXT NULL, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL)
movie_hides(profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, hide_key TEXT NOT NULL,
            created_at TEXT NOT NULL, PRIMARY KEY(profile_id, hide_key))
playback_history(id INTEGER PK AUTOINCREMENT, profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                 movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE, device_id TEXT NULL,
                 method TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT NULL,
                 start_position_ms INTEGER NOT NULL DEFAULT 0, end_position_ms INTEGER NULL,
                 completed INTEGER NOT NULL DEFAULT 0)
```
- If `profiles` is empty, insert the owner profile `Home` (`is_owner=1`, first color, no PIN).
- `playback_progress` and `movie_watch_state` are re-keyed from `(movie_id, device_id)` to `(movie_id, profile_id)`:
  create-new / copy / drop / rename inside one transaction, only when the table still lacks `profile_id`. Every old row goes
  to the owner. `device_id` stays as a plain nullable column ("last device"); `shelf_id` (016) is kept.
  Duplicates (one movie on several devices): progress keeps the row with the latest `updated_at`; watch state keeps
  `MAX(watched)`.
- `method` values: `android_app | m3u | intent | local_launch`.
- Repositories, one per table: `profileRepository.ts`, `profileSessionRepository.ts`, `hideRepository.ts`,
  `playbackHistoryRepository.ts`. `playbackProgressRepository.ts` and `watchStateRepository.ts` change their key from
  device to profile.

## 2. Profiles API — shared schemas in `packages/shared/src/profiles.ts`
| Route | Who | Does |
|---|---|---|
| `GET /api/profiles` | anyone past the access guard | `[{id, name, color, hasPin, isOwner}]` |
| `POST /api/profiles {name, color, pin?}` | owner session | create; 409 `PROFILE_LIMIT` past 6, 409 `PROFILE_NAME_TAKEN` |
| `POST /api/profiles/:id/select {pin?}` | anyone | checks PIN (throttled like login, keyed ip+profile) → `{token, profile}`; stores a `profile_sessions` row with `x-device-id` |
| `POST /api/profiles/deselect` | session | deletes this session row |
| `GET /api/profiles/me` | session | `{profile}`, or 409 `PROFILE_REQUIRED` |
| `PATCH /api/profiles/:id {name?, color?}` | that profile or owner | rename / recolor |
| `PUT /api/profiles/:id/pin {currentPin?, pin: string\|null}` | that profile (needs `currentPin` when one is set) or owner (no `currentPin` for others) | set / change / clear |
| `DELETE /api/profiles/:id` | owner, not the owner profile | deletes; cascades its rows and sessions |
| `POST /api/profiles/reset-local` | loopback only | clears the owner's PIN and the access PIN |

- PINs: 4–8 digits, hashed with the access-PIN hasher. Colors: a fixed list of 6 in shared.
- Token: random 32 bytes, sent by clients as `x-profile-session`; only its SHA-256 is stored. `last_seen_at` updates at
  most once a minute.
- CLI `src/scripts/resetPins.ts` (`npm run reset-pins`): same effect as `reset-local`, prints what it cleared.

## 3. Profile resolution
A Fastify hook (own file, e.g. `routes/profileContext.ts`) sets `request.profileId` from `x-profile-session`.
Profile-scoped routes call `requireProfile(request)`:
- valid session → its profile;
- no or unknown session, and exactly one profile exists and it has no PIN → that profile (old clients keep working);
- otherwise 409 `{error: 'PROFILE_REQUIRED'}`.

## 4. Scope switch (device → profile)
Every read/write of progress, watch state, continue-watching, next-up, recommendations' watched signals, and the
device-scoped joins in `movieRepository.ts` (around `deviceScopedJoins`) use `profileId` instead of `x-device-id`.
`x-device-id` is still accepted and stored as "last device". Routes known to read `x-device-id`: `playbackProgress.ts`,
`playback.ts`, `nextPlayback.ts`, `library.ts`, `shelves.ts`, `recommendations.ts`.

## 5. Hides and plays
- `GET /api/hides` → `{keys: string[]}`; `POST /api/hides {key}`; `DELETE /api/hides {key}`;
  `POST /api/hides/import {keys: string[]}` (adds, ignores duplicates). Cap 2000 per profile (oldest dropped). Keys are the
  shared `hideKey` values (`packages/shared/src/hiddenTitles.ts`).
- `POST /api/movies/:id/plays {method, positionMs?}` → `{playId}`: inserts a `playback_history` row.
- When progress is saved (`PUT /api/movies/:id/progress`), the latest open history row for (profile, movie) started in the
  last 12 h gets `end_position_ms`, `ended_at`; reaching the watched threshold sets `completed=1`.
- `GET /api/movies/:id` (or the existing movie detail shape) is **not** changed in this run.

## 6. VLC handoff
- `providers/playback/vlcLocator.ts`: finds VLC once and caches it. Windows: `%ProgramFiles%\VideoLAN\VLC\vlc.exe`,
  `%ProgramFiles(x86)%\...`, then `where vlc`. macOS: `/Applications/VLC.app/Contents/MacOS/VLC`. Linux: `which vlc`.
- `localLaunch.ts`: with VLC found, spawn it detached with the stream URL and `--start-time=<sec>`; otherwise the old
  `start`/`xdg-open` path. `POST /api/movies/:id/play-local {startSec?, requireVlc?}` returns 409 `VLC_NOT_FOUND` when
  `requireVlc` and VLC is missing.
- `lanPlaylist.ts`: `GET /api/stream/:id/playlist.m3u?start=<sec>` adds `#EXTVLCOPT:start-time=<sec>` before the URL line
  (start > 0 only).
- `providers/playback/androidIntent.ts` is dead code: delete it.

## 7. Web
- `useProfile` hook + `ProfileGate` component: on load `GET /api/profiles/me`; on 409 show `ProfilePicker` (tiles: color
  initial + name, lock icon when `hasPin`). A PIN pad dialog for locked profiles. The token lives in localStorage
  `ottlib-profile-session`; `apiClient.ts` sends it as `x-profile-session`; any 409 `PROFILE_REQUIRED` clears it and shows
  the picker. With one PIN-less profile the picker never appears.
- Header: current profile chip with "Switch profile".
- Settings → Profiles section: list, add (max 6), rename, color, set/clear PIN, delete (owner). Owner sees "clear PIN" on
  others. A note: "Profile PINs keep lists separate; they don't secure the library."
- Hides: `useHiddenTitles` reads/writes `/api/hides`. On first load with a profile, if localStorage `ottlib-hidden-titles`
  has keys, `POST /api/hides/import` them and remove the key.
- `PlayButton`: before any handoff `POST /api/movies/:id/plays`. Get `resumePositionMs` from
  `GET /api/movies/:id/playback`; m3u path navigates to `playlist.m3u?start=<sec>`; localhost path sends `startSec` and
  `requireVlc: true`, and on `VLC_NOT_FOUND` shows a small dialog: "VLC not found — Get VLC (videolan.org) / Open with
  default player". The m3u path shows a one-line hint "Opens in VLC — don't have it? Get VLC" until dismissed
  (localStorage `ottlib-vlc-hint-dismissed`).
- Tailwind only, works at phone width.

## 8. Tests
- `019_profiles.test.ts`: fresh DB and upgrade from a DB with device rows (dedupe rules, owner created once, idempotent).
- Service tests for profile limits, PIN rules, owner rights, resolution fallback, hide cap, history update on progress.
- Route tests for the 409 codes and the loopback-only reset.
- Existing tests that send `x-device-id` and assert per-device progress must be updated to per-profile behaviour.
- Contract fixtures (`nativeClient.test.ts` → `contract/fixtures/`) must not change; if one does, stop and report.

## Tasks (plan-runner split)
| Task | Covers | Spec | Deps |
|---|---|---|---|
| T001 | §1 migration, new repos, progress/watch-state repo re-key | full | — |
| T002 | §2 + §3 shared schemas, profile service, routes, resolution hook, reset-local, CLI | partial | T001 |
| T003 | §4 scope switch across routes/services/movieRepository + §5 hides/plays routes and history update | partial | T002 |
| T004 | §6 VLC locator, local launch, m3u start-time, delete androidIntent.ts | full | T003 |
| T005 | §7 profile gate, picker, PIN pad, apiClient header, header chip, settings section | partial | T002 |
| T006 | §7 hides to server + import, PlayButton plays/resume/VLC hint + not-found dialog | full | T003, T004, T005 |
| T007 | docs: `docs/profiles.md` (how profiles, PINs and resets work) + README link | full | T002 |

## Progress log
(written by the coordinator at the end of the run)
