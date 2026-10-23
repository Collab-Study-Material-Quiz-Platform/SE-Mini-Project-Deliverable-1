
## Availability (CSQ-NF-003)

- Target: at least 99% availability in any calendar month, excluding planned maintenance of up to 4 hours announced 24 hours in advance.
- Health check: `GET /health` returns `{"status":"OK", ...}` while the server is running.
- Check manually: `./scripts/check-health.sh` prints UP or DOWN.
- Production monitoring: point an uptime monitor (for example UptimeRobot) at the deployed `/health` URL once the app is deployed.
