#!/bin/sh
# Starts OttLib from this folder. Config and data live next to it (config/, data/).
cd "$(dirname "$0")" || exit 1

# Downloaded archives are quarantined on macOS; clear it so the bundled binaries can run.
[ "$(uname)" = "Darwin" ] && xattr -dr com.apple.quarantine . 2>/dev/null

if [ -x runtime/node ]; then
  NODE="$PWD/runtime/node"
elif command -v node >/dev/null 2>&1; then
  NODE=node
  major=$(node -p 'process.versions.node.split(".")[0]')
  if [ "$major" -lt 22 ]; then echo "OttLib needs Node.js 22 or later (found $(node -v))." >&2; exit 1; fi
else
  echo "Node.js 22 or later is required: https://nodejs.org" >&2; exit 1
fi

[ -x runtime/ffprobe ] && export FFPROBE_PATH="$PWD/runtime/ffprobe"
if [ -z "$FFPROBE_PATH" ] && ! command -v ffprobe >/dev/null 2>&1; then
  echo "Note: ffprobe was not found, so media details (codecs, tracks) will be unavailable. Install FFmpeg to enable them." >&2
fi

mkdir -p data/logs
exec "$NODE" packages/server/dist/index.js
