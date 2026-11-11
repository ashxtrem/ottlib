# Hashlark find hand-off

Approved by the user (2026-11-11: "Approved").
Issue: #64
Asked by the user (2026-11-11): let OttLib's Find hand a search to the Hashlark desktop app (`E:\Projects\torseek`) instead of
qBittorrent, as an option. Hashlark opens on the server PC, also when the ask comes from Android TV.

## 1. Why
- **Find only works through qBittorrent.** Every Find entry leads to the in-app `/torrents` page, which searches with
  qBittorrent's plugins and sends results to qBittorrent (`packages/server/src/routes/torrents.ts:14-21`,
  `providers/torrent/qbittorrentSearch.ts:19-46`). There is no other find path and no pluggable interface
  (`plans/TORRENT_SEARCH_PLAN.md:11-13`).
- **TV and phone have no Find at all.** No torrent, find or download screen, API call or DTO exists under `apps/android`.
- **Hashlark can't take a search from another app today.** Its desktop exe parses no arguments, registers no link scheme,
  and a second launch only focuses the window and drops its arguments (hashlark `apps/desktop/src-tauri/src/main.rs:50-55`).
  Its local HTTP API uses a random port and token per launch that are never written to disk
  (hashlark `crates/hashlark-server/src/lib.rs:259-275`). So Hashlark needs a small change too (§8).

## 2. Decisions
User (2026-11-11):
- **Hashlark gets a `hashlark://` link; OttLib opens the link.** No exe path setting. Windows starts Hashlark when it is
  closed; the running app takes the search and comes to the front. Auto-detect is "the link is registered".
- **A setting picks one: qBittorrent or Hashlark.** With Hashlark, every Find button opens Hashlark; the in-app torrent
  search page, upgrade finder and active-downloads strip are hidden and no qBittorrent details are needed.
- **Web, TV and phone all hand off, always to the server PC,** whichever device asked (a browser on another device too).
- **Android Find appears in three places:** the title detail screen, library search with no match, and missing collection
  parts (new cards on TV and phone).

My calls (change any at approval):
- **Setting:** new key `findProvider: 'qbittorrent' | 'hashlark'`, default `'qbittorrent'`. `torrentSearchEnabled` stays the
  on/off switch, so nothing changes for today's users.
- **Link contract:** `hashlark://search?q=<title year>&cat=movies[&imdb=tt…]`; `hashlark://search` with no query just
  opens and focuses. Title capped at 200 characters; `imdb` must match `^tt\d{5,10}$`.
- **Buttons with no title** (web floating button, empty library): in Hashlark mode they read "Open Hashlark" and open it
  with no search.
- **Endpoints:** `POST /api/find/handoff` (only in Hashlark mode, else 404) and `GET /api/find/status` (always on, so
  Settings can show "found / not found" before saving). Not installed → `409 HASHLARK_NOT_FOUND`.
