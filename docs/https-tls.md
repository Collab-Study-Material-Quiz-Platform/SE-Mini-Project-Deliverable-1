# HTTPS / TLS setup — CSQ-SR-005

**Requirement**: All browser-to-server traffic shall use HTTPS with TLS 1.2 or higher.

**Design references**: SAD ADR-009, DS-Sec-05.

---

## Design summary

Nginx acts as the TLS-termination point. Node.js listens on `localhost:5000` only and is never exposed to the internet directly.

| Concern | Decision |
|---------|----------|
| TLS termination | Nginx (not Node) |
| Accepted protocols | TLS 1.2 and TLS 1.3 only (`ssl_protocols TLSv1.2 TLSv1.3`) |
| HTTP redirect | Port 80 → HTTPS 301 permanent |
| HSTS | `Strict-Transport-Security: max-age=31536000; includeSubDomains` on every HTTPS response |
| API routing | Nginx proxies `/api/` to `localhost:5000`; all other paths serve the React build |
| Certificate (dev) | Self-signed, generated locally by `deploy/generate-dev-cert.sh` |
| Certificate (prod) | Let's Encrypt (planned for deployment sprint) |

---

## Running locally with Docker

### 1. Generate the development certificate

```bash
bash deploy/generate-dev-cert.sh
```

This writes `deploy/certs/localhost.key` and `deploy/certs/localhost.crt`.
These files are in `.gitignore` and must be regenerated on each machine.

### 2. Build the React frontend

```bash
cd frontend
npm run build
cd ..
```

### 3. Start the Node backend

```bash
cd backend
node server.js   # listens on port 5000 by default
```

### 4. Start Nginx via Docker Compose

```bash
docker compose -f docker-compose.https.yml up
```

The app is now available at:

| URL | Behaviour |
|-----|-----------|
| `http://localhost:8080/` | 301 redirect to `https://localhost:8443/` |
| `https://localhost:8443/` | React SPA (browser will warn about self-signed cert) |
| `https://localhost:8443/api/health` | Proxied to Node backend |

Ports 8080 and 8443 are used instead of 80 and 443 so no administrator/root
privileges are required on the development machine.

---

## Running the TLS verification script

With the stack running, execute:

```bash
bash scripts/check-tls.sh
# or with explicit ports:
bash scripts/check-tls.sh 8080 8443
```

The script checks:

| Check | Tool |
|-------|------|
| (a) HTTP → 301 to https:// | curl |
| (b) HSTS header present | curl |
| (c) TLS 1.2 handshake succeeds | openssl s_client -tls1_2 |
| (c) TLS 1.3 handshake succeeds | openssl s_client -tls1_3 |
| (d) TLS 1.1 connection is rejected | openssl s_client -tls1_1 |

Each check prints **PASS**, **FAIL**, or **SKIPPED** (with reason). The script
exits non-zero if any check fails. It never prints PASS for a check it could
not actually perform.

Requirements: `curl` and `openssl` must be installed on the machine running
the script.

---

## Verification record

| Date | Check | Result | Notes |
|------|-------|--------|-------|
|      | (a) HTTP 301 redirect | | |
|      | (b) HSTS header | | |
|      | (c) TLS 1.2 succeeds | | |
|      | (c) TLS 1.3 succeeds | | |
|      | (d) TLS 1.1 rejected | | |

*Results to be filled in after running `scripts/check-tls.sh` against the
local Docker stack and, separately, against the deployed site.*

---

## Production notes

- Replace the self-signed certificate with a real one (e.g. Let's Encrypt /
  Certbot). Update the paths in `deploy/nginx/nginx.conf` where marked
  `PRODUCTION-CHANGE`.
- Change the Nginx listen ports from 8443 → 443 and 8080 → 80, and update the
  HTTP redirect accordingly.
- Submit the domain to the [HSTS preload list](https://hstspreload.org) once
  the deployment is stable.
- The full verification run on the deployed site is planned for the deployment
  sprint.
