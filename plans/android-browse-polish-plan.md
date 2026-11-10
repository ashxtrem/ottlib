# Android browse and player polish (phone and TV)

Approved by the user (2026-11-10: "Approved").
Issue: #57
Came from a review of HolyArrs (github.com/HolyArrs/HolyArrs, AGPL: ideas only, no code) on 2026-11-10. This is plan 3 of 3.
It runs after `plans/server-upkeep-metadata-plan.md` has merged: that plan adds the response fields and the Kotlin DTO
fields (`Movie.castMembers`, `logoUrl`, `ratings`, `collection`, `fresh`; `MovieListItem.fresh`; `MovieCollection`) this one
puts on screen. All paths are under `apps/android`.

## 1. Why
- **The phone's Home has no featured title.** It is rows only (mobile/.../ui/home/HomeScreen.kt:70-82).
- **Details show cast as one text line and no outside ratings.** TV: "Starring" with 5 names (tv/.../details/DetailsScreen.kt:148);
  phone: 6 names (mobile/.../details/DetailsSections.kt:79-82).
- **A cast member cannot be followed into the library.** `LibraryFilters` has sort, watched, genre and media type only
  (core/presentation/.../library/LibraryViewModel.kt:26-31), `MovieQuery` has no actor or collection
  (core/network/.../MovieQuery.kt:8-17), and the Library route takes no arguments (tv Routes.kt:9, mobile Routes.kt:6).
- **Search forgets.** Neither app keeps past queries; the phone shows "Type part of a title." when empty
  (mobile/.../search/SearchScreen.kt:63).
- **Cards cannot say a title is new.** `PosterItem` has one `badge` for 4K / DV / HDR (core/presentation/.../PosterItem.kt:13, :23).
- **The player starts on a text line over black.** Both apps show "Starting playback…" while loading
  (tv PlayerScreen.kt:52, mobile PlayerScreen.kt:52), the state flips to Ready before any frame is drawn
  (core/presentation/.../player/PlayerViewModel.kt:193-197), and nothing listens for the first rendered frame.

## 2. Decisions
User (2026-11-10):
- **Home hero on the phone: the top Continue watching title, else the newest unwatched one.**
- **The TV keeps its text-only hero.** Full-screen artwork was removed there for GPU reasons (tv/.../home/HomeScreen.kt:74).
- **Cast as photo cards that open the library filtered to that actor.** No person screen.
- **Trailers and release scoring are web only.** Nothing for them here.
- **Deletes stay permanent.** The TV Compare screen's wording is unchanged (tv CompareScreen.kt:79-80).

My calls (change any at approval):
- **The hero fetches its one title's details** for the backdrop, overview and logo; `PosterItem` carries no backdrop.
- **A cast card or a collection opens a pushed "filtered library" screen**, titled with the actor or collection name, that
  reuses the Library screen with that filter fixed. Back returns to Details. Rejected: arguments on the top-level Library
  route (the phone matches the bare route string for the bottom-bar highlight, mobile TopLevel.kt:13 and
  OttlibNavHost.kt:37, and top-level tabs save and restore state) and a one-shot preset in `AppContainer` (lost on
  process death).
- **Actor matching is the server's**: a case-insensitive substring match
  (packages/server/src/repositories/movieRepository.ts:455), the same as the web chips.
- **Collections on Android list owned titles only**, with a line "N more not in your library". There is no torrent
  search here to send a missing film to.
- **Recent searches: last 8, kept per server address and profile** in a new `RecentSearchStore`. Saved when a query has
  stayed unchanged for 1.5 s with 2 or more characters.
- **Player start cover: the backdrop, then the frame at the resume position, until the first frame is rendered.** One
  static image, so it does not reopen the TV's GPU concern.
- **`PlayerUiState` keeps its shape.** The cover and the first-frame flag are separate flows on `PlayerViewModel`;
  `Loading` is a data object matched by name in both apps (tv PlayerScreen.kt:52, mobile PlayerScreen.kt:52).
- **TV Details gains focus memory.** It has only an initial focus today (tv DetailsScreen.kt:99, :165), unlike Home,
  Library and Search, so returning from the filtered library would otherwise land on Play.
