#!/usr/bin/env bash
# =============================================================================
# generate-dev-cert.sh — create a self-signed certificate for localhost
#
# Usage:
#   bash deploy/generate-dev-cert.sh
#
# Output:
#   deploy/certs/localhost.key  — private key  (not committed; in .gitignore)
#   deploy/certs/localhost.crt  — certificate  (not committed; in .gitignore)
#
# Requirements: openssl (installed on macOS by default; on Linux: apt/brew)
#
# WARNING: this is for LOCAL DEVELOPMENT ONLY. Your browser will show a
# "Not secure" warning because the certificate is not issued by a trusted CA.
# For production use a real certificate (e.g. Let's Encrypt).
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="$SCRIPT_DIR/certs"

mkdir -p "$CERTS_DIR"

KEY="$CERTS_DIR/localhost.key"
CRT="$CERTS_DIR/localhost.crt"

echo "Generating self-signed certificate for localhost..."

openssl req \
  -x509 \
  -newkey rsa:2048 \
  -keyout "$KEY" \
  -out "$CRT" \
  -days 365 \
  -nodes \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo ""
echo "Done. Files written to:"
echo "  $KEY"
echo "  $CRT"
echo ""
echo "These files are excluded from git (deploy/certs/ is in .gitignore)."
echo "Run this script on each machine where you need the local HTTPS setup."
