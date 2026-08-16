#!/usr/bin/env bash
# Exercise the image-only helper at its Docker/Compose boundary. The test never
# opens a network connection or starts a container.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
call_log="$tmp_dir/calls.log"

cp "$script_dir/build-images.sh" "$tmp_dir/build-images.sh"
cat > "$tmp_dir/compose.sh" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "compose:$*" >> "$WEKNORA_TEST_CALL_LOG"
EOF
cat > "$tmp_dir/docker" <<'EOF'
#!/usr/bin/env bash
if [ "$1" = image ] && [ "$2" = inspect ]; then
    [ "${SIM_DOCREADER_PRESENT:-0}" = 1 ] && exit 0
    exit 1
fi
printf '%s\n' "unexpected docker call: $*" >&2
exit 1
EOF
chmod +x "$tmp_dir/build-images.sh" "$tmp_dir/compose.sh" "$tmp_dir/docker"

run_build() {
    WEKNORA_TEST_CALL_LOG="$call_log" PATH="$tmp_dir:$PATH" "$tmp_dir/build-images.sh"
}

: > "$call_log"
SIM_DOCREADER_PRESENT=1 run_build
grep -Fx 'compose:build --pull frontend app' "$call_log" >/dev/null
if grep -Fx 'compose:pull docreader' "$call_log" >/dev/null; then
    printf '%s\n' 'present DocReader image was pulled again' >&2
    exit 1
fi

: > "$call_log"
SIM_DOCREADER_PRESENT=0 run_build
grep -Fx 'compose:build --pull frontend app' "$call_log" >/dev/null
grep -Fx 'compose:pull docreader' "$call_log" >/dev/null

printf '%s\n' 'build-images reuse test green: existing DocReader is not pulled; missing image is pulled'