- **No loopback check on the hand-off** (follows the user's "any device" call); it sits behind the access PIN like every
  other route (`routes/authGuard.ts:24-27`). The server builds the link itself from validated fields; clients never send a URL.
- **Launch without a shell:** `rundll32.exe url.dll,FileProtocolHandler <link>`. Rejected: `cmd /c start` as
  `localLaunch.ts:17` does, because `&` in the link is a cmd separator.
- **Detection:** `reg.exe query HKCR\hashlark\shell\open\command /ve` exits 0. Windows only in this plan; on other systems
  status says "not available".
- **Android learns the mode from `/api/server-info`:** new field `findHandoff: 'hashlark' | null`. Additive, so no
  `apiVersion` bump: the app's Json ignores unknown keys (`core/network/.../OttlibJson.kt:6-9`).
- **Messages:** web "Opened in Hashlark on the server PC."; Android the same plus the server's name; not installed:
  "Hashlark isn't installed on the server PC."
- **Pluggable piece:** `FindHandoff` interface, one file per app (AGENTS.md plug-in pattern). Rejected: putting qBittorrent's
  in-app search behind the same interface; it searches inside OttLib, a different shape.
- **Missing-part cards on Android appear only in Hashlark mode;** otherwise today's "N more not in your library" text stays.
- **The Hashlark change is not built by `/plan-runner`** (other repo, no runner there). §8 is its brief; OttLib is built
  and tested against a fake, and works end to end once the new Hashlark is installed on the server PC.

## 3. Shared types (`packages/shared`)
- New `src/find.ts`: `findProviderSchema` (`z.enum(['qbittorrent','hashlark'])`); `findMode(settings)` →
  `'off' | 'qbittorrent' | 'hashlark'` (off when `torrentSearchEnabled` is false, else `findProvider`);
  `findHandoffRequestSchema { title?: string(1..200), year?: int, imdbId?: /^tt\d{5,10}$/ }`;
  `findHandoffResultSchema { app: 'hashlark' }`; `findStatusSchema { mode, hashlarkAvailable: boolean }`.
- `src/index.ts:198-204`: add `findProvider: findProviderSchema` beside `torrentSearchEnabled` (imported from `./find`).
- `src/playback.ts:118-125` `serverInfoSchema`: add `findHandoff: z.enum(['hashlark']).nullable()`.

## 4. Server (`packages/server/src`)
| Layer | File | What |
|---|---|---|
| config | `config/hashlark.ts` (new) | scheme `hashlark`, registry key, launcher command and args, category `movies`, title cap |
| config | `config/defaults.ts:44` | `findProvider: 'qbittorrent'`. No migration: `settingRepository.ts:8-12` merges defaults |
| provider | `providers/find/FindHandoff.ts` (new) | `interface FindHandoff { name: string; available(): boolean; open(query: FindQuery): void }` |
| provider | `providers/find/hashlarkLink.ts` (new) | `hashlarkSearchUrl(query)` (pure); `available()` runs the registry probe (injected, `execFileSync`, `windowsHide`), false off Windows; `open()` spawns the launcher with `{ detached: true, stdio: 'ignore', windowsHide: true }` and `unref()`, taking the `Spawner` type of `providers/playback/localLaunch.ts:6` |
| service | `services/findHandoffService.ts` (new) | `status()`; `send(request)` throws `FindError('HASHLARK_NOT_FOUND')` when not available, else `open()` and returns `{ app }` |
| route | `routes/find.ts` (new) | `GET /api/find/status`; scoped `POST /api/find/handoff` with an `onRequest` hook that 404s unless mode is `hashlark` (shape of `routes/torrents.ts:12-13`); 409 body `{ error: 'HASHLARK_NOT_FOUND', message }` (shape of `routes/playback.ts:13`) |
| health | `services/health/checks/hashlarkCheck.ts` (new) | warns when mode is `hashlark` and the link isn't registered; added in `services/health/healthChecks.ts:30-41` |
| wiring | `app.ts` | `:128` `AppOverrides.findHandoff?`; `:157` and `:167` the qBittorrent gate becomes `findMode(settings.get()) === 'qbittorrent'` (torrent routes and the qBittorrent health check go quiet in Hashlark mode); register find routes; `:171` pass `findHandoff` to `ServerInfoService` |
| service | `services/serverInfoService.ts:11` | returns `findHandoff: 'hashlark'` in Hashlark mode, else `null`. The new constructor argument is optional (default `null`), so `index.ts:15-16` (`new ServerInfoService(config.port)`) stays as it is |
| script | `scripts/doctor.ts:31-37` | the second `healthChecks()` caller: give it the same qBittorrent gate and the Hashlark check's dependency |

## 5. Web (`packages/client/src`)
- `hooks/useFindMode.ts` (new) replaces `hooks/useTorrentSearchEnabled.ts:4-6` (deleted; its callers move over).
- `hooks/useFindHandoff.ts` (new): mutation on `POST /api/find/handoff`; success and error toasts through `useToast`
  (as `components/TorrentSendButton.tsx` does).
- `components/FindButton.tsx` (new): by mode renders nothing, a `Link` to `/torrents?q=…&year=…` (today's href, moved from
  `CollectionRow.tsx:9-11`), or a button that hands off. Used by `MovieActionButtons.tsx:36`, `CollectionRow.tsx:33`,
  `App.tsx:35` and `LibraryEmptyState.tsx:39`. `CollectionRowView` and `LibraryEmptyState` take a `findMode` prop in place
  of `torrentSearchEnabled`; `pages/LibraryPage.tsx:64` passes it.
- `pages/TorrentSearchPage.tsx:12-14`, `pages/UpgradeFinderPage.tsx:43-47`: gate on mode `qbittorrent`; in Hashlark mode
  the panel reads "Find is set to Hashlark" with an "Open Hashlark" button and a link to Settings.
- Settings: `components/FindSettingsSection.tsx` (new) holds the on/off checkbox (label "Find and torrent search") and a
  "Find with" choice (qBittorrent / Hashlark). qBittorrent shows today's fields (`QbittorrentSettingsSection.tsx:25-48`,
  minus its checkbox at `:22`); Hashlark shows `components/HashlarkSettingsSection.tsx` (new): a status line from
  `GET /api/find/status` ("Hashlark found on the server PC" / "Not found. Install Hashlark on the server PC.") and an
  "Open Hashlark" button, enabled once Hashlark mode is saved. `pages/SettingsPage.tsx:49,60,124-137,153`: `findProvider`
  state and save; qBittorrent fields are sent only when the provider is qBittorrent.

