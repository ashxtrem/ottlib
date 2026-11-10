# Web browse and player polish

Approved by the user (2026-11-10: "Approved").
Issue: #56
Came from a review of HolyArrs (github.com/HolyArrs/HolyArrs, AGPL: ideas only, no code) on 2026-11-10. This is plan 2 of 3.
It runs after `plans/server-upkeep-metadata-plan.md` has merged: W4, W5, W8 and W9 read fields and routes that plan adds.
All paths are under `packages/client/src` unless they start with `packages/`.

## 1. Why
- **Home is rows only.** `HomePage` maps rows straight to `HomeRowSection` (pages/HomePage.tsx:27); nothing is featured.
- **Rows are plain scrolling lists.** Every card is mounted and tabbable, there is no key handling, and only the page's
  vertical scroll comes back after Back (components/HomeRowSection.tsx:16-17, pages/HomePage.tsx:16-22).
- **A card says little until you open it.** Hover only lifts it (components/interactionStyles.ts:7-8, PosterCard.tsx:32).
- **The title page shows one rating and cast as text chips** (pages/MovieDetailPage.tsx:95, :99), with no logo, no
  collection and no trailer.
- **Search forgets.** The title input (components/LibraryFilters.tsx:95) keeps no history and no shortcut focuses it; the
  only global key handlers are Escape in menus and the player's (hooks/usePlayerShortcuts.ts:22).
- **Skeletons flash on fast loads.** They render the moment a query is loading (HomePage.tsx:24, MovieDetailPage.tsx:68).
- **The player starts black.** `WatchPage` shows a spinner until the source arrives (pages/WatchPage.tsx:174), never loads
  the title, and the video has no poster (components/player/VideoSurface.tsx:119).
- **The new server features have no screen:** health, backups, release score and upgrade candidates.

## 2. Decisions
User (2026-11-10):
- **Home hero: the top Continue watching title, else the newest unwatched one.** Each client derives it from rows it loads.
- **Cast as photo cards that open the actor-filtered library**, as the chips do today. No person page.
- **Trailers and release scoring are in**, web only.
- **Deletes stay permanent.** No deleted-files list.

My calls (change any at approval):
- **The hero fetches its one title's details.** List rows carry no backdrop or overview (packages/shared/src/index.ts:112-127);
  one extra request beats widening every row.
- **Hover preview is pointer-only**, after a 400 ms rest, and never on touch or in selection mode. Keyboard users press
  Enter for the title page. Rejected: opening on focus (noisy with arrow-key movement along a row).
- **No trailer autoplay.** A Trailer button opens a dialog with a `youtube-nocookie.com` embed, loaded only on open.
  Rejected: muted autoplay on hover (an iframe and a request to YouTube per hovered card).
- **Search: recent searches and shortcuts on the existing library search.** No header search box and no suggestion
  dropdown. Last 8, per profile, on this device. `/` and Ctrl/Cmd+K focus it, from any header page.
- **Warm start is dropped.** `GET /api/movies/:id/playback` with capabilities opens an HLS session during the call
  (packages/server/src/services/playbackPlanner.ts:59), so fetching it early would start ffmpeg for titles never played.
- **Keyboard-only focus rings are dropped.** `focusRing` already uses `focus-visible` (interactionStyles.ts:1).
- **Skeleton timing:** nothing for 150 ms, then the skeleton, then a "Still loading…" line after 10 s.
- **Restore is offered only on the server PC.** The button follows `useIsLocalClient` (a hostname check,
  hooks/useIsLocalClient.ts:3-5); the server enforces loopback itself, and its 403 is shown as the reason if they disagree.
- **Torrent results sort by Best match when scores exist**, otherwise by seeders as today.
- **The "needs attention" card on Home shows only when a check is warn or fail.**

## 3. Home hero
- `hooks/useHomeHero.ts`: from the rows `HomePage` already has (after the hidden-title filter, HomePage.tsx:15), take the
  first item of the `continue` row, else the first of `unwatched` (keys at hooks/useHomeRows.ts:27-29); load its details
  with `useMovie` (hooks/useMovies.ts:29). Returns null with no rows.
- `components/HomeHero.tsx`: backdrop with a scrim, the logo image when `logoUrl` is set else the title, one meta line
  (year · runtime · "42 min left" when resuming), overview, and Resume or Play plus Details. Play links to `/watch/:id`.
- Colours for text over artwork: `--color-on-art`, `--color-on-art-muted`, `--color-on-art-scrim`, identical in light and
  dark, added the way existing tokens are (styles.css:15-45, tailwind.config.ts:49-80).
- Phone width: 16:9 banner, overview clamped to 2 lines, buttons full width. From `md`: height `26rem`, text on the left
  third over a left-to-right scrim, overview 3 lines. A skeleton block of the same height while loading.
