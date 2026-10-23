#!/bin/bash
URL="${1:-http://localhost:5000/health}"
if curl -fsS --max-time 5 "$URL" > /dev/null; then
  echo "$(date '+%Y-%m-%d %H:%M:%S')  UP    $URL"
else
  echo "$(date '+%Y-%m-%d %H:%M:%S')  DOWN  $URL"
  exit 1
fi
