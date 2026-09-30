# Releasing OttLib

This source repository is private; downloads are published in the public repository [`ashxtrem/ottlib-releases`](https://github.com/ashxtrem/ottlib-releases), whose README is the install and deployment guide (its source is `docs/releases-repo/README.md` here; copy changes across by hand).

Releases are built by `.github/workflows/release.yml` when a `v*` tag is pushed. It builds the Android APKs and the server bundles for every platform, then creates a **draft** release in the public repo, with notes from the commit subjects since the previous tag and a `SHA256SUMS` file. Review the draft there (the notes are public) and click **Publish**.

```bash
git tag v0.2.0
git push origin v0.2.0
```

The tag is the only version number: `v0.2.0` becomes Android `versionName` 0.2.0 and `versionCode` 200 (`major*10000 + minor*100 + patch`), and the version in the bundle file names. Tags with a suffix (`v0.2.0-rc1`) are published as pre-releases.

## Release assets

| Asset | Contents |
| --- | --- |
| `ottlib-tv-<version>.apk` | Android TV / Google TV app |
| `ottlib-mobile-<version>.apk` | Phone and foldable app |
| `ottlib-<version>-<os>-<arch>.zip` / `.tar.gz` | Server with its own Node.js runtime and ffprobe. Nothing else to install. |
| `ottlib-<version>-<os>-<arch>-lite.zip` / `.tar.gz` | Server only (about 30 MB). Needs Node.js 22+ and, for media details, `ffprobe` from FFmpeg on the PATH. |
| `SHA256SUMS` | Checksums of everything above |

Bundles are built for `windows-x64`, `linux-x64`, `linux-arm64`, `macos-arm64` and `macos-x64`. Native modules (SQLite) are compiled for the platform each bundle is built on, so a bundle only runs on its own OS/arch.

## Running the server bundle

Extract it anywhere and run `start.bat` (Windows), `start.command` (double-click on macOS) or `./start.sh` (Linux/macOS). Open `http://localhost:8081`. `config/` and `data/` are created next to the launcher.

To upgrade, extract the new version and copy `config/` and `data/` from the old folder into it.

The bundles are not code-signed. Windows SmartScreen may ask you to confirm ("More info" → "Run anyway"). On macOS the launcher clears the download quarantine flag; if Gatekeeper still blocks `start.command`, run `xattr -dr com.apple.quarantine <folder>` once.

## One-time setup: publishing to the public repo

The workflow's own token can't write to another repository, so it uses a fine-grained personal access token stored as the `RELEASES_TOKEN` secret:

1. GitHub → Settings → Developer settings → Fine-grained tokens → **Generate new token**.
2. Resource owner `ashxtrem`; repository access **Only select repositories** → `ottlib-releases`; permission **Contents: Read and write**; pick an expiry (and diarise renewing it).
3. `gh secret set RELEASES_TOKEN --repo ashxtrem/ottlib` and paste the token.

The publish job fails early with a clear message if the secret is missing. If the token expires, releases stop at that step and can be re-run after replacing it.

Private repositories use metered Actions minutes, and macOS minutes count ten times. A release run costs roughly 50 minutes of the free allowance.

## One-time setup: Android signing

APKs are signed with a release keystore held in repository secrets. The build fails rather than fall back to the debug key if the secret is missing. This repo reuses the keystore from `ashxtrem/hashlark`; the two apps have different package names, so sharing one key is fine. Keep a backup of the keystore: if it is lost, installed users must uninstall before they can update.

Secrets can't be copied between repositories, so set them from the keystore file and its passwords:

```bash
base64 -w0 release.jks | gh secret set ANDROID_KEYSTORE_BASE64 --repo ashxtrem/ottlib
gh secret set ANDROID_KEYSTORE_PASSWORD --repo ashxtrem/ottlib
gh secret set ANDROID_KEY_ALIAS --repo ashxtrem/ottlib
gh secret set ANDROID_KEY_PASSWORD --repo ashxtrem/ottlib
```

For local signed builds, put the same values in `apps/android/keystore.properties` (see the Android section of the README).

## Try it without publishing

`node scripts/package-server.mjs --version 0.0.0-dev --variant full --out release` (after `npm run build`) produces the bundle for your own OS in `release/`.