## 6. Android (`apps/android`)
- `core/model`: `ServerInfo.kt:10-18` gains `val findHandoff: String? = null`; new `FindHandoff.kt` with
  `FindHandoffRequest(title, year, imdbId)` and `FindHandoffResult(app)`.
- `core/network/OttlibApi.kt`: `suspend fun findHandoff(request)` via `send("POST", url("/api/find/handoff"), …)` (pattern of
  `:87-88`).
- `core/presentation/find/FindLauncher.kt` (new, UI-neutral, one per app in `AppContainer.kt:66-67`):
  `available: StateFlow<Boolean>` from `ConnectionManager.serverInfo` (`core/data/.../ConnectionManager.kt:32-34`),
  `messages: SharedFlow<String>`, `find(title, year, imdbId)`. Maps `ApiException.errorCode == "HASHLARK_NOT_FOUND"`
  (`core/network/.../ApiException.kt:9`) to the not-installed message. Rejected: adding it to `DetailsViewModel` and
  `SearchViewModel`, which would repeat the same code in two ViewModels and the collection row.
- `core/presentation/details/CollectionSummary.kt:8-11`: add `missing: List<MissingPart>` (title, year, posterUrl) mapped
  from `MovieCollection.missing` (`core/model/.../MovieCollection.kt:17-22`); `missingCount` stays.
- Each app's NavHost collects `messages` once and shows a Toast, beside `SyncOutcomeToasts` (TV `OttlibNavHost.kt:22,40`,
  mobile `OttlibNavHost.kt:20,36`).

## 7. API and contract
- `packages/server/src/routes/nativeClient.test.ts:342-344`: re-record `contract/fixtures/server-info.json` (new
  `findHandoff: null`); add a case that turns Hashlark mode on with a fake `FindHandoff` override and snapshots
  `find-handoff.json` (the 200 body).
- `core/model/.../ContractFixturesTest.kt:21`: add `"find-handoff" to FindHandoffResult.serializer()`; it decodes strictly
  (`:17`), so the `ServerInfo` field lands in the same change.
- `apiVersion` stays 1 (`packages/shared/src/playback.ts:5`): one added field, two new endpoints.

## 8. Hashlark side (separate repo `E:\Projects\torseek`, not a `/plan-runner` task)
- Add `tauri-plugin-deep-link` and turn on the `deep-link` feature of `tauri-plugin-single-instance`
  (`apps/desktop/src-tauri/Cargo.toml:28`); declare scheme `hashlark` under `plugins.deep-link.desktop.schemes` in
  `tauri.conf.json:67-76`; add `deep-link:default` to `capabilities/default.json:8-13`. The NSIS and MSI installers then
  register the link.
