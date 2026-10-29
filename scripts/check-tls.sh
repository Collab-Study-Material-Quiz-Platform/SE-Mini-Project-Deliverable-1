#!/usr/bin/env bash
# =============================================================================
# check-tls.sh — verify the HTTPS/TLS setup for CSQ-SR-005
#
# Usage:
#   bash scripts/check-tls.sh [HTTP_PORT] [HTTPS_PORT]
#
#   Defaults: HTTP_PORT=8080, HTTPS_PORT=8443
#   Example:  bash scripts/check-tls.sh 8080 8443
#
# Prerequisites:
#   - curl (with HTTPS support)
#   - openssl s_client
#   - The Docker HTTPS stack must be running (docker compose -f
#     docker-compose.https.yml up) or a real server must be reachable.
#
# Exit code: 0 if all performed checks PASS, 1 if any FAIL.
# =============================================================================

set -euo pipefail

HOST="localhost"
HTTP_PORT="${1:-8080}"
HTTPS_PORT="${2:-8443}"

PASS=0
FAIL=1
SKIP=2

overall=0   # becomes 1 if any check FAILS

# Helper: print result line
result() {
    local label="$1"
    local code="$2"
    local detail="${3:-}"
    case "$code" in
        $PASS) echo "  PASS  $label${detail:+  ($detail)}" ;;
        $FAIL) echo "  FAIL  $label${detail:+  ($detail)}"; overall=1 ;;
        $SKIP) echo "  SKIP  $label${detail:+  ($detail)}" ;;
    esac
}

echo "============================================================"
echo " TLS verification — CSQ-SR-005"
echo " Host:  $HOST"
echo " HTTP:  port $HTTP_PORT   HTTPS: port $HTTPS_PORT"
echo "============================================================"
echo ""

# ── Check (a): HTTP 301 redirect to HTTPS ────────────────────────────────────
echo "[a] HTTP returns 301 redirect to an https:// URL"

http_response=$(curl --silent --max-time 5 \
    --output /dev/null \
    --write-out "%{http_code} %{redirect_url}" \
    "http://$HOST:$HTTP_PORT/" 2>/dev/null || true)

http_code=$(echo "$http_response" | awk '{print $1}')
redirect_url=$(echo "$http_response" | awk '{print $2}')

if [[ "$http_code" == "301" && "$redirect_url" == https://* ]]; then
    result "HTTP $HTTP_PORT → 301 → $redirect_url" $PASS
else
    result "HTTP $HTTP_PORT → expected 301 to https://, got: code=$http_code url=$redirect_url" $FAIL
fi
echo ""

# ── Check (b): HSTS header present ───────────────────────────────────────────
echo "[b] HSTS header present on HTTPS response"

hsts_header=$(curl --silent --max-time 5 \
    --insecure \
    --head \
    --write-out "%{http_code}" \
    --output /tmp/check_tls_headers.txt \
    "https://$HOST:$HTTPS_PORT/" 2>/dev/null || true)

if grep -qi "strict-transport-security" /tmp/check_tls_headers.txt 2>/dev/null; then
    hsts_value=$(grep -i "strict-transport-security" /tmp/check_tls_headers.txt | tr -d '\r')
    result "Strict-Transport-Security header found" $PASS "$hsts_value"
else
    result "Strict-Transport-Security header NOT found in response" $FAIL
fi
rm -f /tmp/check_tls_headers.txt
echo ""

# ── Check (c): TLS 1.2 succeeds ──────────────────────────────────────────────
echo "[c] TLS 1.2 connection succeeds"

tls12_out=$(echo "Q" | openssl s_client \
    -connect "$HOST:$HTTPS_PORT" \
    -tls1_2 \
    -brief 2>&1 || true)

if echo "$tls12_out" | grep -q "CONNECTION ESTABLISHED"; then
    result "TLS 1.2 handshake succeeded" $PASS
else
    result "TLS 1.2 handshake failed" $FAIL "$(echo "$tls12_out" | tail -2 | tr '\n' ' ')"
fi
echo ""

# ── Check (c cont.): TLS 1.3 succeeds ────────────────────────────────────────
echo "[c] TLS 1.3 connection succeeds"

# -tls1_3 requires openssl 1.1.1+; detect support first.
if openssl s_client -help 2>&1 | grep -q -- "-tls1_3"; then
    tls13_out=$(echo "Q" | openssl s_client \
        -connect "$HOST:$HTTPS_PORT" \
        -tls1_3 \
        -brief 2>&1 || true)

    if echo "$tls13_out" | grep -q "CONNECTION ESTABLISHED"; then
        result "TLS 1.3 handshake succeeded" $PASS
    else
        result "TLS 1.3 handshake failed" $FAIL "$(echo "$tls13_out" | tail -2 | tr '\n' ' ')"
    fi
else
    result "TLS 1.3 check" $SKIP "openssl on this machine does not support -tls1_3 flag"
fi
echo ""

# ── Check (d): TLS 1.1 is rejected ───────────────────────────────────────────
echo "[d] TLS 1.1 connection is rejected"

# -tls1_1 flag: present in openssl 1.0.x and 1.1.x but may be absent in
# openssl 3.x builds compiled without legacy provider or on systems where
# TLS 1.1 support has been removed from the client itself.
if openssl s_client -help 2>&1 | grep -q -- "-tls1_1"; then

    tls11_out=$(echo "Q" | openssl s_client \
        -connect "$HOST:$HTTPS_PORT" \
        -tls1_1 \
        -brief 2>&1 || true)

    if echo "$tls11_out" | grep -q "CONNECTION ESTABLISHED"; then
        # A successful TLS 1.1 connection means the server accepted it — FAIL.
        result "TLS 1.1 was accepted by the server (expected rejection)" $FAIL
    else
        # Connection failed/rejected — that's what we want.
        result "TLS 1.1 connection was rejected by the server" $PASS
    fi
else
    # The local openssl cannot even attempt TLS 1.1 (flag not compiled in or
    # removed in this distro's openssl 3.x build). We cannot meaningfully
    # test rejection, so we report SKIPPED rather than a false PASS.
    result "TLS 1.1 rejection check" $SKIP \
        "openssl on this machine does not support the -tls1_1 flag; test cannot be performed — verify rejection manually or on a machine with an older openssl"
fi
echo ""

# ── Summary ──────────────────────────────────────────────────────────────────
echo "============================================================"
if [[ "$overall" -eq 0 ]]; then
    echo " All performed checks PASSED."
else
    echo " One or more checks FAILED. See details above."
fi
echo "============================================================"

exit "$overall"
