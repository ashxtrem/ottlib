# Duplicate detection + comparison table (movie detail page)

## Context

OttLib scans one video file per library row — there's no existing concept of "these two files are
the same film." When a user finds a better-quality release via the existing torrent search →
qBittorrent handoff (already fully working: [MovieActionButtons.tsx](packages/client/src/components/MovieActionButtons.tsx) →
[TorrentSearchPage.tsx](packages/client/src/pages/TorrentSearchPage.tsx) → [TorrentSendButton.tsx](packages/client/src/components/TorrentSendButton.tsx)) and downloads
it into a scanned folder, the next scan picks it up as a **second, independent row** for the same
film — nothing in the app tells the user that happened, or helps them judge which copy is better.

This plan adds: on the movie detail page, a count of other copies of the same title in the library
plus a **Compare** button that opens a read-only side-by-side technical comparison table (resolution,
HDR, codec, audio/subtitle tracks, file size, etc. — everything already captured per file). The user
judges which copy is better and deletes the old file themselves (e.g. via the existing
[RevealInFolderButton.tsx](packages/client/src/components/RevealInFolderButton.tsx)); the app's existing missing-file detection
(soft-marks a row `missing` when its file disappears, never deletes history — see [FEATURES.md](FEATURES.md))
then naturally drops that copy out of the duplicate count on the next scan. No new destructive
operation, no qBittorrent download-completion polling — confirmed with the user as explicit
decisions, not assumptions:

- **Match key:** IMDb ID when the title is matched (for TV, IMDb ID + season + episode, since two
  different episodes of the same show must never be treated as duplicates of each other); title+year
  fallback for pending/unmatched titles (mirrors the existing torrent-match logic).
- **Read-only compare** — no delete/replace action in this feature.
- **Purely reactive** to the existing scan cycle — no qBittorrent download-completion integration.
- **Full technical detail** in the table; **missing copies excluded** from both the count and the table.

### A schema gap this surfaces

TV episode metadata is currently stored only as free text baked into `metadata_title` (e.g.
`"Show Name · S1E2 · Episode Title"` — see [metadataMatchService.ts:305](packages/server/src/services/metadataMatchService.ts:305)). Neither
`imdb_id` nor `provider_id` on the `movies` row are episode-specific — both are the **show's** IDs
([metadataMatchService.ts:313](packages/server/src/services/metadataMatchService.ts:313)), and there are no `season`/`episode` columns on `movies`
itself (only on the pre-acceptance `movie_match_candidates` table). Grouping TV duplicates by IMDb ID
alone would incorrectly lump every episode of a show together. Per the user's explicit choice, this
plan adds real `season`/`episode` columns to `movies` and persists them at accept-time (the values are
already computed in `metadataMatchService`, just never saved) — this is the smallest change that makes
the request ("IMDb ID / title+year, movies and TV") actually correct.

## Server changes

### 1. New migration — `packages/server/src/db/migrations/012_episode_columns.ts`

Same idempotent-column-add pattern as [011_metadata_media_type.ts](packages/server/src/db/migrations/011_metadata_media_type.ts): add
`season INTEGER` and `episode INTEGER` to `movies`. Then a best-effort backfill for existing TV rows:
select `id, metadata_title` where `metadata_media_type = 'tv' AND season IS NULL`, extract
`S(\d+)E(\d+)` from the composed title text with a JS regex (the exact format the app itself writes —
see the template literal at [metadataMatchService.ts:305](packages/server/src/services/metadataMatchService.ts:305)), and `UPDATE` each row. Register
in [db.ts](packages/server/src/db/db.ts) exactly like the other ten migrations.

### 2. Persist season/episode on accept

