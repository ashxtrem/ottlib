# Subtitle downloads

Configure **Settings → Subtitle downloads** in the web app. Add an OpenSubtitles API key, a SubDL API key, or both. OpenSubtitles account credentials are optional and enable the account's download allowance. Credentials stay on the server and are masked in settings responses. Provider quotas apply; the app reports failures and keeps results from other working providers.

- **Android TV:** reveal player controls with ↑/↓, then select **Find subtitles**. Existing tracks remain in the CC selector.
- **Android mobile:** open **Audio & subtitles → Find subtitles online**.
- **Web:** open a title and select **Find subtitles**. Web playback continues to use external players.

Search automatically using library metadata and an OpenSubtitles file hash, use the original filename, or enter a title manually. Year, season, and episode can be edited for the search without changing library metadata. Choose languages with the language buttons or enter comma-separated codes, for example `en, hi, ta`. Each device remembers its search languages separately from subtitles on/off.

Results display language, provider, release, format, and available matching/SDH/forced indicators. On Android, **Download & use** saves and selects the subtitle in the current player; playback can briefly rebuffer while its media source reloads. Position, play/pause state, playback speed, and selected audio are retained. Close the overlay to return to the video.

Downloaded subtitles are persisted under the server data directory and included in the existing playback API for every client. A uniquely named copy is also written beside the video when possible, without overwriting files. Read-only media folders use managed server storage. An external player receiving a LAN stream may need its own subtitle loading mechanism; the web dialog offers links to saved subtitle files.

Supported downloaded text formats are SRT, WebVTT, ASS, and SSA, encoded as UTF-8 or UTF-16. Files are normalized to UTF-8. Other encodings produce a clear error rather than corrupted text. ZIP downloads must contain one supported subtitle; SubDL episode packs use individual-file links. Downloads have size limits and validated provider hosts.

The implementation uses additive endpoints; API version remains 1:

- `GET /api/subtitles/options`
- `POST /api/movies/:id/subtitles/search`
- `POST /api/movies/:id/subtitles/download`

Search/download endpoints require the same access PIN session as other library operations. Subtitle file URLs use the existing per-movie playback keys. Search results expire after 15 minutes; search again if a result has expired. Downloads already saved are reused without spending another provider download.

Providers implement `SubtitleProvider` in `packages/server/src/providers/subtitles` and register in `subtitleProviders.ts`. Contracts live in `packages/shared/src/subtitles.ts`, with corresponding Kotlin DTOs and strict response fixtures.

Provider documentation: [OpenSubtitles](https://opensubtitles.tawk.help/article/getting-started), [SubDL](https://subdl.com/developers).
