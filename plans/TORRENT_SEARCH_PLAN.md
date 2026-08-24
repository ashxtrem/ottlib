# Ottlib — Torrent Search & Handoff (qBittorrent)

## Context

Ottlib manages movies that are already on disk. This adds the step before that: search torrent indexers from inside the app and hand the result to qBittorrent, which the user already runs.

**qBittorrent is the only integration.** It is both the search engine and the download client — it exposes `/api/v2/search/*` backed by its own Python plugin system, and `/api/v2/torrents/add` for grabbing. There is no Prowlarr, no Jackett, no Torznab, and no second indexer path. That decision removes an entire prerequisite service, a database table, an XML parser, and a server-side download proxy from the design.

**Ottlib does not download, store, seed, or track torrents itself.** It is a search front-end plus a one-POST handoff, the same way playback is a handoff rather than an embedded player. The completed download lands in a folder already configured as a scan root, and the existing scanner ingests it on the next run — that is the entire integration between this tool and the library.

### Why there is no provider interface here

`AGENTS.md` says to apply the plug-in pattern where extensibility is an explicit goal, and *not* to generalize one-off code for symmetry. With qBittorrent as the only source, a `TorrentIndexer` interface with exactly one implementation would be abstraction for its own sake. Extensibility already lives at the right layer — qBittorrent's own plugin system — where ~70 public and ~25 private site plugins are installed and managed in qBittorrent's WebUI, not in our code. If a second non-qBittorrent source is ever genuinely wanted, that is when the interface gets extracted.

### Non-goals

- No embedded engine (`webtorrent`, `torrent-stream`, libtorrent bindings).
- No download queue, progress bars, ETA, pause/resume, or seeding controls in v1 (see Phase 2).
- No automatic grabbing, RSS monitoring, or quality-upgrade automation.
- **No plugin management from Ottlib** — see the security constraint below. This one is a hard rule, not a deferral.

## Tech Choices

- **Transport**: a small hand-written `qbittorrentClient.ts` using `fetch`. **Zero new dependencies.** The surface we need is one login call, five search calls, and one add call — all JSON, all trivial. `@ctrl/qbittorrent` is the obvious library candidate and is well maintained, but I could not confirm it wraps the `search/*` endpoints (its focus is torrent management), so depending on it would likely mean hand-writing the search half anyway while carrying a dependency for the other half. Revisit only if session/retry handling turns out to be more work than expected.
- **Release-name parsing**: reuse the existing `scanner/titleParser.ts`. Using the *same* parser for a torrent release name and for a scanned filename is what makes the "you already own this" check trustworthy — two different parsers would disagree on edge cases and produce false negatives. Quality attributes come from a small sibling module.

### Prerequisite the user must satisfy

qBittorrent's search engine is implemented in Python and **is disabled if Python is not installed on the qBittorrent host**. `search/plugins` returns an empty list and searches silently yield nothing. This is the single most likely "it doesn't work" report, so it needs an explicit check (below) rather than a troubleshooting paragraph.

## Project Structure (additions only)

```
packages/
├── shared/src/
│   └── torrent.ts                          # zod schemas + types: TorrentResult, TorrentSearchStatus,
│                                           #   TorrentQuality, SendTorrentRequest
├── server/src/
│   ├── providers/torrent/
│   │   ├── qbittorrentClient.ts            # session/SID lifecycle, request wrapper, error mapping
│   │   ├── qbittorrentSearch.ts            # start / status / results / stop / delete / plugins (read-only)
│   │   └── qbittorrentTorrents.ts          # torrents/add
│   ├── services/
│   │   ├── torrentSearchService.ts         # search lifecycle, slot budget, dedupe, annotate, sort
│   │   ├── torrentHandoffService.ts        # send-to-qBittorrent, validation
│   │   ├── torrentConnectionService.ts     # connection + Python/plugin health check
│   │   └── torrent/
│   │       ├── releaseQuality.ts           # resolution/source/codec/group from a release name
│   │       └── releaseQuality.test.ts
│   └── routes/torrents.ts
└── client/src/
    ├── pages/TorrentSearchPage.tsx
    ├── components/
    │   ├── TorrentSearchBar.tsx
    │   ├── TorrentResultTable.tsx
    │   ├── TorrentResultRow.tsx            # quality chips, seeders, size, engine, actions
    │   ├── TorrentSendButton.tsx           # send to qBittorrent + copy magnet
    │   └── QbittorrentSettingsSection.tsx
    └── hooks/
        ├── useTorrentSearch.ts
        └── useQbittorrentStatus.ts
```

