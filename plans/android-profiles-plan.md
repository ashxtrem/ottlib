# Android profiles (Phase 1b)

Approved by the user (2026-10-25: "Appeove").
Issue: #26

From issue #26 (audit AUD-002, `reports/ottlib-independent-audit.md`). Profiles shipped for server and web as Phase 1
(`docs/plans/profiles-plan.md:5`); this is the Android follow-up that plan deferred.

## 1. Why
- **Android breaks once profiles are used.** Profile-scoped routes call `requireProfile`
  (`packages/server/src/services/profileSessionService.ts:47-52`). Without `x-profile-session` it falls back only to a sole
  PIN-less profile, else 409 `{error:'PROFILE_REQUIRED', message:'Pick a profile to continue.'}`
  (`services/profileError.ts:10`, sent by `routes/profileContext.ts:37-39`). The library, details, playback, progress,
  continue-watching, hides, shelves and recommendations all go through it (`routes/library.ts:24`, `playback.ts:21`,
  `viewer.ts:18`, `hides.ts:8`, `shelves.ts:28`, `recommendations.ts:13`). `GET /api/shelves` (`shelves.ts:22`) and
  `GET /api/movies/filter-options` (`library.ts:26`) don't.
- **The apps know nothing of profiles.** `apps/android` sends only `x-device-id` and `Authorization`
  (`core/network/DeviceIdInterceptor.kt:9`, `AuthTokenInterceptor.kt:11-16`); no profile DTO, endpoint or screen exists.
  The 409 text reaches every screen as "Pick a profile to continue." (`core/network/HttpCalls.kt:36-44`,
  `core/presentation/LoadState.kt:7-18`) with no way to pick one.
- **The contract never sees it.** `routes/nativeClient.test.ts` builds one PIN-less profile (`:24-44`), so
  `ContractFixturesTest` has no profile fixture and no 409 body.

## 2. Decisions
User (2026-10-25):
- **Scope: full Android profile support plus a clearer 409 message.** No owner-fallback stopgap.
- **Remember the profile per server.** Ask on first connect, then only when the session stops working; switch any time from
  Settings and a profile chip on Home.
- **One PIN-less profile: no picker.** The app behaves as today.
- **Profile management on the phone only** (create, rename, colour, set/change/clear PIN, delete). TV picks and enters PINs only.

My calls:
- **No owner fallback on the server.** The web shows its picker only when `GET /api/profiles/me` answers 409
  (`packages/client/src/hooks/useProfile.ts:12-28`, `components/ProfileGate.tsx:12-13`), and the server can't tell web from
  Android (no client header; `x-device-id` is sent by both). An owner fallback would hide the web picker and put old apps
  in the owner's history.
- **No `apiVersion` bump.** Everything here is additive; a bump would lock old apps out of single-profile servers that
  work today. A new app on a pre-profile server gets 404 from `GET /api/profiles` and behaves as today.
- **409 message:** `Pick a profile to continue. On Android TV or phone, update the OttLib app.` Old apps show it as is; the
  web never renders the PROFILE_REQUIRED text (it opens the picker).
- **Silent select for a sole PIN-less profile.** The app calls `POST /api/profiles/:id/select` without a PIN and stores the
  token, so a second profile added later on the web doesn't break the app (it keeps acting as that profile). The chip and
  "Switch profile" show only while the server lists 2+ profiles.
- **Global PROFILE_REQUIRED handling,** as the web does (`client/src/hooks/apiClient.ts:31`): an interceptor sees a 409
  with `error: PROFILE_REQUIRED`, clears the stored token for that server and tells `ProfileSession`, and the nav hosts go
  to the picker.
- **Profile token stored per origin** next to the auth token, same DataStore pattern as `core/data/AuthTokenStore.kt:15-35`
  (key `profile_session:<scheme://host:port>`).
- **Rights mirror the web** (`client/src/utils/profileRights.ts:14-25`): edit self or (owner), delete owner-only and never the
  owner, own existing PIN needs `currentPin`, owner may clear others' PINs, add owner-only and below `MAX_PROFILES` (6).
- **On profile change** the app refreshes what is per profile: Watch Next on TV is cleared (the next playback republishes
  it) and screens reload after the picker's `popUpTo(graph)`. The app holds no library cache (`LibrarySync.kt:46-91` is the
  scan runner).

