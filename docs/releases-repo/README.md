# OttLib

OttLib is a self-hosted movie library for a trusted home network. Point it at your video folders, let it match titles and artwork, then browse and play your collection from a browser, an Android phone or foldable, or an Android TV / Google TV.

This repository hosts the downloads. Get them from the [latest release](https://github.com/ashxtrem/ottlib-releases/releases/latest).

## What to download

| You want | Download |
| --- | --- |
| The server, nothing else installed | `ottlib-<version>-<os>-<arch>.zip` (Windows) or `.tar.gz` (Linux, macOS). Includes Node.js and ffprobe. |
| The server, smaller download | the same name ending in `-lite`. Needs Node.js 22 or later, plus FFmpeg's `ffprobe` on the PATH for media details. |
| The Android TV app | `ottlib-tv-<version>.apk` |
| The phone / foldable app | `ottlib-mobile-<version>.apk` |
| To check your download | `SHA256SUMS` |

Server bundles are built for `windows-x64`, `linux-x64`, `linux-arm64`, `macos-arm64` (Apple silicon) and `macos-x64` (Intel). A bundle only runs on its own OS and CPU.

## Running the server

1. Extract the archive anywhere you want to keep it (`config/` and `data/` are created inside it).
2. Start it:
   - **Windows:** double-click `start.bat`.
   - **macOS:** double-click `start.command`.
   - **Linux:** run `./start.sh`.
3. Open `http://localhost:8081` on that machine, or `http://<that-machine's-ip>:8081` from another device on your network.
4. In **Settings**, add your video folders and, for posters and descriptions, a free [TMDb API key](https://www.themoviedb.org/settings/api) (an OMDb key is an optional fallback). Then start a scan.

Leave the launcher window open; closing it stops the server. To change the port or turn off network discovery, edit `config/config.json` (`port`, `advertise`) and restart.

**Firewall:** allow the server (Node.js) through your firewall for private networks, including inbound UDP so the TV and phone apps can discover it automatically.

### Upgrading

Extract the new version next to the old one, then copy `config/` and `data/` from the old folder into the new one. Your library, settings and watch history are kept in those two folders.

### Things your OS may say

The downloads are not code-signed.

- **Windows SmartScreen** shows "Windows protected your PC": choose **More info**, then **Run anyway**.
- **macOS Gatekeeper** may block `start.command` the first time. Run this once in Terminal, then try again: `xattr -dr com.apple.quarantine <the extracted folder>`.

### Lite bundles

Install [Node.js](https://nodejs.org) 22 or later. For media details (codecs, audio and subtitle tracks), install [FFmpeg](https://ffmpeg.org) so that `ffprobe` is on your PATH. The launcher tells you if either is missing.

## Installing the Android apps

The apps aren't on an app store, so you sideload the APK.

**Phone or foldable:** download `ottlib-mobile-<version>.apk` on the phone, open it, and allow your browser or file manager to install unknown apps when asked.

**Android TV / Google TV:** enable developer mode (Settings → System → About → click *Android TV OS build* seven times), turn on **Wireless debugging** or **USB debugging**, then from a computer:

```bash
adb connect <tv-ip>:5555
adb install -r --user 0 ottlib-tv-<version>.apk
adb shell cmd package compile -m speed-profile -f dev.ottlib.tv
```

`--user 0` matters on TVs with a second user profile. The last command applies the bundled performance profile right away so scrolling is smooth.

On first launch both apps list OttLib servers found on your network. If the list stays empty, type the address shown under **Settings → Server info** in the web app. The device must be on the same network as the server.

## Verifying a download

Compare a file against `SHA256SUMS`:

```bash
sha256sum -c SHA256SUMS --ignore-missing
```

On Windows: `Get-FileHash <file> -Algorithm SHA256`.

The Android APKs are signed with a release key whose certificate SHA-256 fingerprint is:

```
5A:90:D8:64:96:45:43:EB:51:43:70:22:99:D7:85:E2:53:A7:D4:98:5E:81:56:AE:CF:2D:DD:3E:B2:C4:64:3D
```

Android checks this key on updates: an APK signed with a different key can't update an installed copy.

## Notes

- OttLib is meant for a trusted home network. Don't expose it to the internet: it has no login.
- The bundled `ffprobe` is an unmodified build of FFmpeg, licensed GPL-3.0 (see `runtime/NOTICE.txt` in the full bundles).