- **Warm start is dropped**, as on web: the playback request opens a server session.
- **The TV shows the logo on Details too**, falling back to the title text.

## 3. Shared logic (core)
- `core/network`: `MovieQuery` gains `actor` and `collection`, omitted from the request when null like its other fields
  (MovieQuery.kt:19-29; the server accepts `actor` today and `collection` after plan 1); `OttlibApi.collection(id)` for
  `GET /api/movies/:id/collection`, 404 mapped to null (precedent ProfileSession.kt:46).
- `core/presentation/library/LibraryViewModel.kt`: `LibraryFilters` (:26-31) gains `actor: String?` and
  `collectionId: Int?`, both null by default. The ViewModel takes an optional `LibraryPreset(actor, collectionId)` at
  creation and keeps it through every `setFilters` (:86); the query it builds (:110) carries it. No preset means no change
  and no extra request (request counts are pinned at LibraryHiddenTitlesTest.kt:54 and LibraryWatchRefreshTest.kt:48).
- The screens build the playback queue's `MovieQuery` themselves (mobile LibraryScreen.kt:81, tv LibraryScreen.kt:74);
  both must pass the preset too, so "next" from a filtered library stays inside it (PlaybackSequence.kt:18-38).
- `core/presentation/home/HomeViewModel.kt`: `hero: StateFlow<HeroItem?>`. Pick the first item of the `continue` row
  (HomeViewModel.kt:79, key at :104), else the first of `unwatched` (:99), after the hidden filter; load `api.movie(id)`.
  `HeroItem(item: PosterItem, backdropUrl, logoUrl, overview, resumeLabel)`.
- `core/presentation/details/DetailsViewModel.kt` (:43, :47): exposes `ratings`, `castMembers`, `logoUrl`, and
  `collection: CollectionSummary?` (id, name, owned as `PosterItem`s without the current title, `missingCount`), loaded
  beside recommendations (:45-48, :80-86); and `lastFocusedKey` for the TV, like HomeViewModel.kt:42.
- `core/presentation/PosterItem.kt` (:8-21): `isNew: Boolean = false` from `MovieListItem.fresh`, added last because it
  is built positionally (PosterItem.kt:26, :29; HiddenTitlesViewModel.kt:27); `ratingsLine()` in `Formatters.kt` beside
  `metaLine` (:52-58): "IMDb 8.8", "RT 87%", "MC 74".
- `core/data/RecentSearchStore.kt`: DataStore on `ottlibPreferences` (core/data/OttlibPreferences.kt:9), one key
  `recent_searches` holding a JSON map from scope to list, shaped like `HiddenTitleStore` (HiddenTitleStore.kt:19-52).
  The scope is the server address plus the profile id: there is no server id (ServerStore.kt:9-16), so it uses the active
  server URL's host and port (ConnectionManager.kt:33) and `ProfileState.current`'s id, or `-` when the server has no
  profiles (ProfileState.kt:11). `add`, `remove`, `flow(scope)`. Registered in `AppContainer` (AppContainer.kt:40-82).
- `core/presentation/search/SearchViewModel.kt` (:30-60): `recents: StateFlow<List<String>>`, `useRecent(q)`,
  `removeRecent(q)`; saves through the store after the existing 350 ms debounce (:38) plus the 1.5 s hold. Its
  constructor gains the store, so the two call sites change with it (mobile SearchScreen.kt:41, tv SearchScreen.kt:33).
