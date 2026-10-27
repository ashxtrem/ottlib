---
name: release
description: Release OttLib on GitHub and refresh the local server. Pulls master into the root checkout, picks the next tag, runs the Release workflow (.github/workflows/release.yml), restarts the local server on the new code while it builds, then publishes the draft release once every build has passed. Use it when the user says "/release", "release and publish", "cut a release", "ship a new version", "publish on GitHub", or "pull master and restart the server".
argument-hint: "[vX.Y.Z | minor | major] [no-restart] [draft]"
---

# Release

Run everything from the root checkout (`E:\AI\lib`), which stays on `master`. Never push to `master`; the workflow
creates the tag itself once the builds pass. How the workflow works is in `docs/releasing.md`.

## Arguments
- A tag like `v0.3.0` releases under that tag. `minor` / `major` bump that part; with none, bump the patch of the latest release.
- `no-restart` skips the server restart. `draft` leaves the release as a draft instead of publishing it.

## Steps
1. **Pull master.** `git pull --ff-only origin master` then `git fetch --tags -q`. Local edits to tracked files are fine as
   long as the pull fast-forwards; if it doesn't, stop and tell the user which files block it.
2. **Pick the tag.** The latest release is `gh release list -L 1` (the workflow doesn't keep tags locally until fetched).
   List `git log --oneline <latest>..master`. If it's empty, there is nothing to release: say so and skip to step 4.
   A tag with a suffix (`v0.3.0-rc1`) ships as a pre-release.
3. **Start the build.** `gh workflow run release.yml -f tag=<tag> -f branch=master`, then take the run id from
   `gh run list --workflow=release.yml -L 1`. Watch it in the background (about 15–20 minutes):
   `gh run watch <id> --exit-status --interval 30 > /dev/null 2>&1; echo "exit=$?"` with `run_in_background`.
   Don't poll it yourself; you'll be notified when it ends.
4. **Restart the server** (unless `no-restart`), while the build runs. In PowerShell from the root:
   `npm install --no-audit --no-fund; & .\scripts\stop-server.ps1; Start-Process wscript.exe -ArgumentList "`"$PWD\scripts\start-server-hidden.vbs`""`.
   `npm start` rebuilds every package first, so give it up to two minutes: poll `http://localhost:<port>/` (port from
   `config/config.json`, default 8081) every 5 s until it answers 200, then check the tail of `data/logs/server-startup.log`
   for errors.
5. **Publish.** When the watch ends with `exit=0`, check the draft has its 13 assets (2 APKs, 10 server bundles, `SHA256SUMS`):
   `gh release view <tag> --json isDraft,assets --jq '{draft: .isDraft, assets: [.assets[].name]}'`.
   Then, unless `draft` was asked for: `gh release edit <tag> --draft=false` (add `--latest` unless it's a pre-release).
   If the run failed, don't publish: show the failing lines from `gh run view <id> --log-failed | tail -40` and stop.
6. **Report** in a few lines: the tag and release URL, the commits it ships, the server's state (port, up or the error),
   and anything skipped.