- Reduced motion: no fade or zoom (the `--motion-*` tokens already collapse, styles.css:113-118).

## 4. Rows
- `hooks/useRowDragScroll.ts`: mouse drag past 5 px scrolls the row and glides on release; a drag swallows the click.
  Touch keeps native scrolling. No glide under reduced motion.
- `hooks/useRovingRow.ts`: one card per row holds the tab stop; ←/→, Home and End move it; controls inside other cards get
  `tabIndex -1`. Ignored while a text field has focus.
- Lazy rows: the first 3 render at once; the rest render when within 1.5 screens (IntersectionObserver), with a
  fixed-height placeholder so the page does not jump.
- Sideways restore: each row's `scrollLeft` is kept in `sessionStorage` (`ottlib-home-row-offsets`, by row key) and put
  back when the page restores its vertical position (HomePage.tsx:18-22).

## 5. Cards
- "New" strip when `movie.fresh === 'new'`, placed so it clears the shelf chip (PosterCard.tsx:39), the Unavailable and
  Needs review badges (:40-41) and the quality markers (:33) at 144 px, the home-row card width below 640 px
  (HomeRowSection.tsx:16; 160 px from `sm`). `PosterGrid` renders the same card for the library and shelves
  (PosterGrid.tsx:33), so the strip and the preview apply there too.
- `components/PosterHoverPreview.tsx` with `hooks/useHoverPreview.ts` and `utils/hoverPlacement.ts`: only when
  `(hover: hover) and (pointer: fine)` matches. After 400 ms the card grows to 1.5× (240–420 px wide) in a portal, kept
  8 px inside the viewport. It shows the backdrop, title, year · runtime · rating, quality chips, a 2-line overview, and
  Play or Resume, the watched toggle, Details and, with a `trailerKey`, Trailer. Details load on dwell and are cached.
  Leaving closes it after a 150 ms grace; Esc closes it. Under reduced motion it fades without growing.

## 6. Title page
- `components/RatingsStrip.tsx`: IMDb, Rotten Tomatoes and Metacritic from `movie.ratings`; falls back to today's single
  ★ value when the list is empty (MovieDetailPage.tsx:95).
- `components/CastRow.tsx`: a sideways row of photo cards from `movie.castMembers` (initials when a photo is missing), each
  linking to `/library?actor=<name>`, the same target as the chips (MovieDetailPage.tsx:25, :99). Genres stay chips.
- Logo: when `logoUrl` is set it replaces the `h1` text visually; the `h1` stays for screen readers (MovieDetailPage.tsx:90-94).
- `components/CollectionRow.tsx` with `hooks/useCollection.ts` (`GET /api/movies/:id/collection`): "Part of <name>", owned
  titles as cards, missing ones dimmed with their year and, when torrent search is on, a Find link to
  `/torrents?q=<title>&year=<year>` (the shape MovieActionButtons.tsx:33 uses). Hidden with no collection.
- `components/TrailerDialog.tsx` on `Modal` (components/Modal.tsx:24-34): a 16:9 iframe to
  `https://www.youtube-nocookie.com/embed/<key>?autoplay=1`, mounted only while open. A Trailer button joins the action
  buttons when `trailerKey` is set.

## 7. Library and search
- Collection select in `LibraryFilters` from `filter-options.collections`, beside Genre (LibraryFilters.tsx:57); URL
  parameter `collection` in `useLibraryViewState` (hooks/useLibraryViewState.ts:30, :40).
- `hooks/useRecentSearches.ts`: `localStorage` key `ottlib-recent-searches:<profileId>`, newest first, max 8, no
  duplicates. A search is saved on Enter or after it has stayed unchanged for 1.5 s with 2 or more characters.
- With the input focused and empty, a list of recents opens under it; choosing one fills the search; each has a remove button.
- `hooks/useSearchShortcut.ts`, mounted in `HeaderLayout` (App.tsx:50-63): `/` and Ctrl/Cmd+K focus the library search,
  navigating to `/library` first from other header pages. The input has no ref today (LibraryFilters.tsx:95), so it gets a
  stable id the hook targets. Ignored inside text fields; `/watch` is outside the header layout (App.tsx:47), so it never fires there.
- The recents key uses the profile id from `useCurrentProfile` (hooks/useProfile.ts:20).

## 8. Loading
- `hooks/useLoadStage.ts`: `quiet` under 150 ms, `skeleton` after, `reassure` after 10 s.
- `components/Skeleton.tsx` gains `DelayedSkeleton`, wrapping the existing exports (Skeleton.tsx:5-25); used at
  HomePage.tsx:24, LibraryPage.tsx:61, MovieDetailPage.tsx:68, ShelfDetailPage.tsx:39, ShelvesPage.tsx:14,
  SettingsPage.tsx:61, ShelfSelectionDialog.tsx:77 and :81, MatchReviewDialog.tsx:31.

