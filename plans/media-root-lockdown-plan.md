# Media root lockdown

Issue: #25
From the audit (`reports/ottlib-independent-audit.md`, AUD-001): `/media/` serves the whole data directory, database included.

## 1. Why
- **The static mount exposes the database.** `packages/server/src/app.ts:125` registers `@fastify/static` with
  `root: appDataPath, prefix: '/media/'`. `library.sqlite`, `-wal` and `-shm` live in that directory
  (`packages/server/src/db/db.ts:27`), so `GET /media/library.sqlite` returns the database with every stored secret
  (qBittorrent and subtitle-provider credentials, metadata keys, the access PIN hash, `stream_secret`, profile PIN hashes).
- **The leaked `stream_secret` stays valid.** It signs every `?key=` stream URL (`services/accessPinService.ts:69`) and is
  only replaced when the PIN changes (`accessPinService.ts:47`), so a copy taken before the fix keeps working after it.

## 2. Decisions
Taken on the coordinator's recommendation:
- **Mount only the artwork folders.** Picked: one static root each for `<data>/posters` (prefix `/media/posters/`) and
  `<data>/backdrops` (prefix `/media/backdrops/`). Rejected: a single `<data>/public` (moves files on disk for no gain).
  Subtitles are not served from `/media/` (they go through `/api/movies/:id/subtitles/...` routes), so no subtitles root.
- **Defence in depth on both roots:** `serveDotFiles: false`, `index: false`, and an extension allow-list (`.jpg`, `.jpeg`,
  `.png`, `.webp`) enforced by the server: any other file under those roots answers 404.
- **Unknown `/media/*` paths answer 404**, not the web app's `index.html`, in the not-found handler (`app.ts:129`).
- **Rotate `stream_secret` once.** Picked: an idempotent `ensure*` migration that adds a `secret_version` column to
  `access_pin`; when the column is missing it adds it and replaces any existing `stream_secret` with a fresh 64-hex
  value, so the rotation runs exactly once per database. Rejected: rotate on every start (breaks `?key=` URLs on every
  restart). Auth sessions are stored hashed (`015_access_pin.ts`), so they need no rotation.
- **Release note:** `docs/releasing.md` is the process doc, so the note for users goes in the PR body and the issue
  comment: anyone who ran without a PIN should change their qBittorrent and OpenSubtitles passwords and metadata keys.

## 3. Server
- `packages/server/src/app.ts`: replace the one `/media/` registration with the two roots above. Fastify-static needs
  `decorateReply: false` on every registration after the first. Poster and backdrop URLs keep the `/media/posters/…` and
  `/media/backdrops/…` shape (`repositories/movieRepository.ts:433`, `shelfMovieRepository.ts:23`), so no contract change.
- `packages/server/src/routes/authGuard.ts` matches route patterns; the new patterns `/media/posters/*` and
  `/media/backdrops/*` are not public, so they stay guarded when a PIN is set (pinned by `routes/auth.test.ts:39`).
- New `packages/server/src/db/migrations/021_stream_secret_rotation.ts` exporting `ensureStreamSecretRotated(db)`, called
  last in `createDatabase` (`db/db.ts`). New secret: `lower(hex(randomblob(32)))` in SQL or `randomBytes(32).toString('hex')`.

## 4. Tests to change or add
- New `packages/server/src/routes/mediaStatic.test.ts`: with no PIN and with a PIN plus a valid session,
  `GET /media/library.sqlite`, `/media/library.sqlite-wal`, `/media/library.sqlite-shm`, `/media/./library.sqlite`,
  `/media//library.sqlite`, `/media/LIBRARY.SQLITE` and `/media/posters/../library.sqlite` all answer 404 (or 400 for
  traversal) and never a body starting `SQLite format 3`; a poster file written to `<data>/posters/` answers 200; a
  non-image file in `<data>/posters/` answers 404; a backdrop answers 200.
- New `packages/server/src/db/migrations/021_stream_secret_rotation.test.ts`: an existing secret is replaced on first run,
  left alone on the second; a database with no PIN row is fine.

## 5. Tasks
| Task | Files | Spec | Depends on | Checks |
|---|---|---|---|---|
| T1 Mount only artwork | `app.ts`, `routes/mediaStatic.test.ts` | full | – | `/media/library.sqlite*` and aliases 404 with and without a session; posters and backdrops still 200; non-image files under the roots 404; unknown `/media/*` 404 even with the client build present; `auth.test.ts` still passes |
| T2 Rotate stream secret once | `db/migrations/021_stream_secret_rotation.ts` + test, `db/db.ts` | full | – | first run replaces an existing secret with a new 64-hex value; second run leaves it; no PIN row is fine; full server suite passes |
T1 and T2 touch different files and run alongside each other.

## 6. Risks and known gaps
- Rotating `stream_secret` invalidates `?key=` URLs already handed to external players; clients ask
  `/api/movies/:id/playback` each time, so they get fresh ones.
- Credentials already leaked cannot be revoked by the server; the release note asks users to change them.

## 7. Progress log
- 2026-10-25: plan written from issue #25 (small-job lane).
