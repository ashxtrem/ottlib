#!/bin/sh
# Checks this OttLib folder: library folders, disk space, ffmpeg, TMDb key, backups, updates.
# Prints OK / WARN / FAIL per check; the exit code is 1 when any check fails.
cd "$(dirname "$0")" || exit 1

if [ -x runtime/node ]; then
  NODE="$PWD/runtime/node"
elif command -v node >/dev/null 2>&1; then
  NODE=node
else
  echo "Node.js 22 or later is required: https://nodejs.org" >&2; exit 1
fi

[ -x runtime/ffprobe ] && export FFPROBE_PATH="$PWD/runtime/ffprobe"
[ -x runtime/ffmpeg ] && export FFMPEG_PATH="$PWD/runtime/ffmpeg"

exec "$NODE" packages/server/dist/scripts/doctor.js
