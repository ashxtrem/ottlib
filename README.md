# OttLib

OttLib is a self-hosted movie-library app for a trusted home network. Point it at your video folders, let it match titles and artwork, then browse or play your collection from your PC, another computer on your LAN, or an Android device.

## Highlights

- Scan one or more media folders, with configurable extensions and ignored paths.
- Match movies against TMDb, with OMDb as a fallback, and cache artwork locally.
- Browse a responsive poster grid; search, filter, sort, and mark titles watched per device.
- Review duplicate copies and their technical details.
- Play locally, hand off to a LAN player, open in Android media players, or stream with byte-range support.
- Schedule rescans and review scan progress/history.
- Search enabled qBittorrent search plugins and hand selected releases back to qBittorrent.

## Stack

- React, Vite, Tailwind CSS, and TanStack Query
- Fastify and TypeScript
- SQLite via `better-sqlite3`

## Prerequisites

- Node.js 22 or later
- npm

Optional integrations:

- A [TMDb API key](https://www.themoviedb.org/settings/api) for automatic metadata and artwork
- An OMDb API key as an additional metadata fallback
- qBittorrent with its Web UI and search plugins enabled for torrent search and handoff

## Getting started

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The API server runs on port `8081` by default.

On first start, OttLib copies `config/config.example.json` to `config/config.json` and creates the configured app-data directory. `config/config.json` and `data/` are local-only and are ignored by Git.

In the app, open **Settings** to:

1. Add one or more video-library folders.
2. Enter and test a TMDb API key.
3. Optionally configure OMDb and qBittorrent.
4. Start a scan.

## Configuration

Edit `config/config.json` before starting the server when you need a different port or data location:

```json
{
  "port": 8081,
  "appDataPath": "./data"
}
```

Metadata keys, library folders, schedules, and qBittorrent credentials are managed in the Settings page rather than committed to the repository.

For qBittorrent, enable **Tools → Options → Web UI**, create Web UI credentials, and then add its URL and credentials in OttLib's Settings page. Anyone on the trusted network who can access OttLib can use this integration.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Build shared types and start the API and client development servers. |
| `npm run build` | Build the shared package, server, and client. |
| `npm start` | Build everything and start the production server. |
| `npm test` | Run all workspace tests. |

## Project structure

```text
packages/
  client/   React user interface
  server/   Fastify API, SQLite access, scanners, and provider integrations
  shared/   Types shared by client and server
config/     Bootstrap configuration example
```

## Notes

OttLib is designed for a single, trusted LAN and does not include user accounts or authentication. Keep it behind your local network and avoid exposing it directly to the public internet.
