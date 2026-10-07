#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${BB_DATA_DIR:?Set BB_DATA_DIR to a private state directory}"
: "${BB_CLOUDFLARED:=cloudflared}"
: "${PORT:=8081}"
mkdir -p "$BB_DATA_DIR"
rm -f "$BB_DATA_DIR/public-url"
# Ignore unrelated named-tunnel configuration in ~/.cloudflared/config.yml.
"$BB_CLOUDFLARED" tunnel --config /dev/null --no-autoupdate --url "http://127.0.0.1:$PORT" 2>&1 |
  while IFS= read -r line; do
    printf '%s\n' "$line"
    if [[ "$line" =~ (https://[a-z0-9-]+\.trycloudflare\.com) ]]; then
      printf '%s\n' "${BASH_REMATCH[1]}" > "$BB_DATA_DIR/public-url"
    fi
  done
