# Collaborative Study Material & Quiz Platform

This prototype supports collaborative study resources and quizzes. The current increment includes public registration for Student and Contributor accounts, a responsive Home page and a System Status page.

## Run locally

Prerequisites: Node.js/npm and a running MongoDB instance.

1. In `backend`, run `npm install`.
2. Configure `MONGO_URI` for local MongoDB, then run `npm start`.
3. In another terminal, enter `frontend`, run `npm install`, then `npm run dev`.
4. Open the local Vite URL printed by the terminal.

Routes: Home (`#/`), Create account (`#/register`) and System Status (`#/status`). Vite proxies `/api` and `/health` requests to the local backend.

## Search performance (CSQ-NF-001)

Run `npm run perf:search` in `backend` (MongoDB must be running) to load 10,000 materials and time 200 searches. See [the TC-Perf-01 report](docs/tc-perf-01-search-performance.md) for the method and recorded result.

## Availability (CSQ-NF-003)

The backend exposes `GET /api/health` and the `/health` alias. Health instrumentation is not proof of 99% monthly availability; deployment-level monitoring and maintenance records are still needed.

## Browser and responsive compatibility (CSQ-NF-005)

The target is the latest two versions of Chrome, Firefox, Edge and Safari at viewport widths from 360 px to 1920 px. See [the compatibility test report](docs/compatibility-test-report.md). Full acceptance requires recording actual results across the documented matrix.