## 9. Player start
- `WatchPage` loads the title with `useMovie` (hooks/useMovies.ts:29, key `['movie', id]`), usually cached from the title page.
- `hooks/useVideoState.ts` (:4-14) gains `firstFrame`, true from the first `loadeddata` or `playing` and reset on `emptied`.
  `loadeddata` is not in its event list today (:18) and is added. The resume position and frame URL are already on the
  source (packages/shared/src/playback.ts:62, :80), and the frame route takes its key in the query, so an `<img>` can load it.
- `components/player/StartCover.tsx`: until `firstFrame`, the dimmed backdrop with the title and spinner. Once the source
  is known and the resume position is above 0, the frame at that position replaces the backdrop
  (`${framePreviewUrl}&t=<ms>`, utils/scrubTiming.ts:66-67). It fades out on `firstFrame`; instantly under reduced motion.
- Grow into the player: `PlayButton`'s link gets `viewTransition` (components/PlayButton.tsx:36) and the title-page
  backdrop (MovieDetailPage.tsx:84) shares a `view-transition-name` with the cover.

## 10. Settings and Home attention
- `components/settings/HealthSettingsSection.tsx` with `hooks/useHealth.ts`: each check's state, message and fix, and a
  Check again button (`?fresh=1`).
- `components/settings/BackupSettingsSection.tsx` with `hooks/useBackups.ts`: the `backupEnabled` toggle, Back up now, the
  list (kind, date, size), Delete, and Restore. Restore is enabled only when `useIsLocalClient` is true; a 403 from the
  server is shown as "Restore only works on the server PC". After a restore, a line says to restart OttLib.
- Both go after "Library maintenance" (pages/SettingsPage.tsx:170-171), as components like the transcode section (:106).
- `components/HomeAttentionCard.tsx`: above the hero when any check is warn or fail; lists them and links to Settings.

## 11. Torrents
- `TorrentResultTable` (components/TorrentResultTable.tsx:15-21): a Best match sort option, the default when any result has
  a score; a Best match badge on the row with `bestMatch`. The same badge on the mobile card (TorrentResultRow.tsx:10-13).
- `QbittorrentSettingsSection`: preferred resolution, preferred codec and a size cap in GB.
- `pages/UpgradeFinderPage.tsx` at `/torrents/upgrades`: candidates with their reason and a Find better link to
  `/torrents?q=<title>&year=<year>`; linked from `TorrentSearchPage`. Without a preferred resolution it explains that only
  old-codec titles are listed.

## 12. Screens
- Every new piece is checked at 375 px and 1280 px, light and dark.
- Phone width: hero buttons stack; cast and collection rows scroll sideways; no hover preview; recents list is full width.
- Desktop: hover preview stays inside the viewport at the row's first and last cards.
- Keyboard: Tab reaches one card per row; arrows move along it; Esc closes the hover preview, recents and trailer dialog.

## 13. Tests to change or add
Tests render with `renderToStaticMarkup` and run in node (components/PosterCard.test.tsx:1-10); logic goes in hooks and
utils so it can be tested without a DOM.
- New: useHomeHero (pick order, hidden titles skipped), hoverPlacement (clamps at both edges), useRecentSearches (cap,
  order, duplicates), useLoadStage, RatingsStrip, CastRow, CollectionRow, HomeHero, StartCover.