- `core/player`: `onRenderedFirstFrame` joins the listener `PlaybackSession` attaches (PlaybackSession.kt:17-18;
  PlayerViewModel's listener is at :130-156). `PlayerViewModel` gains two flows and leaves `PlayerUiState` alone:
  `startCover: StateFlow<StartCover?>` (title and image URL: the backdrop once details arrive at :166-168, then the frame
  at the resume position through `framePreviewUrl(positionMs)`, :128, when resume is above 0) and
  `firstFrameShown: StateFlow<Boolean>`, reset when the media item changes.

## 4. Screens: phone
Layouts branch on `windowWidth()` (mobile/.../home/HomeScreen.kt:55) and `rememberTabletopSplit`, never on device.
- **Home hero** as the first item of the list, so it scrolls away. Compact (Fold cover, phones): 16:9 banner, logo or
  title, one meta line, Resume or Play and Details. Medium and expanded (Fold inner, tablets): height capped at 320 dp,
  text on the left over a scrim, overview 3 lines. Hidden when `hero` is null.
- **Details** (`DetailsLayouts.kt` CompactDetails :39-53, WideDetails :59-73; `DetailsSections.kt`): ratings chips under
  the meta line; logo over the backdrop in place of the title text (title kept as content description); a cast `LazyRow`
  of photo cards replacing the "Starring" line (DetailsSections.kt:79-82) when `castMembers` is not empty, each opening
  the filtered library for that actor; a collection row above recommendations with a "See all" action and
  "N more not in your library".
- **Filtered library**: a new pushed destination (`Routes.FILTERED`, mobile Routes.kt:6, OttlibNavHost.kt:80) that shows
  `LibraryScreen` with a preset and a top bar titled with the actor or collection name and a back arrow. The bottom bar
  or rail keeps its current highlight. The existing filter chips (LibraryScreen.kt:104-111) still work on top of the preset.
- **Cards**: a "New" strip at the bottom edge of the poster, above the progress bar (PosterCard.kt:52-54).
- **Search**: with an empty query, a "Recent" list of chips in place of the hint (SearchScreen.kt:63); tapping fills and
  runs the query; a long press offers Remove.
- **Player**: the cover image fills the surface under the loading text and stays until `firstFrameShown`
  (PlayerScreen.kt:52, VideoView.kt:38). In PiP and tabletop it follows the video area.

## 5. Screens: TV
Every screen keeps an initial focus and restores focus on return (AGENTS.md).
- **Home**: unchanged. `HeroText(focused)` stays text-only (HomeScreen.kt:85).
- **Details** (DetailsScreen.kt): ratings join the meta line (:112); logo in place of the title text. Focus order top to
  bottom: Play row (initial focus, :99 and :165) → metadata and Compare row (:133-138) → cast row → collection row →
  recommendations (:153). Cast cards are focusable and replace the "Starring" line (:148) when `castMembers` is not empty;
  OK opens the filtered library for that actor. The screen records the focused card in `lastFocusedKey` and requests it
  again on return, so Back lands on the same cast or collection card; first entry still focuses Play.
- **Filtered library**: a new pushed destination (`Routes.FILTERED`, tv Routes.kt:9, OttlibNavHost.kt:101) showing
  `LibraryScreen` with a preset and the actor or collection name as its heading. Initial focus is the first poster; Back
  returns to Details. The filter buttons (LibraryScreen.kt:60-63) still work on top of the preset.
- **Cards**: the "New" strip at the bottom edge above the progress bar (PosterCard.kt:71-73).
- **Search** (SearchScreen.kt:36-58): with an empty query a row of recent chips sits under the field. ↓ from the field
  (TvTextField.kt:70-74) goes to the first chip when the query is empty, else to the results; ↑ from the chips returns to
  the field; OK on a chip fills the field and moves focus to the first result when results arrive.
- **Player**: the cover image under "Starting playback…" (PlayerScreen.kt:52), a single static image, removed on the
  first rendered frame (PlayerSurface.kt:173).

## 6. Tests to change or add
There are no tests today for the Home, Details, Search or Player ViewModels; new ones follow LibraryHiddenTitlesTest.kt
(ViewModelStore, MockWebServer, `setMain`; junit and kotlinx-coroutines-test, core/presentation/build.gradle.kts:35-37).
- `core/presentation`: HomeViewModel hero pick (continue first, else unwatched, hidden skipped, null with no rows);
  LibraryViewModel preset (reaches the request, survives `setFilters`, no extra request without one);
  DetailsViewModel collection summary (current title excluded, missing count); SearchViewModel recents (cap 8, no
  duplicates, newest first, remove); PlayerViewModel start cover (frame URL with a resume position, backdrop without,
  flag resets on a new item).
- `core/data`: RecentSearchStore scoping by server address and profile.
- `core/network`: MovieQuery encodes `actor` and `collection` and still omits them when null (OttlibApiTest.kt:30 pins
  the exact query string); `collection(id)` maps 404 to null.
- Existing tests that pin what this plan touches: LibraryHiddenTitlesTest.kt:54 and LibraryWatchRefreshTest.kt:48
  (request counts), PlaybackSequenceTest.kt:62 (a `MovieQuery` built by name).
- No contract fixture changes: this plan changes no response.

## 7. Tasks
A1 first. A2, A3 and A4 edit different packages of `core` and can run alongside each other. A5 (phone) and A6 (TV) run
alongside each other once A2–A4 are in.

| Task | Files | Spec | Depends on | Checks |
|---|---|---|---|---|
| A1 Query, API and library preset | core/network MovieQuery.kt and OttlibApi.kt (+tests), core/presentation/library/LibraryViewModel.kt (+test) | full | server plan | `actor` and `collection` reach the request and are omitted when null (OttlibApiTest.kt:30 still passes); a preset survives `setFilters`; with no preset the request counts at LibraryHiddenTitlesTest.kt:54 and LibraryWatchRefreshTest.kt:48 are unchanged; `collection(id)` returns null on 404 |
| A2 Home hero, details and card state | core/presentation/home/HomeViewModel.kt (+test), core/presentation/details/DetailsViewModel.kt (+test), core/presentation/PosterItem.kt, Formatters.kt | full | A1 | the hero is the first Continue watching item, else the first unwatched; a hidden title is never the hero; the collection summary leaves out the open title; `isNew` follows `fresh` and defaults to false at every existing construction; ratings format as "IMDb 8.8", "RT 87%", "MC 74" |
| A3 Recent searches | core/data/RecentSearchStore.kt (+test), core/presentation/AppContainer.kt, core/presentation/search/SearchViewModel.kt (+test), the constructor call in mobile ui/search/SearchScreen.kt and tv ui/search/SearchScreen.kt | full | A1 | recents keep the newest 8 without duplicates; a different server address or profile sees its own list; a server without profiles still keeps recents; a query under 2 characters is not saved; both apps compile |
| A4 Player start cover state | core/player PlaybackSession.kt, core/presentation/player/PlayerViewModel.kt (+test) | partial | A1 | `PlayerUiState` is unchanged and both apps compile; `startCover` is the backdrop once details load and the resume frame when resume is above 0; `firstFrameShown` turns true on the first rendered frame and false on a new item |
| A5 Phone screens | mobile ui/home/HomeScreen.kt, ui/details/DetailsLayouts.kt, DetailsSections.kt, DetailsScreen.kt, ui/library/LibraryScreen.kt, ui/components/PosterCard.kt, ui/search/SearchScreen.kt, ui/player/PlayerScreen.kt, Routes.kt, OttlibNavHost.kt | partial | A2, A3, A4 | the hero lays out at compact and expanded widths and is absent when null; a cast card opens the filtered library and Back returns to Details; the bottom bar highlight is unchanged there; playing from a filtered library queues only its titles; recents show for an empty query; the cover is gone once video shows, including in PiP; `./gradlew :mobile:assembleDebug` passes |
| A6 TV screens | tv ui/details/DetailsScreen.kt, ui/library/LibraryScreen.kt, ui/components/PosterCard.kt, ui/search/SearchScreen.kt, ui/player/PlayerScreen.kt, Routes.kt, OttlibNavHost.kt | partial | A2, A3, A4 | Details focus order is Play → Compare → cast → collection → recommendations with initial focus on Play; Back from the filtered library returns to the same cast card; the filtered library focuses its first poster; ↓ from an empty search field lands on the first recent chip; playing from a filtered library queues only its titles; `./gradlew :tv:assembleDebug` passes |

Final check for the run: `./gradlew test :tv:assembleDebug :mobile:assembleDebug` from `apps/android`.

## 8. Risks and known gaps
- **Until the server's backfill finishes**, titles have no logo, cast photos, ratings or collection; every piece falls
  back to today's look (title text, the "Starring" line when `castMembers` is empty).
- **Older servers** return none of the new fields; DTO defaults keep the apps working and the new pieces stay hidden.
- **Cast photos on TV** add up to 8 small images to Details; they load lazily in the row (Coil 3.3.0, libs.versions.toml:15).
- **The resume frame is one extra request per play**, from the route scrubbing already uses.
- **Not on Android:** trailers, health and backups screens, release score and the upgrade finder.

## 9. Progress log
- 2026-11-10: plan written and approved.
