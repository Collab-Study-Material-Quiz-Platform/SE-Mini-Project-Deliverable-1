# Collaborative Study Material & Quiz Platform

This prototype supports collaborative study resources and quizzes. The current increment includes registration, login and role-based access for Student and Contributor accounts, study material upload, search and download, a question bank of multiple-choice questions, a responsive Home page and a System Status page.

## Run locally

Prerequisites: Node.js/npm and a running MongoDB instance.

1. In `backend`, run `npm install`.
2. Configure `MONGO_URI` for local MongoDB (and optionally `UPLOAD_DIR`, the folder for uploaded files, default `backend/uploads`), then run `npm start`.
3. In another terminal, enter `frontend`, run `npm install`, then `npm run dev`.
4. Open the local Vite URL printed by the terminal.

Routes: Home (`#/`), Create account (`#/register`), Log in (`#/login`), Materials (`#/materials`), Upload material (`#/materials/upload`, Contributors), Question bank (`#/questions`, Contributors) and System Status (`#/status`). Vite proxies `/api` and `/health` requests to the local backend.

Run `npm test` in `backend` for the unit and API tests. Tests that need MongoDB run only when `MONGO_URI` is set.

## Study material (CSQ-F-010 to CSQ-F-012, CSQ-SR-004)

| Endpoint | Role | Purpose |
|---|---|---|
| `POST /api/materials` | Contributor | Upload one PDF, DOCX or PPTX file (multipart field `file`, max 20 MB) with `title` (≤ 100 characters), `subject` and `topic` |
| `GET /api/materials?q=&subject=&topic=&page=` | Any logged-in user | Search by keyword, subject or topic; 10 per page, newest first |
| `GET /api/materials/:id/download` | Any logged-in user | Download the file; the download count rises by 1 |

The real file type is checked from its content (PDF header, or the Word/PowerPoint parts inside the ZIP package) and must match the extension. Any other file is rejected with `Invalid file` and deleted.

## Question bank (CSQ-F-020 to CSQ-F-022)

| Endpoint | Role | Purpose |
|---|---|---|
| `POST /api/questions` | Contributor | Add a question: `text` (≤ 500 characters), four `options`, `correctIndex` (0–3), `topic`, `difficulty` (Easy, Medium or Hard) |
| `GET /api/questions?topic=&difficulty=&page=&limit=` | Contributor | List and filter the question bank (up to 50 per page) |
| `PUT /api/questions/:id` | Contributor (own) | Edit a question |
| `DELETE /api/questions/:id` | Contributor (own) | Delete a question; refused with `Question is in use` if it is part of a published quiz |

Changing another Contributor's question returns `Access denied` (HTTP 403).

## Search performance (CSQ-NF-001)

Run `npm run perf:search` in `backend` (MongoDB must be running) to load 10,000 materials and time 200 searches. See [the TC-Perf-01 report](docs/tc-perf-01-search-performance.md) for the method and recorded result.

## Availability (CSQ-NF-003)

The backend exposes `GET /api/health` and the `/health` alias. Health instrumentation is not proof of 99% monthly availability; deployment-level monitoring and maintenance records are still needed.

## Browser and responsive compatibility (CSQ-NF-005)

The target is the latest two versions of Chrome, Firefox, Edge and Safari at viewport widths from 360 px to 1920 px. See [the compatibility test report](docs/compatibility-test-report.md). Full acceptance requires recording actual results across the documented matrix.