- Extend: PosterCard.test.tsx (New strip), LibraryFilters.test.tsx (collection select), useLibraryViewState.test.ts.
- Tests that pin what this plan touches and must be updated in the same task: PosterCard.test.tsx:16-54 (class strings),
  useLibraryViewState.test.ts:19 (`toEqual` on the whole state), LibraryFilters.test.tsx:9 (`countActiveFilters` is 9),
  PlayerControls.test.tsx:6 (a `VideoState` literal), PlayButton.test.tsx:14-24 (the link's href and label).
- `LibraryFilterValues` is also read by ShelfDetailPage.tsx:24 and ShelfSelectionDialog.tsx:6; the new field is optional there.

## 14. Tasks
W1 → W2 → W6 → W8 run in order (all edit `HomePage.tsx`). W4 → W3 (the hover preview reuses `TrailerDialog`). W5 → W9
(both edit `App.tsx`). W4 → W6 (both edit `MovieDetailPage.tsx`), W5 → W6 (both edit `LibraryPage.tsx`) and W4 → W7
(the backdrop's transition name). W1, W4 and W5 can start together.

| Task | Files | Spec | Depends on | Checks |
|---|---|---|---|---|
| W1 Home hero | hooks/useHomeHero.ts (+test), components/HomeHero.tsx (+test), pages/HomePage.tsx, styles.css, packages/client/tailwind.config.ts | partial | – | the hero shows the first Continue watching title, else the newest unwatched; a hidden title is never featured; Resume opens `/watch/:id`; no hero when there are no rows; readable in light and dark at 375 px and 1280 px |
| W2 Row behaviour | components/HomeRowSection.tsx, hooks/useRowDragScroll.ts, hooks/useRovingRow.ts, hooks/useLazyRow.ts, pages/HomePage.tsx | partial | W1 | a mouse drag scrolls the row and does not open a card; Tab stops once per row and ←/→ move along it; rows past the third mount only when near; Back restores each row's sideways position |
| W3 New strip and hover preview | components/PosterCard.tsx (+test), components/PosterHoverPreview.tsx, hooks/useHoverPreview.ts, utils/hoverPlacement.ts (+test) | partial | W4 | "New" shows only for `fresh: 'new'` and overlaps no badge at 144 px; the preview opens after 400 ms on a fine pointer only; it stays 8 px inside the viewport at both row ends; Esc and leaving close it; none in selection mode; PosterCard.test.tsx passes with its pinned classes updated only where the markup changed |
| W4 Title page | pages/MovieDetailPage.tsx, components/RatingsStrip.tsx (+test), components/CastRow.tsx (+test), components/CollectionRow.tsx (+test), components/TrailerDialog.tsx, components/MovieActionButtons.tsx, hooks/useCollection.ts | partial | server plan | ratings fall back to the single ★ when empty; a cast card opens `/library?actor=<name>`; the logo replaces the title visually and the `h1` remains; a missing film links to torrent search only when it is on; the trailer iframe exists only while the dialog is open |
| W5 Collection filter, recents and shortcuts | components/LibraryFilters.tsx (+test), pages/LibraryPage.tsx, hooks/useLibraryViewState.ts (+test), hooks/useRecentSearches.ts (+test), hooks/useSearchShortcut.ts, App.tsx | full | server plan | `?collection=` filters and survives reload; recents keep the newest 8 without duplicates, per profile; `/` and Ctrl/Cmd+K focus the search from Home; neither fires in a text field or on `/watch`; useLibraryViewState.test.ts:19 and LibraryFilters.test.tsx:9 updated for the new filter; shelf pages still compile without passing `collection` |
| W6 Staged loading | hooks/useLoadStage.ts (+test), components/Skeleton.tsx, the 9 usages listed in §8 | full | W2, W4, W5 | a load under 150 ms shows no skeleton; a load over 10 s shows "Still loading…"; every listed usage goes through `DelayedSkeleton` |
| W7 Player start | pages/WatchPage.tsx, components/player/StartCover.tsx (+test), components/player/VideoSurface.tsx, hooks/useVideoState.ts, components/PlayButton.tsx | partial | W4 | the cover shows the backdrop before the source arrives; with a resume position it switches to that frame; it is gone on the first frame and back after a source change; no black frame between cover and video in direct play and in HLS; PlayerControls.test.tsx:6 and PlayButton.test.tsx:14-24 still pass |
| W8 Health, backups and the attention card | components/settings/HealthSettingsSection.tsx, components/settings/BackupSettingsSection.tsx, hooks/useHealth.ts, hooks/useBackups.ts, pages/SettingsPage.tsx, components/HomeAttentionCard.tsx, pages/HomePage.tsx | full | W6, server plan | each check shows state, message and fix; Check again refetches with `?fresh=1`; Restore is disabled off the server PC with a reason; the Home card shows only with a warn or fail |
| W9 Release score and upgrade finder | components/TorrentResultTable.tsx, components/TorrentResultRow.tsx, components/QbittorrentSettingsSection.tsx, pages/UpgradeFinderPage.tsx, pages/TorrentSearchPage.tsx, App.tsx | full | W5, server plan | with scores the default sort is Best match and one row carries the badge; with none the table is as today; the three preferences save and reload; `/torrents/upgrades` lists candidates with a reason |

## 15. Risks and known gaps
- **Until the server's backfill finishes**, titles have no logo, cast photos, ratings or collection; every piece falls
  back to today's look.
- **The trailer embed contacts YouTube** when the dialog opens, the first time this app loads anything from a third party
  in the browser.
- **`PosterCard` has several focusable controls**; the roving tab stop must keep the watched toggle reachable on the
  active card.
- **The resume frame costs one frame request per play**, from the same route scrubbing uses.
- **View transitions into the player** depend on browser support; without it the cover simply appears.

## 16. Progress log
- 2026-11-10: plan written and approved.