## 3. Server
- `services/profileError.ts:10`: the new message text (above). Code and status unchanged.
- No route or schema change. Shapes used by Android (`packages/shared/src/profiles.ts`): `profileSummarySchema` `:23-29`
  `{id, name, color, hasPin, isOwner}`; `profileSelectSchema` `:33` `{pin?}`; `profileSelectResultSchema` `:34`
  `{token, profile}`; `profileMeSchema` `:35` `{profile}`; `profileCreateSchema` `:31` `{name, color, pin?}`;
  `profilePatchSchema` `:36` `{name?, color?}`; `profilePinUpdateSchema` `:38` `{currentPin?, pin: string|null}`
  (pin 4–8 digits, `shared/src/auth.ts:4`); colours `:5`; `MAX_PROFILES` `:7`; error codes `:13`; header `:16`.
- Routes (`routes/profiles.ts`): `GET /api/profiles` `:37` (no profile needed; a bare `ProfileSummary[]`, ids are ints), `POST /` `:38` (201, owner),
  `POST /:id/select` `:42-45` (403 PROFILE_PIN_INVALID, 429 throttled), `POST /deselect` `:46` (204), `GET /me` `:51`,
  `PATCH /:id` `:52`, `PUT /:id/pin` `:56` (setting a PIN ends that profile's sessions on other devices,
  `profileService.ts:63,75-78`), `DELETE /:id` `:60` (204, sessions cascade).

## 4. API and contract
New fixtures from `routes/nativeClient.test.ts` (its `snapshot()` `:57-59`), recorded on a second fixture DB with two
profiles: the owner "Home" (no PIN) and "Kids" (PIN `1234`):
- `profiles.json` — `GET /api/profiles`;
- `profile-select-result.json` — `POST /api/profiles/:id/select` (token masked to a fixed value);
- `profile-me.json` — `GET /api/profiles/me` with that session;
- `profile-summary.json` — `PATCH /api/profiles/:id`;
- `profile-required.json` — the 409 body of `GET /api/movies` with no session;
- `profile-pin-invalid.json` — the 403 body of a select with a wrong PIN.
The existing single-profile fixtures stay as they are (header-less requests still work there, `:174-175`, `:254-255`).

Kotlin (`apps/android/core/model/.../Profile.kt`, like `Auth.kt:6-15`): `ProfileSummary`, `ProfileSelectRequest`,
`ProfileSelectResult`, `ProfileMe`, `ProfileCreateRequest`, `ProfilePatch`, `ProfilePinUpdate`, `ApiError {error, message?}`,
and constants `PROFILE_SESSION_HEADER`, `PROFILE_REQUIRED`, `PROFILE_PIN_INVALID`, `MAX_PROFILES`, `PROFILE_COLORS`
(mirrors `shared/profiles.ts:5`). `ProfilePinUpdate.pin = null` must be sent as `"pin": null` (the schema requires the key):
`OttlibJson` (`OttlibJson.kt:6-9`) keeps the default `explicitNulls = true` but `encodeDefaults = false`, so declare `pin`
with no default value (or `@EncodeDefault`). Each fixture is mapped in `ContractFixturesTest.kt:20-48`.

## 5. Android
- **core/network.** `ApiException` (`ApiException.kt:6`) gains `errorCode: String?` (the body's `error` when it is a code,
  `HttpCalls.kt:36-44`). New `ProfileSessionInterceptor((HttpUrl) -> String?)` adds `x-profile-session`, and on a 409 whose
  body's `error` is `PROFILE_REQUIRED` calls an `onProfileRequired(HttpUrl)` callback (peek the body, don't consume it).
  `OttlibApi` (173 lines) gets `profiles()`, `selectProfile(id, pin)`, `deselectProfile()`, `profileMe()`, `createProfile`,
  `updateProfile`, `setProfilePin`, `deleteProfile`, through its `send` helper (`OttlibApi.kt:156`). If it passes ~250 lines,
  move the profile calls to `ProfilesApi.kt` sharing the client and base URL.
- **core/data.** `ProfileSessionStore` (token per origin: `tokenBlocking`, `save`, `clear`). `ProfileSession`: a
  `StateFlow<ProfileState>` for the active server, with `Unsupported` (404 on `GET /api/profiles`), `Single(profile)`,
  `Selected(profile, profiles)`, `NeedsPick(profiles)`; `resolve()` after connect (sole PIN-less → silent select; stored
  token → `GET /me`, 409 → clear and `NeedsPick`); `select(id, pin)` (a new pick deselects the old token, best effort); `switch()` (to `NeedsPick` without dropping the
  current token until a new pick, so Back can cancel); `onRequired(origin)`. Injected through function seams like
  `ServerAccess` (`ConnectionManager.kt:23-27`) so it tests without a server.