- UI: read the launch link and listen for later ones; a pure `parseSearchLink(url)` → `{ q, cat, imdb }` (vitest), then set
  `search.text` and `search.categories` and call `search.run` (`apps/desktop/src/lib/state/search.svelte.ts:21-22,71`).
  Today `+page.svelte:40-50` reads `?q=` on mount only.
- Keep `unminimize()` + `set_focus()` in the single-instance callback (`main.rs:50-55`) and also focus after a link that
  started the app.
- `imdb` rides in the link but the UI doesn't send it to search yet (`apps/desktop/src/lib/api/client.ts:110-116`); using it
  is optional there.

## 9. Screens
- **Web** (phone and desktop widths, dark mode): Find buttons keep their place and style; only label and action change by
  mode. Settings: the "Find with" choice stacks under the checkbox at phone width.
- **TV:** `DetailsScreen.kt:125-158` gets an OutlinedButton "Find in Hashlark" after "Play in another app". On a missing
  title it takes initial focus (Play is disabled there, `:137`, focus request `:202-210`). `CollectionRow.kt:55-70`: missing
  parts follow the owned cards in the same row (dimmed poster, title, year, "Find" caption); OK finds; Left/Right move
  through the row; focus restore keeps working for owned cards. `SearchScreen.kt:65-71`: under "No titles match", a button
  "Find “<text>” in Hashlark"; Down from the field reaches it (`:55-63`). Back is unchanged everywhere.
- **Phone:** `DetailsSections.kt:37-64` gets a SecondaryButton "Find in Hashlark"; `CollectionRow.kt:33-38` gets the
  missing-part cards; `SearchScreen.kt:74` gets the button under the empty message. Nothing branches on device: the
  buttons sit in the existing rows, so cover, inner, tabletop and split-screen layouts follow the current width classes.

## 10. Tests to change or add
- Server: `hashlarkLink.test.ts` (link building and encoding, registry probe, spawn args, off Windows),
  `findHandoffService.test.ts`, `routes/find.test.ts` (404 when off or qBittorrent, 409 not installed, 200, bad `imdbId`
  400), `hashlarkCheck.test.ts`; `routes/torrents.test.ts:19-35` adds "404 in Hashlark mode"; `serverInfoService` case;
  `routes/health.test.ts:48-52` keeps pinning the qBittorrent check in qBittorrent mode and adds "absent in Hashlark mode".
- Web: `FindButton.test.tsx` (three modes); update `MovieActionButtons.test.tsx:10`, `CollectionRow.test.tsx:10`,
  `LibraryEmptyState.test.tsx:12`, `QbittorrentSettingsSection.test.tsx:7`; `FindSettingsSection.test.tsx`.
- Android: `OttlibApiTest` case for `findHandoff`; `FindLauncherTest` (available flag, success message, not-installed
  message) with MockWebServer; `DetailsCollectionTest.kt` gains an assertion on
  `CollectionSummary.missing` beside the `missingCount` one at `:70`; `ContractFixturesTest`.