**No migration and no new repository.** Connection config is three fields — `qbittorrentUrl`, `qbittorrentUsername`, `qbittorrentPassword`, plus optional `qbittorrentCategory` and `qbittorrentSavePath` — which extend `defaultSettings` in `config/defaults.ts` and the `Settings` type in `packages/shared`. They ride the existing `settings` table and `SettingRepository` with no schema change.

The feature is addable and removable by adding/removing these files, five settings keys, four wiring lines in `app.ts`, and one nav entry.

## Prerequisite refactors (small, do these first)

Both are improvements on their own terms and align with `AGENTS.md`.

1. **`scanner/titleParser.ts` — split path handling from name parsing.** `parseTitle(filePath)` calls `extname()` on its input. Given a bare release name like `Inception.2010.2160p.BluRay.x265-GROUP`, `extname()` returns `.x265-GROUP` and silently truncates the string. Extract the core as `parseReleaseName(name: string): ParsedTitle` and reduce `parseTitle(filePath)` to basename/extname/parent-folder handling that delegates to it. Existing tests must pass unchanged; add cases for the new entry point.

2. **Move the release-tag regexes into `config/defaults.ts`.** `releaseTags`, `episodeTags`, and the year bound are inline in `titleParser.ts`, which `AGENTS.md` says they shouldn't be ("release-tag regexes live in dedicated constants/config files"). `releaseQuality.ts` needs to *extract* the same tags `titleParser.ts` *strips*, so one shared source of truth is what keeps them from disagreeing.

## Backend Design

### Connection and session (`qbittorrentClient.ts`)

`POST /api/v2/auth/login` with `username`/`password` as form data returns a `SID` cookie that must accompany every subsequent request. Three details decide whether this works at all:

- **The `Referer` header must match the qBittorrent `Host`.** qBittorrent rejects requests whose `Referer`/`Origin` doesn't match its own host and port — a CSRF defense that assumes a browser client. A server-side `fetch` sends no `Referer` by default, so the client must set it explicitly to the configured base URL. This is the classic "works in curl, fails from my app" failure and is worth a comment in the source.
- **`403` on login means the IP is temporarily banned** after repeated failures, not that the password is wrong. Map it to a distinct, accurate message — telling the user their password is wrong when qBittorrent has rate-limited them sends them down the wrong path.
- **Re-auth on expiry.** Cache the SID; on any `403` from a non-login endpoint, log in once and retry the call exactly once. No retry loops.

All calls carry `externalRequestTimeoutMs` and an `AbortSignal`.

### Hard security constraint: the endpoint allowlist

`qbittorrentSearch.ts` implements `start`, `status`, `results`, `stop`, `delete`, and read-only `plugins`. It **must not implement** `installPlugin`, `uninstallPlugin`, or `updatePlugins` — not "must not expose them via routes", but must not contain the methods at all, so no future route can reach them.

The reason is concrete. qBittorrent search plugins are arbitrary Python executing inside qBittorrent's process; the project's own wiki states plainly that they are not considered safe and use is at your own risk. Ottlib has no authentication and binds `0.0.0.0` on the LAN. A proxied `installPlugin` would let any device on the network achieve remote code execution on the qBittorrent host through a single URL parameter. Plugin installation stays in qBittorrent's own authenticated WebUI.

A test asserts the module exports no plugin-mutating method.

### Search lifecycle (`torrentSearchService.ts`)

qBittorrent's search is asynchronous, so this is a three-step flow rather than one request:

1. `POST search/start` with `pattern`, `plugins=enabled`, `category=movies` → returns `{ id }`.
2. Poll `GET search/status?id=` until `status` is `Stopped` (or the caller gives up).
3. `GET search/results?id=&limit=&offset=` → `results[]` with `fileName`, `fileSize`, `fileUrl`, `nbSeeders`, `nbLeechers`, `siteUrl`, `descrLink`, `engineName`. *(Verify these exact field names against a live instance during implementation — the API docs summarize them loosely and plugin output is inconsistent.)*
4. `POST search/delete?id=` to release the slot.