- **core/presentation.** `AppContainer` (`AppContainer.kt:35-65`) wires the store, the interceptor (after
  `AuthTokenInterceptor`, `:50`) and `ProfileSession`. `ProfilesViewModel` (picker: list, PIN step, errors: 403 → "Wrong PIN.
  Try again.", 429 → the server message). `ProfileManageViewModel` (create, rename, colour, PIN set/change/clear, delete;
  server error messages shown as is). `ProfileRights.kt` (the rules in §2). `ProfileColors.kt` (hex → `Color`, next unused
  colour for a new profile). `ConnectViewModel` routes to the picker when `resolve()` ends in `NeedsPick`.
- **Refresh on change.** When the selected profile changes, clear Watch Next through `ContinueWatchingPublisher` (TV:
  `WatchNextPublisher`, `tv/OttlibApplication.kt:21`; mobile: none, `mobile/OttlibApplication.kt:21`; add a clear call to
  the interface if it has none). Screens reload because the picker pops the whole graph.

## 6. Screens
- **TV picker** (new route `profiles`): "Who's watching?" row of tiles (colour circle with initial, name, lock when
  `hasPin`). Initial focus: the current profile, else the first. A PIN tile opens the PIN step: `tv/ui/connect/PinEntry.kt`
  generalised with a title (today "Enter access PIN") and reused. After a pick: `popUpTo(graph)` → Home. Back: when reached
  at start or from a 409 it exits the app; from Settings it returns there unchanged. A one-line hint under the row: "Add or
  edit profiles in the web app or the phone app."
- **TV top bar:** a profile chip in the `TopNavigation` header (`tv/ui/components/TopNavigation.kt:36`, shared by Home,
  Library, Search and Settings) showing the colour and name, only in `Selected` with 2+ profiles; select → picker. Focus
  returns to the chip on Back.
- **TV Settings:** a "Profile" section above "Server" (`tv/ui/settings/SettingsScreen.kt:56`) with "Switch profile".
- **Mobile picker:** the same screen as an adaptive grid (`windowWidth()`, `mobile/ui/components/WindowWidth.kt:16`): 2
  columns compact, 3 medium, 4 expanded; PIN via `mobile/ui/connect/PinEntry.kt` generalised the same way. Works on the
  Fold's cover and inner screens (no posture branch needed).
- **Mobile Home:** the chip in the `TopAppBar` actions (`mobile/ui/home/HomeScreen.kt:53`).
- **Mobile Settings:** a "Profiles" section (`mobile/ui/settings/SettingsScreen.kt`, `Setting()` rows `:120-128`) with
  "Switch profile" and "Manage profiles" → new `profiles/manage` screen: the list with rights-gated actions, "Add profile"
  (owner, below 6), and dialogs (AlertDialog, as `ui/components/ChoiceDialog.kt:23`) for name + colour, PIN (4–8 digits,
  current PIN when changing your own), and delete confirm. The note "Profile PINs keep watch lists separate. They don't
  secure the library." as on the web (`client/src/components/ProfilesSettingsSection.tsx:47`).

## 7. Tests to change or add
- Server: `nativeClient.test.ts` two-profile block (fixtures above); a test in `routes/profiles.test.ts` that the 409 body
  carries the new message. Client `hooks/apiClient.test.ts:58,63` uses its own mocked text; leave it unless it breaks.
- `core/model`: `ContractFixturesTest` decodes every new fixture strictly.
- `core/network`: MockWebServer tests for `ProfileSessionInterceptor` (header sent per origin; callback on a 409
  PROFILE_REQUIRED, not on other 409s) and `ApiException.errorCode`; `ProfilePinUpdate(pin = null)` encodes `"pin":null`.
- `core/data`: `ProfileSessionTest` for every `resolve()` branch, `switch()` cancel, `onRequired`.
- `core/presentation`: `ProfilesViewModelTest`, `ProfileManageViewModelTest`, `ProfileRightsTest` (JUnit4 + coroutines-test
  + MockWebServer, as `metadata/MetadataViewModelTest.kt`).

