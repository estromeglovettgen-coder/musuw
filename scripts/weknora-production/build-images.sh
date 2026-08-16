#!/usr/bin/env bash
# Build-only operation for a staged release. It intentionally does not run
# `up`, so it cannot change traffic or create a cutover by itself.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$script_dir/compose.sh" build --pull frontend app

docreader_image='wechatopenai/weknora-docreader@sha256:b9c4636b65b5d4947d5e09cd311ba6cf37f1f2da37c51d4be2b911d432f12abe'
if ! docker image inspect "$docreader_image" >/dev/null 2>&1; then
    "$script_dir/compose.sh" pull docreader
fi