**The slot budget is a real operational constraint.** qBittorrent caps concurrent searches at 5 and returns `409` on `start` beyond that. Abandoned searches — user closes the tab mid-search — leak slots until qBittorrent is restarted. Mitigation: the service keeps an in-memory map of search ids it started with their creation time; it deletes on completion, deletes on client abandonment, and on a `409` reaps its own oldest tracked search before retrying `start` once. It only ever deletes ids it created, never ids belonging to a user's own WebUI session.

Result post-processing, once results are in:

- **Dedupe** by normalized `fileUrl` (infohash where the URL is a magnet), keeping the highest seeder count and recording every engine that carried it.
- **Parse** each `fileName` through `parseReleaseName()` and `releaseQuality()`.
- **Annotate** against the library: look up parsed title+year in `MovieRepository` and tag each result `owned` (a non-missing movie matches), `missing` (a matching movie exists but its file is gone), or `new`. The `missing` state is the most valuable signal here — it turns the search page into a repair tool for the existing library rather than only a discovery page.
- **Sort** by seeders descending by default; size and date available.
- Results with `nbSeeders` of `0` or `-1` (plugins that don't report it) are kept but sorted last and visually de-emphasized, never dropped.

### Handoff (`torrentHandoffService.ts`)

**Primary and default: send straight to qBittorrent.** `POST /api/v2/torrents/add` with `urls` set to the result's `fileUrl`, plus the configured `category` and `savepath`. qBittorrent accepts `magnet:`, `http`, and `https` in the same parameter and **fetches the `.torrent` itself**, which is why the v1 plan's server-side `.torrent` proxy and its SSRF guard are gone entirely — Ottlib never fetches a third-party URL. The only validation needed is that the URL's scheme is one of `magnet:`/`http:`/`https:` before forwarding.

Setting a dedicated **category** (default `ottlib`) matters beyond tidiness: it is what makes the optional Phase 2 progress view a single filtered query, and it lets the user route this app's grabs to a specific save path without disturbing their other torrents.

**Secondary: copy magnet.** Useful when the user wants it in a different client. One caveat must be handled rather than assumed away: `navigator.clipboard.writeText` is restricted to secure contexts, and Ottlib is served over plain HTTP on the LAN, so on any device that isn't `localhost` the modern clipboard API rejects. Implement a hidden-input + `document.execCommand('copy')` fallback, and if both fail, reveal the magnet in a read-only selectable field rather than showing a success toast for something that didn't happen.

The v1 plan's `magnet:` OS-launch handoff is **dropped**. With qBittorrent authenticated and one POST away, routing through the OS handler solves nothing and adds a `cmd.exe` argument-escaping hazard for no benefit.

### Health check (`torrentConnectionService.ts`)

A single "Test connection" action that reports precisely which stage failed, because there are four distinct failure modes and a generic error message makes all of them look the same:

1. Base URL unreachable → connection/DNS error.
2. Login rejected → bad credentials, or `403` → IP temporarily banned.
3. Connected but `search/plugins` returns an empty list → **Python is probably not installed on the qBittorrent host, or no plugins are installed.** Say this explicitly with a pointer to qBittorrent's Search tab.
4. Connected with plugins present → report the count and the enabled engine names.

### REST API (`routes/torrents.ts`)

```
POST    /api/torrents/search              — { q, year? } -> { searchId }
GET     /api/torrents/search/:searchId    — { status, total, results[] } (client polls)
DELETE  /api/torrents/search/:searchId    — release the qBittorrent search slot
POST    /api/torrents/send                — { url, movieId? } -> add to qBittorrent
GET     /api/torrents/connection          — cached connection/plugin health
POST    /api/torrents/connection/test     — active health check
```

Routes validate with zod schemas from `packages/shared/src/torrent.ts`, call services only, and contain no SQL — same as every other route file. `/api/torrents/send` is a `POST` for the same reason `play-local` is: a `GET` can fire from browser prefetch or a stray navigation, and adding a torrent must require an explicit action.

With qBittorrent unconfigured or unreachable, search returns an explicit `"not configured"` / `"unreachable"` state — not an error, and not a silent empty grid.

## Frontend Design

### Navigation — how the user reaches the feature

All global navigation today lives in `FloatingNavigationButtons` in `App.tsx`, a pathname-driven floating stack at `fixed bottom-5 right-5`. On the landing page (`/`) it renders a vertical `flex-col` of two buttons — Shelves, then Settings. There is no top nav bar; the header holds only the logo linking home.

**Primary entry: a third button in the landing stack.** Add a `Link to="/torrents"` inside the `pathname === '/'` branch. This keeps every global destination in one place — introducing a second nav location (e.g. a header icon) would mean users learn that some navigation is bottom-right and some is top-right, which is worse than a three-item stack.

**Insert it as the first child, not the last.** The container is anchored to `bottom-5` and grows upward, so the final child stays pinned to the bottom of the screen. Prepending the new link leaves Shelves and Settings at pixel-identical positions and grows the stack upward into empty space; appending would shift both existing buttons up and break their muscle memory for no reason.

**The `/torrents` page needs no navigation code at all.** `FloatingNavigationButtons` falls through to a bare "Back to library" button for any path that isn't `/` or `/shelves`, so the new route inherits the same back affordance as `/settings` and `/movie/:id` automatically.

**A new icon is required.** `SearchIcon` already exists but is used for the library's own search field; reusing it would make the button read as "search your library" rather than "search for downloads". Add a distinct `DownloadIcon` (or magnet glyph) to `components/icons.tsx` following the existing `Icon` wrapper convention, with `aria-label`, `title`, and an `sr-only` span matching the other buttons.

**Show the button even when qBittorrent is unconfigured.** Hiding it makes the feature undiscoverable for exactly the users who need onboarding; clicking through to the page's "not configured" empty state, which links to Settings, is the better path.

**Secondary entry points**, which is where most real usage will start:

- **Movie detail, file missing** — the strongest case. A movie whose file has disappeared gets a prominent "Find replacement" action that opens `/torrents` prefilled with its title and year. On a normal movie the same action appears quietly as "Find this".
- **Library empty state** — `LibraryEmptyState.tsx` has a post-setup "No videos found yet" branch that currently offers only *Scan* and *Manage folders*. A third link to `/torrents` fits naturally there. Deliberately **not** in the `SetupCard` first-time branch: that flow is a focused three-step setup and a fourth competing call to action would dilute it.

### The search page

- **Route `/torrents`** — search bar, results table, and an empty state that links to Settings when qBittorrent isn't configured or its plugin list is empty.
- **Results table** (not a poster grid — this is dense tabular data): release name, quality chips (resolution / source / codec / group), size, seeders/leechers, age, engine name, library-status badge (`Owned` / `File missing` / `New`), and the action cluster. Sortable by seeders, size, date. On phones the row collapses to a stacked card using the same `md:` reflow approach as the poster grid.
- **`TorrentSendButton.tsx`** — primary **Send to qBittorrent** with an optimistic success state and a clear error surface, plus a secondary **Copy magnet** carrying the non-secure-context fallback.
- **Entry points from the library** — a "Find this" action on the movie detail page prefills the search with title and year. On a movie whose file is **missing**, the same action surfaces more prominently as "Find replacement" — the strongest use case for the feature and free to wire.
- **Settings** — a qBittorrent section: URL, username, password (masked on read using the existing `••••` convention from `settingsService.ts`), default category and save path, and a **Test connection** button reusing the affordance already built for the TMDb key test.
- **State** — TanStack Query. Search is a mutation that returns a `searchId`, followed by a query polling `GET /api/torrents/search/:id` at ~750ms that stops on `Stopped`. The component fires `DELETE` on unmount and on navigation away so the slot is released. No keystroke-triggered searching — searches are explicit, because each one consumes one of five slots and hits third-party sites.
- **Styling** — Tailwind utilities with `dark:` variants only; no component CSS files.

## Config Storage

Nothing added to `config/config.json`. The five qBittorrent settings live in the existing SQLite `settings` table and take effect without restart, consistent with every other user-editable setting.

Two things the Settings UI should state plainly next to the credential fields, since the existing "no auth, trusted LAN only" posture now has sharper consequences: Ottlib stores qBittorrent's password, and anyone on the network who can reach Ottlib can search and add torrents to it.

## Setup / Run

1. Install **qBittorrent** with its WebUI enabled (Tools → Options → Web UI), and note the port, username, and password.
2. **Install Python on the qBittorrent host** if it isn't already — without it the Search tab and the entire `search/*` API are inert.
3. In qBittorrent's **Search** tab, install search plugins. Ottlib deliberately cannot do this for you. The qBittorrent project's [search-plugins wiki](https://github.com/qbittorrent/search-plugins/wiki) lists the available plugins and their target sites; plugins install from raw `.py` URLs. Two selection notes that affect Ottlib directly: avoid plugins the wiki flags with ✖ or ❗, since a single bad plugin degrades every other search in the same run, and prefer plugins that declare a movie category, because Ottlib filters on it.
4. Point qBittorrent's save path (or the `ottlib` category's save path) at a folder already configured as an Ottlib scan root.
5. In Ottlib → Settings → qBittorrent: enter the URL and credentials, set the category, and hit **Test connection**.
6. Search from `/torrents`, click **Send to qBittorrent**, and the download appears in the library on the next scan — immediately via "Rescan now", otherwise on the configured cron.

## Verification Plan

Vitest for units and services, Fastify `inject` for API integration, tests adjacent to the code they cover.

1. **Release parsing**: extend the `titleParser` table tests to cover `parseReleaseName()` directly, including the `extname()` corruption case (`Inception.2010.2160p.BluRay.x265-GROUP`) that motivated the split. Unit-test `releaseQuality()` over ~20 real-world release names for resolution/source/codec/group, including names carrying none of them.
2. **Client session handling**: with `fetch` mocked, assert login sends form-encoded credentials **and a `Referer` matching the configured host**; that the SID cookie is attached to subsequent calls; that a `403` on a normal call triggers exactly one re-login and one retry, not a loop; and that a `403` on login itself maps to the "IP banned" message rather than "bad password".
3. **Endpoint allowlist** (security-critical): assert `qbittorrentSearch.ts` exports no `installPlugin`, `uninstallPlugin`, or `updatePlugins` method, and that no route string in `routes/torrents.ts` reaches them.
4. **Search lifecycle**: mock `start`/`status`/`results` and assert the service polls until `Stopped`, pages results correctly, and issues `delete` on completion. Assert a `409` on `start` reaps the service's own oldest tracked search and retries once — and that it never deletes an id it did not create.
5. **Result processing**: duplicates across engines merge and keep the highest seeder count; `nbSeeders` of `0`/`-1` sorts last but is not dropped; a result missing optional fields normalizes rather than throwing; title+year annotation yields `owned`, `missing`, and `new` correctly against a seeded `movies` table.
6. **Handoff**: `POST /api/torrents/send` forwards `urls`, `category`, and `savepath` to `torrents/add`; rejects a URL whose scheme isn't `magnet`/`http`/`https`; and surfaces a qBittorrent failure as a clear error rather than a false success.
7. **Health check**: each of the four failure stages produces its own distinct message — especially the empty-plugin-list case mapping to the Python/plugins hint rather than a generic failure.
8. **Settings**: a masked `••••` password in an update preserves the stored password rather than overwriting it, mirroring the existing TMDb/OMDb key tests.
9. **Empty and error states**: searching with qBittorrent unconfigured returns the explicit state, not a 500.
10. **Manual, against a real qBittorrent** — these depend on plugin behavior outside our control:
    - Confirm search returns results and that `fileName`/`fileSize`/`nbSeeders`/`fileUrl` field names match what the code expects; fix the normalizer if they differ.
    - Send both a magnet-style and an `http` `.torrent`-style result and confirm both land in qBittorrent under the `ottlib` category.
    - Open the search page and navigate away mid-search five times, then confirm a sixth search still starts — the slot-leak regression.
    - Copy a magnet from a phone over `http://<lan-ip>:8080` and confirm the non-secure-context fallback works rather than silently failing.
    - Let a download complete into a scan root and confirm the scanner ingests and matches it.

## Phase 2 — read-only progress (optional, now cheap)

Tracking was part of the original ask and was dropped when the design was a generic handoff. With qBittorrent as the only integration and an authenticated client already in place, it is roughly one endpoint: `GET /api/v2/torrents/info?category=ottlib` returns name, progress, state, dl speed, and ETA for exactly the torrents Ottlib sent.

That is a small strip on the search page or a `/downloads` route, read from a TanStack Query polling at ~2s while anything is active, with **no database table** — qBittorrent remains the single source of truth and there is no local state to drift. Explicitly not in v1 scope; call it when you want it.

## Maintenance

Update `FEATURES.md` with a **Torrent Search** section as items land, matching the existing checklist style. Keep this file in sync with what was actually built — where implementation diverges, amend the plan rather than leaving it aspirational.