## 8. Tasks
| Task | Files | Spec | Depends on | Checks |
|---|---|---|---|---|
| T1 Server message + profile fixtures | `services/profileError.ts`, `routes/nativeClient.test.ts`, `routes/profiles.test.ts`, `contract/fixtures/profile*.json` | full | – | 409 body has the new message; six new fixtures recorded from a two-profile DB; existing fixtures unchanged; full server suite passes |
| T2 Kotlin DTOs + network | `core/model/Profile.kt`, `ContractFixturesTest.kt`, `core/network/ApiException.kt`, `HttpCalls.kt`, `OttlibApi.kt`, `ProfileSessionInterceptor.kt` + tests | full | T1 | every new fixture decodes strictly; interceptor sends the header per origin and reports only 409 PROFILE_REQUIRED; `pin=null` encodes as `"pin":null`; `:core:model:test :core:network:test` pass |
| T3 Profile session state | `core/data/ProfileSessionStore.kt`, `ProfileSession.kt`, `core/presentation/AppContainer.kt`, `connect/ConnectViewModel.kt`, `ContinueWatchingPublisher` + tests | partial | T2 | every `resolve()` branch tested (404, sole PIN-less, stored token ok/409, many); interceptor wired after auth; profile change clears Watch Next; connect lands on the picker when needed |
| T4 ViewModels + rights | `core/presentation/profiles/ProfilesViewModel.kt`, `ProfileManageViewModel.kt`, `ProfileRights.kt`, `ProfileColors.kt` + tests | partial | T3 (early) | rights match `profileRights.ts`; 403/429 messages as §5; create picks the next unused colour; `:core:presentation:test` passes |
| T5 TV screens | `tv/ui/profiles/*`, `tv/ui/connect/PinEntry.kt` + `ConnectScreen.kt:58`, `tv/navigation/*`, `tv/ui/components/TopNavigation.kt`, `tv/ui/settings/SettingsScreen.kt` | partial | T4 | initial focus and Back as §6; chip and Switch only with 2+ profiles; a global 409 lands on the picker; access-PIN entry still reads "Enter access PIN"; `:tv:assembleDebug` passes |
| T6 Mobile screens | `mobile/ui/profiles/*`, `mobile/ui/connect/PinEntry.kt` + `ConnectScreen.kt:67`, `mobile/navigation/*`, `mobile/ui/home/HomeScreen.kt`, `mobile/ui/settings/SettingsScreen.kt` | partial | T4 | grid columns per width class; manage actions gated by `ProfileRights`; PIN dialog asks current PIN for own PIN; access-PIN entry unchanged; `:mobile:assembleDebug` passes |
| T7 Docs | `docs/profiles.md` (Android section `:69-71`), `docs/plans/profiles-plan.md:5` note | full (haiku) | – | Android section describes picker, switch, phone-only management and the update message |

T5 and T6 run alongside each other (separate modules); T7 runs any time. T1 → T2 → T3 → T4 in order.

## 9. Risks and known gaps
- **Old apps stay broken with 2+ profiles** until updated; the new 409 text tells them to update. Self-update
  (`core/presentation/update/AppUpdates.kt`, its own client without our interceptors, `AppContainer.kt:63`) is reachable
  from Settings, which calls only `filterOptions()` (no profile needed, `SettingsViewModel.kt:38`).
- **Android hidden titles stay device-local** (`core/data/HiddenTitleStore.kt:15-17`, not the server's per-profile hides),
  so they are shared by every profile on a device. Moving them to the server hides API is a separate change.
- **Profile tokens never expire server-side** (no TTL in `profileSessionService.ts`); unchanged here.
- **`PROFILE_COLORS` and `MAX_PROFILES` are duplicated in Kotlin** (constants can't be fixture-checked); the colour list is
  covered indirectly by `profiles.json`.
- Manual check on devices: create a second profile on the web, then open the library and play a title on TV and phone;
  set a PIN on Kids from the phone; switch profiles on both.

## 10. Progress log
- 2026-10-25: plan written and approved.
- 2026-10-25: built by /plan-runner (run 20261025-android-profiles). T1 new 409 message + six profile fixtures (server
  suite 64 files). T2 Profile.kt DTOs, `ProfileSessionInterceptor`, `ApiException.errorCode`, profile calls in `OttlibApi`.
  T3 `ProfileSession`/`ProfileSessionStore`; review added a sent-token check so a late 409 can't wipe a fresh pick, and
  `resolve()` starts at `Unknown`. T4 picker/manage ViewModels with a `loading` flag, `ProfileRights`, `ProfileColors`
  (`:core:presentation:test` 118 tests). T5 TV picker, chip, Settings section. T6 mobile picker grid, chip, Settings and
  Manage screen (PIN dialog also asks for a confirm, as the web does). T7 docs. Switch/chip rule follows the web: 2+
  profiles or the current profile has a PIN. Final checks: build clean, web tests 102 files pass, Android unit tests and
  both app builds pass. Left: `ProfileSession.reset()` is not called on change server (harmless: `resolve()` resets);
  TV picker's remembered focus id is not cleared on server change; no Retry on an empty picker after an error; device
  check pending.