In `metadataMatchService.saveMetadata` (around [metadataMatchService.ts:303-313](packages/server/src/services/metadataMatchService.ts:303)), the
`options.season`/`options.episode` values are already available — pass them through to
`movieRepository.applyMetadata()`. Extend `applyMetadata`'s parameter object and its `UPDATE movies SET
…` statement ([movieRepository.ts:208-215](packages/server/src/repositories/movieRepository.ts:208)) to also set `season = @season, episode =
@episode` (null for movies).

### 3. Expose the new fields on `Movie`

`movieRepository.selectSql()` already does `SELECT m.*` ([movieRepository.ts:226](packages/server/src/repositories/movieRepository.ts:226)), so
`metadata_media_type`, `season`, `episode`, and `size` are already fetched — they're just missing from
the `MovieRow` TypeScript interface and the `map()` function ([movieRepository.ts:4-15,323-334](packages/server/src/repositories/movieRepository.ts:4)). Add
them there, and add corresponding fields to `movieSchema` in [packages/shared/src/index.ts](packages/shared/src/index.ts):
`mediaType: z.enum(['movie','tv']).nullable()`, `season: z.number().int().positive().nullable()`,
`episode: z.number().int().positive().nullable()`, `fileSizeBytes: z.number().int().nonnegative()`.
No SQL changes needed — purely surfacing data that's already queried.

### 4. Duplicate lookup — repository + service + route

New repository method `movieRepository.findDuplicateIds(id: number): number[]`:
- Read the anchor row's `imdb_id`, `metadata_media_type`, `season`, `episode`, and the same
  `COALESCE(title_override, metadata_title, parsed_title)` / `COALESCE(metadata_year, parsed_year)`
  normalization already used by `findForTorrentMatch` ([movieRepository.ts:96-102](packages/server/src/repositories/movieRepository.ts:96)).
- If `imdb_id` is set: match other rows on `imdb_id` (plus `season = ? AND episode = ?` when
  `metadata_media_type = 'tv'` and both are non-null).
- Else: fall back to the same case-insensitive title+year match `findForTorrentMatch` already uses.
- Always `AND missing = 0 AND id != ?`.

New `LibraryService.listDuplicates(id, deviceId?)`: calls `findDuplicateIds`, then reuses the
**already-public** `listByIds(ids, deviceId)` ([libraryService.ts:19-21](packages/server/src/services/libraryService.ts:19)) — no new mapping
code, it already attaches `mediaInfo.tracks` and `shelves` correctly.

New route in [library.ts](packages/server/src/routes/library.ts), alongside the existing `/api/movies/:id/candidates`
pattern ([library.ts:50-53](packages/server/src/routes/library.ts:50)):
```
app.get('/api/movies/:id/duplicates', async (request, reply) => {
  const id = Number((request.params as any).id); if (!movies.get(id)) return reply.code(404).send({ error: 'Movie not found' });
  return library.listDuplicates(id, deviceId(request.headers));
});
```
Response is `Movie[]` directly (same convention as `GET /api/movies/:id/candidates` returning
`MatchCandidate[]`) — no new shared schema needed, `movieSchema` already exists.

### 5. Relocate `formatBytes` to `@ottlib/shared`

It currently lives only in [TorrentResultRow.tsx:4](packages/client/src/components/TorrentResultRow.tsx:4) (client-only). Per
`AGENTS.md`'s "shared types/schemas live in packages/shared" convention (and matching how
`formatResolution`/`formatRuntime` already live there), move it into
[packages/shared/src/index.ts](packages/shared/src/index.ts) next to `formatResolution`, and update `TorrentResultRow.tsx`'s
export/import accordingly. The new compare dialog needs it for file-size columns.

## Client changes

### 6. `useMovieDuplicates` hook — `packages/client/src/hooks/useMovies.ts`

Same shape as the existing `useMatchCandidates`:
```ts
export function useMovieDuplicates(id: string | undefined) {
  return useQuery({ queryKey: ['movie-duplicates', id], enabled: Boolean(id), queryFn: () => api<Movie[]>(`/api/movies/${id}/duplicates`) });
}
```
Add `client.invalidateQueries({ queryKey: ['movie-duplicates'] })` alongside the existing
`['movie']` invalidations in `useMovieActions().refresh()` ([useMovies.ts](packages/client/src/hooks/useMovies.ts)) and in the
completion effect in [useMetadataRefresh.ts](packages/client/src/hooks/useMetadataRefresh.ts) — same points that already invalidate
`['movie']`, so duplicate counts stay in sync with rematches/refreshes without adding new refresh
plumbing.

### 7. New component — `packages/client/src/components/DuplicateCompareDialog.tsx`

Built on the existing `Modal` component ([Modal.tsx](packages/client/src/components/Modal.tsx)), wide (`max-w-4xl`,
similar to `ShelfSelectionDialog`'s `max-w-5xl`), single "Close" footer button (no destructive
actions, matching the read-only decision). Props: `open`, `onClose`, `primary: Movie`,
`duplicates: Movie[]`.

- Columns: `primary` plus each duplicate, sorted best-first by `mediaInfo?.height` descending (same
  ranking basis as the existing `sort=quality` library sort — [movieRepository.ts:257](packages/server/src/repositories/movieRepository.ts:257)).
- Rows, using existing shared formatters (`formatResolution`, `formatRuntime`, `formatMediaLanguage`,
  the relocated `formatBytes`): resolution, HDR format, video codec/profile, bitrate, container,
  runtime, file size, audio tracks (language + codec + channels per track), subtitle tracks, watched
  status, added date, availability, and file path (reuse `RevealInFolderButton` per column on local
  clients, same as the detail page already does).
- Table wrapped in `overflow-x-auto` (same overflow pattern as `TorrentResultTable`'s desktop table).

### 8. `MovieDetailPage.tsx` wiring

Add `const duplicates = useMovieDuplicates(id);` and `const [compareOpen, setCompareOpen] = useState(false);`.
Next to the existing runtime/rating/source line ([MovieDetailPage.tsx:58](packages/client/src/pages/MovieDetailPage.tsx:58)), when
`duplicates.data?.length`, render `"N other copies in your library"` + a **Compare** button that opens
the dialog. Render `<DuplicateCompareDialog open={compareOpen} onClose={...} primary={item}
duplicates={duplicates.data ?? []} />` alongside the page's other dialogs.

### 9. `FEATURES.md`

Add one line under "Core Library" documenting the new duplicate count + comparison table, matching
the existing checklist style.

## Tests

- `movieRepository.test.ts`: `findDuplicateIds` — matched-by-IMDb movies; matched-by-IMDb+season/episode
  TV (confirm two different episodes of the same show are *not* grouped); title+year fallback for
  unmatched rows; excludes `missing` rows; excludes the anchor itself.
- `metadataMatchService.test.ts`: extend an existing TV-accept test case to assert `season`/`episode`
  are persisted on the movie row after `accept()`.

## Verification

1. `npm test` (server + shared workspaces) — new repository/service tests plus the full existing
   suite (74+ tests today) must stay green.
2. `npx tsc -b` in `packages/server` and `packages/client` — confirm the new shared fields don't break
   existing consumers of `Movie`.
3. Manual: scan a folder containing two files that parse to the same title/year (or fake it by editing
   two rows in a local dev DB), open the movie detail page for one, confirm the "N other copies ·
   Compare" line appears, open the dialog, confirm the table renders both copies with correct
   resolution/HDR/audio data and the better one sorts first. Confirm it does *not* appear for a title
   with no duplicates, and that a `missing`-marked copy drops out of the count after a rescan.
4. Manual: accept a TV candidate for two different episodes of the same show pointing at two
   different files; confirm they do *not* show up as duplicates of each other (season/episode differ),
   but two files matched to the *same* episode do.