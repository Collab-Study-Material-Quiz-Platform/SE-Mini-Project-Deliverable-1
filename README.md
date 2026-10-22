
## Availability (CSQ-NF-003)

- Target: at least 99% availability in any calendar month, excluding planned maintenance of up to 4 hours announced 24 hours in advance.
- Health check: `GET /health` returns `{"status":"OK", ...}` while the server is running.
- Check manually: `./scripts/check-health.sh` prints UP or DOWN.
- Production monitoring: point an uptime monitor (for example UptimeRobot) at the deployed `/health` URL once the app is deployed.

## Browser and responsive compatibility (CSQ-NF-005)

The frontend is designed to work on the latest 2 versions of Chrome, Firefox, Edge and Safari at viewport widths from 360 px to 1920 px.

Manual testing checklist and results are in [`docs/compatibility-test-report.md`](docs/compatibility-test-report.md).

To verify responsiveness yourself: open the app in each browser, open DevTools (F12), enable the device toolbar (Ctrl+Shift+M / Cmd+Shift+M), and set the width to 360, 768 and 1920 px in turn.
