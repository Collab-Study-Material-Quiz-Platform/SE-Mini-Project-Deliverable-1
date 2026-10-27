#!/usr/bin/env bash
set -eu

URL="${1:-http://localhost:5000/api/health}"
if curl --fail --silent --show-error --max-time 5 "$URL" >/dev/null; then
  printf '%s  UP    %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$URL"
else
  printf '%s  DOWN  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$URL" >&2
  exit 1
fi