## 11. Tasks
| Task | Files | Spec | Depends on | Checks |
|---|---|---|---|---|
| T1 Shared types and server hand-off | `packages/shared/src/{find,index,playback}.ts`; server files of §4 (with `scripts/doctor.ts`) and their tests | full | – | Hashlark mode: `POST /api/find/handoff` spawns the launcher once with the encoded link and no shell; not registered → 409 `HASHLARK_NOT_FOUND`; torrent routes and the qBittorrent health check are off in Hashlark mode, unchanged in qBittorrent mode; `/api/server-info` carries `findHandoff`; `npm test --workspace @ottlib/server` passes |
| T2 Contract and Android API | `routes/nativeClient.test.ts`, `contract/fixtures/{server-info,find-handoff}.json`, `core/model` (`ServerInfo.kt`, `FindHandoff.kt`, `ContractFixturesTest.kt`), `core/network/OttlibApi.kt` + `OttlibApiTest.kt` | full | T1 | fixtures re-recorded with `npx vitest run -u`; `ContractFixturesTest` passes strictly; `OttlibApi.findHandoff` posts the JSON body; `apiVersion` still 1 |
| T3 Web Find and settings | client files of §5 and their tests | partial | T1 | qBittorrent mode renders the same links as today; Hashlark mode buttons post and toast; `/torrents` and `/torrents/upgrades` show the Hashlark panel; settings save `findProvider` and send qBittorrent fields only in qBittorrent mode; client tests pass |
| T4 Android FindLauncher | `core/presentation` (`find/FindLauncher.kt`, `AppContainer.kt`, `details/CollectionSummary.kt`) + tests | full | T2 | `available` follows `serverInfo.findHandoff`; success and not-installed messages emitted; `CollectionSummary.missing` filled; `:core:presentation:test` passes |
| T5 TV screens | `tv/ui/details/{DetailsScreen,CollectionRow}.kt`, `tv/ui/search/SearchScreen.kt`, `tv/.../OttlibNavHost.kt` | partial | T4 | Find shows only when available; initial focus is Find on a missing title; missing cards reachable by D-pad and focus restore still works; Down from the search field reaches the Find button; `:tv:assembleDebug` passes |
| T6 Phone screens | `mobile/ui/details/{DetailsSections,CollectionRow}.kt`, `mobile/ui/search/SearchScreen.kt`, `mobile/.../OttlibNavHost.kt` | partial | T4 | Find shows only when available; missing cards appear in Hashlark mode only; search no-match button finds the typed text; `:mobile:assembleDebug` passes |

T3 runs alongside T2 and T4. T5 and T6 run alongside each other.

## 12. Risks and known gaps
- **Window focus.** Windows may only flash the taskbar when a background process brings an app forward. Hashlark's
  `set_focus()` usually wins; check by hand from the server PC's browser and from the TV once §8 is installed.
- **Launcher behaviour.** `rundll32 url.dll,FileProtocolHandler` from the hidden node process is untested here; the
  fallback is `explorer.exe <link>` (one line in `config/hashlark.ts`).
- **Any device on the network can open Hashlark on the server PC** (the user's call). It can only start a search, and only
  past the access PIN when one is set.
- **Android picks up a mode change on its next connect,** since `serverInfo` refreshes only then
  (`ConnectionManager.kt:47`). A stale button gets the server's 404 message.
- **Windows servers only.** Other systems report Hashlark as not available.
- **Missing collection parts carry no IMDb id** (`packages/shared/src/collections.ts:5-10`); they search by title and year.
- **Hashlark dev builds don't register the link** unless the plugin's runtime registration is used; installed builds do.

## 13. Progress log
- 2026-11-11: plan written and approved.
- 2026-11-11: built by `/plan-runner` (run `20261111-hashlark-handoff`), T1–T6 merged; §8 (Hashlark repo) left out, built
  separately. Checks: `npm run build` clean; web 91 files / 411 tests, server 113 files / 664 tests, shared 3 files / 13
  tests; Android `gradlew test` and the `:tv` / `:mobile` compiles pass.
  - Plan corrections: `LibraryPage.tsx` passes the mode to `LibraryEmptyState` only (`CollectionRow` reads the hook);
    the missing-part type is a new `MissingPart` in `core/presentation`, mapped from `MissingCollectionPart`.
  - Gate fixes: TV "Find in Hashlark" sits in its own row (the shared row clipped with three buttons); `FindLauncher`
    caps the title at 200 and drops a malformed IMDb id before the call.
  - Left as is: torrent routes' 404 text in Hashlark mode still says "Torrent search is turned off"; non-API failures on
    Android toast the raw error text; TV first focus isn't retried when server info arrives after a missing title opens.
  - Not checked on a device or browser: TV D-pad focus paths, phone layouts, web dark mode, and the real launch
    (`rundll32`) and window focus, which need the new Hashlark installed on the server PC.
