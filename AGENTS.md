# AGENTS.md — Project Guidelines

Guidelines for anyone (human or AI agent) working in this repo. Keep this file up to date as conventions evolve.

## Core principles

- **Modularity first.** Every feature should be addable/removable without touching unrelated code.
- **Small files.** No file over ~700 lines (hard stop). Treat 300–400 lines as the point where you should seriously consider splitting.
- **One responsibility per file/class.** If a file needs section-comment dividers to stay organized, it should be split into multiple files.
- **No premature abstraction.** Apply the plug-in patterns below where extensibility is an explicit goal (metadata providers, playback handoff). Don't generalize one-off code (e.g. the settings route) just for symmetry.

## Layering (server)

```
routes/       HTTP only — parse/validate request, call a service, shape response. No business logic.
services/     Business logic / orchestration (e.g. scan orchestration, match orchestration).
repositories/ DB access only. One repo file per table. No raw SQL outside this layer.
providers/    Pluggable external integrations (see plug-in pattern below).
```

Each layer only calls the layer directly below it. Routes never touch the DB directly; services never touch Fastify's `req`/`reply`.

## Plug-in pattern for extensible features

Used wherever we explicitly want "add a new implementation without touching existing code":

```ts
// metadata/MetadataProvider.ts
interface MetadataProvider {
  name: string;
  search(title: string, year?: number): Promise<MovieMetadata | null>;
}
```

- Each provider (TMDb, OMDb, future ones) is implemented in its own file, keeping the shared interface.
- Orchestrators (e.g. `matcher.ts`) iterate a registered, ordered list of providers — new providers are added by writing one file and registering it, without editing existing provider code.
- Same pattern applies to playback handoff strategies (local-launch, LAN `.m3u`, Android intent) — one interface, one file per strategy, selected by request context (e.g. loopback vs LAN vs Android).

## Other conventions

- **Repository pattern for SQLite** — every table has one repo file with typed CRUD methods. No inline SQL in routes or services.
- **Config over conditionals** — extension allow-lists, ignored-folder patterns, release-tag regexes live in dedicated constants/config files, not inline in logic.
- **No barrel `index.ts` re-exports** — import directly from the defining file. Keeps the dependency graph traceable and avoids circular imports as the codebase grows.
- **Tests live next to code** — `titleParser.ts` + `titleParser.test.ts` in the same folder, not a mirrored `/tests` tree.
- **Shared types/schemas** live in `packages/shared` and are imported by both server and client — never duplicate a type definition across packages.

## Frontend

- **Tailwind CSS** for all styling — no per-component `.css` files.
  - Utility classes keep styling colocated with markup (component files stay self-contained).
  - Responsive breakpoints (`md:`, `lg:`) handle the desktop-grid → phone-grid reflow without custom media queries.
  - Production builds purge unused classes automatically.
  - `dark:` variants available for dark mode.
- Components stay presentational where possible; data fetching lives in hooks (`useMovies`, `useSettings`, etc.), not inline in page components.

## Android clients (`apps/android`)

A Gradle project, separate from the npm workspaces. Same principles as above: small files, one responsibility each.

```
core/model      @Serializable DTOs mirroring packages/shared (pure JVM)
core/network    OkHttp API client (pure JVM)
core/data       DataStore-backed stores + ConnectionManager (Android library)
core/discovery  mDNS server discovery via NsdManager (Android library)
core/player     Media3 player factory, MediaItem mapping, progress reporting, picture modes (Android library)
core/presentation  ViewModels (one per screen), LoadState/PosterItem/formatters, palette, AppContainer (manual DI)
core/update     Self-update from GitHub releases: release lookup, verified APK download, system installer (Android library)
tv              TV app: Compose for TV screens, D-pad focus, Watch Next
mobile          Phone/foldable app: Material 3 screens, touch player (gestures, PiP, Flex mode)
```

- **Screens are per app; logic is shared.** A ViewModel or UI-neutral helper goes in `core/presentation` so every app gets it. Form-factor differences go behind an interface the app supplies to `AppContainer` (e.g. `ContinueWatchingPublisher`: Watch Next on TV).

- **Contract fixtures.** `packages/shared` stays the single source of truth for API shapes. Kotlin can't import zod, so `packages/server/src/routes/nativeClient.test.ts` writes real responses to `contract/fixtures/`, and `core/model`'s `ContractFixturesTest` decodes them strictly. When you change a response the TV app uses, update the fixtures (`npx vitest run -u` in `packages/server`) and the Kotlin DTO in the same change.
- **Server-relative URLs.** The server returns paths (`/api/stream/1`, `/media/posters/x.jpg`); the app resolves them against the active server with `OttlibApi.resolve`. The app never builds stream URLs itself — it asks `GET /api/movies/:id/playback`.
- **API version.** Bump `apiVersion` in `packages/shared/src/playback.ts` (and `SUPPORTED_API_VERSION` in `core/model`) only for breaking changes to endpoints the app uses.
- **TV focus.** Every screen sets an initial focus and restores focus when returning from a child screen; single-line text fields hand ↑/↓ back to focus navigation.
- **Adaptive, not device-specific (mobile).** Layouts branch on the window width class (`windowWidth()`) and posture (`rememberTabletopSplit`), never on device model or orientation, so the Fold's cover/inner screens, split screen and PiP all work. The activity handles size/fold changes itself (`configChanges`), so playback survives folding.
- **Build/test:** `./gradlew test :tv:assembleDebug :mobile:assembleDebug` from `apps/android`.

## When adding a new feature

1. Does it need a new pluggable strategy (another metadata source, another playback mechanism)? → add one file implementing the existing interface, register it, done.
2. Does it need a new DB-backed concept? → add a migration, a repo file, then wire routes/services on top.
3. Before adding a file, check whether an existing file is approaching the 700-line limit and would be a better place to split rather than grow.
