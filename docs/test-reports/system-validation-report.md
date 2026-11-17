# System Validation Report

**Project:** Collaborative Study Material & Quiz Platform (Project #21)  
**Generated:** 2026-11-17 16:40 UTC by `node scripts/generate-test-reports.mjs`  
**Code version:** commit `299cd4b` on branch `test/part-3-test-reports`  
**Environment:** Windows_NT 10.0.26200 (Intel(R) Core(TM) Ultra 5 125H, 15 GB RAM); Node.js v24.4.1; MongoDB 7.0.14

This report records the execution of every test case in the Test Case Document (TC-Auth-01 to TC-Sec-07) against the integrated system: the React client, the Express API and MongoDB, driven through real browsers by Playwright (Test Plan level 3, system testing, and level 4, acceptance). Each test case also lists the unit and API tests that support it ([Unit Test Report](unit-test-report.md)).

## Summary

| Result | Test cases |
| --- | --- |
| ✅ Pass | 26 |
| ❌ Fail | 1 |
| 🟡 Partial | 5 |
| 📝 Manual (recorded) | 1 |

**33 test cases executed or dispositioned.** Browser runs: 27/27 system tests passed in Chromium; 18/18 compatibility runs passed across 9 browser/width combinations.

**Exit criteria (Test Plan section 5):**

- All High-priority functional requirements verified: yes.
- No High-priority NFR failed: yes.
- TC-Sec-01 to TC-Sec-07 pass with no open critical defect: no — TC-Sec-05 (see defects).

## Test environment

| Item | Value |
| --- | --- |
| Machine | Windows_NT 10.0.26200 (Intel(R) Core(TM) Ultra 5 125H, 15 GB RAM) |
| Runtime | Node.js v24.4.1, MongoDB 7.0.14 |
| Browsers (Playwright) | chromium 159.0.8154.6, firefox 159.0, webkit 27.2 |
| Viewports | System tests 1280 × 800; compatibility 360 × 740, 768 × 1024, 1920 × 1080 |
| Test data | Accounts, materials, questions and quizzes created by each test through the UI or REST API in the `studyplatform_e2e` database; one Admin account seeded by the test setup |

## Results by test case

| Test case | Requirement | Title | Browser tests | Supporting unit/API tests | Result |
| --- | --- | --- | --- | --- | --- |
| TC-Auth-01 | CSQ-F-001 | Registration | 1/1 passed | 29/29 passed | ✅ Pass |
| TC-Auth-02 | CSQ-F-002 | Login | 1/1 passed | 19/19 passed | ✅ Pass |
| TC-Auth-03 | CSQ-F-003 | Role-based access | 1/1 passed | 24/24 passed | ✅ Pass |
| TC-Auth-04 | CSQ-F-004 | Logout | 1/1 passed | 38/38 passed | ✅ Pass |
| TC-Auth-05 | CSQ-F-005 | Password validation | 2/2 passed | 21/21 passed | ✅ Pass |
| TC-Mat-01 | CSQ-F-010 | Upload study material | 1/1 passed | 24/24 passed | ✅ Pass |
| TC-Mat-02 | CSQ-F-011 | Search material | 1/1 passed | 27/27 passed | ✅ Pass |
| TC-Mat-03 | CSQ-F-012 | Download material | 1/1 passed | 19/19 passed | ✅ Pass |
| TC-QB-01 | CSQ-F-020 | Add question | 1/1 passed | 27/27 passed | ✅ Pass |
| TC-QB-02 | CSQ-F-021 | Edit/delete own question | 1/1 passed | 20/20 passed | ✅ Pass |
| TC-QB-03 | CSQ-F-022 | Tag/filter questions | 1/1 passed | 18/18 passed | ✅ Pass |
| TC-Quiz-01 | CSQ-F-030 | Create and publish quiz | 1/1 passed | 9/9 passed | ✅ Pass |
| TC-Quiz-02 | CSQ-F-031 | Timed quiz attempt and auto-submit | 1/1 passed | 16/16 passed | ✅ Pass |
| TC-Quiz-03 | CSQ-F-032 | Automatic grading/result | 1/1 passed | 35/35 passed | ✅ Pass |
| TC-Quiz-04 | CSQ-F-033 | Published quiz listing | 1/1 passed | 20/20 passed | ✅ Pass |
| TC-Quiz-05 | CSQ-F-034 | Delete own quiz | 1/1 passed | 8/8 passed | 🟡 Partial |
| TC-Rep-01 | CSQ-F-040 | Student performance page | 1/1 passed | 19/19 passed | ✅ Pass |
| TC-Rep-02 | CSQ-F-041 | Contributor quiz statistics | 1/1 passed | 16/16 passed | ✅ Pass |
| TC-Adm-01 | CSQ-F-050 | Admin moderation | 1/1 passed | 22/22 passed | 🟡 Partial |
| TC-Perf-01 | CSQ-NF-001 | Material search performance | — | 3/3 passed | ✅ Pass |
| TC-Perf-02 | CSQ-NF-002 | Concurrent quiz-result performance | — | 3/3 passed | ✅ Pass |
| TC-Perf-03 | CSQ-NF-006 | Page-load performance | 1/1 passed | — | ✅ Pass |
| TC-Ops-01 | CSQ-NF-003 | Availability | — | 26/26 passed | 🟡 Partial |
| TC-Ops-02 | CSQ-NF-007 | Backup and restore | — | — | 🟡 Partial |
| TC-UX-01 | CSQ-NF-004 | First-time usability | — | — | 📝 Manual (recorded) |
| TC-Comp-01 | CSQ-NF-005 | Browser and responsive compatibility | 18/18 passed | — | 🟡 Partial |
| TC-Sec-01 | CSQ-SR-001 | Password storage/logging | 1/1 passed | 8/8 passed | ✅ Pass |
| TC-Sec-02 | CSQ-SR-002 | Role check on protected requests | 1/1 passed | 13/13 passed | ✅ Pass |
| TC-Sec-03 | CSQ-SR-003 | Invalid/expired/revoked JWT | 1/1 passed | 16/16 passed | ✅ Pass |
| TC-Sec-04 | CSQ-SR-004 | File type and size validation | 1/1 passed | 30/30 passed | ✅ Pass |
| TC-Sec-05 | CSQ-SR-005 | HTTPS/TLS validation | — | — | ❌ Fail |
| TC-Sec-06 | CSQ-SR-006 | Audit logging | 1/1 passed | 6/6 passed | ✅ Pass |
| TC-Sec-07 | CSQ-SR-007 | Server-side injection/script validation | 1/1 passed | 3/3 passed | ✅ Pass |

## Test case details

### TC-Auth-01 — Registration (CSQ-F-001): ✅ Pass

- ✅ Browser: TC-Auth-01: a visitor registers as Student or Contributor within 3 s; a reused email is refused (2.8 s)
- Supporting tests: 29/29 passed in `backend/tests/registration.integration.test.js`, `backend/tests/registrationValidation.test.js`, `frontend/src/auth.test.jsx`.

### TC-Auth-02 — Login (CSQ-F-002): ✅ Pass

- ✅ Browser: TC-Auth-02: correct credentials open the home page for the role; wrong ones show the error and create no session (2.4 s)
- Supporting tests: 19/19 passed in `backend/tests/registration.integration.test.js`, `frontend/src/auth.test.jsx`.

### TC-Auth-03 — Role-based access (CSQ-F-003): ✅ Pass

- ✅ Browser: TC-Auth-03: each role sees only its permitted features, and forbidden requests get 403 "Access denied" (1.8 s)
- Supporting tests: 24/24 passed in `backend/tests/authorization.test.js`, `frontend/src/shell.test.jsx`.

### TC-Auth-04 — Logout (CSQ-F-004): ✅ Pass

- ✅ Browser: TC-Auth-04: logout ends the session; protected pages show the login page and the old token is refused (1.7 s)
- Supporting tests: 38/38 passed in `backend/tests/logout.test.js`, `backend/tests/session.integration.test.js`, `frontend/src/api.test.js`, `frontend/src/shell.test.jsx`.

### TC-Auth-05 — Password validation (CSQ-F-005): ✅ Pass

- ✅ Browser: TC-Auth-05: "abc12" and "abcdefgh" are rejected with "Password too weak"; "abcdef12" is accepted (1.5 s)
- ✅ Browser: TC-Auth-05: the server also rejects a weak password sent directly to the API (0.1 s)
- Supporting tests: 21/21 passed in `backend/tests/registrationValidation.test.js`, `frontend/src/auth.test.jsx`.

### TC-Mat-01 — Upload study material (CSQ-F-010): ✅ Pass

- ✅ Browser: TC-Mat-01: a contributor uploads a 20 MB PDF, it is confirmed within 10 s and appears in search (3.1 s)
- Supporting tests: 24/24 passed in `backend/tests/materialUpload.integration.test.js`, `frontend/src/components/materials.test.jsx`.

### TC-Mat-02 — Search material (CSQ-F-011): ✅ Pass

- ✅ Browser: TC-Mat-02: search lists matching materials 10 per page, newest first, and "No materials found" for no match (3.0 s)
- Supporting tests: 27/27 passed in `backend/tests/materialSearch.integration.test.js`, `backend/tests/materialValidation.test.js`, `frontend/src/components/materials.test.jsx`.

### TC-Mat-03 — Download material (CSQ-F-012): ✅ Pass

- ✅ Browser: TC-Mat-03: a download matches the stored file size and adds exactly 1 to the count each time (3.4 s)
- Supporting tests: 19/19 passed in `backend/tests/materialDownload.integration.test.js`, `frontend/src/components/materials.test.jsx`.

### TC-QB-01 — Add question (CSQ-F-020): ✅ Pass

- ✅ Browser: TC-QB-01: a 500-character question with 4 options and 1 correct answer is saved; 3 options or 2 correct are rejected (2.3 s)
- Supporting tests: 27/27 passed in `backend/tests/questionBank.integration.test.js`, `backend/tests/questionValidation.test.js`, `frontend/src/components/questionBank.test.jsx`.

### TC-QB-02 — Edit/delete own question (CSQ-F-021): ✅ Pass

- ✅ Browser: TC-QB-02: own questions can be edited and deleted; another contributor gets "Access denied"; a question in a published quiz is "in use" (3.5 s)
- Supporting tests: 20/20 passed in `backend/tests/questionOwnership.integration.test.js`, `frontend/src/components/questionBank.test.jsx`.

### TC-QB-03 — Tag/filter questions (CSQ-F-022): ✅ Pass

- ✅ Browser: TC-QB-03: a question needs a topic and difficulty, and filtering by Algebra and Easy returns only matching questions (2.8 s)
- Supporting tests: 18/18 passed in `backend/tests/questionFilter.integration.test.js`, `frontend/src/components/questionBank.test.jsx`.

### TC-Quiz-01 — Create and publish quiz (CSQ-F-030): ✅ Pass

- ✅ Browser: TC-Quiz-01: quizzes with 5-50 questions and 5-180 minutes are accepted; 4/51 questions and 4/181 minutes are rejected (1.6 s)
- Supporting tests: 9/9 passed in `backend/tests/quizCreate.integration.test.js`, `backend/tests/quizValidation.test.js`.

### TC-Quiz-02 — Timed quiz attempt and auto-submit (CSQ-F-031): ✅ Pass

- ✅ Browser: TC-Quiz-02: the countdown stays within 1 s of server time and answers are submitted automatically at 00:00 (7.8 s)
- Supporting tests: 16/16 passed in `frontend/src/components/quizzes.test.jsx`.

### TC-Quiz-03 — Automatic grading/result (CSQ-F-032): ✅ Pass

- ✅ Browser: TC-Quiz-03: 7 correct, 2 wrong and 1 unanswered show 7/10, 70% and every correct answer within 3 s (4.2 s)
- Supporting tests: 35/35 passed in `backend/tests/quizGrading.integration.test.js`, `backend/tests/quizGrading.test.js`, `frontend/src/components/quizzes.test.jsx`.

### TC-Quiz-04 — Published quiz listing (CSQ-F-033): ✅ Pass

- ✅ Browser: TC-Quiz-04: a student sees every published quiz with its title, number of questions and time limit (2.1 s)
- Supporting tests: 20/20 passed in `backend/tests/quizList.integration.test.js`, `frontend/src/components/quizzes.test.jsx`.

### TC-Quiz-05 — Delete own quiz (CSQ-F-034): 🟡 Partial

- ✅ Browser: TC-Quiz-05: a contributor deletes their own quiz, students no longer see it, and another contributor gets "Access denied" (2.4 s)
- Supporting tests: 8/8 passed in `backend/tests/quizDelete.integration.test.js`.
- Open defect: D-07.

### TC-Rep-01 — Student performance page (CSQ-F-040): ✅ Pass

- ✅ Browser: TC-Rep-01: a student sees an overall average, topic scores and attempts that match a manual calculation (2.7 s)
- Supporting tests: 19/19 passed in `backend/tests/studentPerformance.integration.test.js`, `frontend/src/components/reportsAdmin.test.jsx`.

### TC-Rep-02 — Contributor quiz statistics (CSQ-F-041): ✅ Pass

- ✅ Browser: TC-Rep-02: a contributor sees attempts, average, highest, lowest and the 3 hardest questions for own quizzes only (5.0 s)
- Supporting tests: 16/16 passed in `backend/tests/contributorPerformance.integration.test.js`, `frontend/src/components/reportsAdmin.test.jsx`.

### TC-Adm-01 — Admin moderation (CSQ-F-050): 🟡 Partial

- ✅ Browser: TC-Adm-01: an admin removes a material and a quiz; students no longer find either (3.3 s)
- Supporting tests: 22/22 passed in `backend/tests/adminModeration.integration.test.js`, `frontend/src/components/reportsAdmin.test.jsx`.
- Open defect: D-04.

### TC-Perf-01 — Material search performance (CSQ-NF-001): ✅ Pass

- Supporting tests: 3/3 passed in `backend/tests/searchPerformance.integration.test.js`.
- Load script (`npm run perf:search`): 200 searches over 10000 materials, p50 62.4 ms, **p95 83.2 ms**, max 92.2 ms, 100% within 2 s, 0 failed requests.
- Team report: [tc-perf-01-search-performance.md](../tc-perf-01-search-performance.md).

### TC-Perf-02 — Concurrent quiz-result performance (CSQ-NF-002): ✅ Pass

- Supporting tests: 3/3 passed in `backend/tests/quizSubmitPerformance.integration.test.js`.
- Load script (`npm run perf:quiz-submit`): 100 simultaneous submissions, p50 848.7 ms, **p95 911.4 ms**, max 919.9 ms, 100% within 3 s, 0 failed requests.
- Team report: [tc-perf-02-quiz-result-performance.md](../tc-perf-02-quiz-result-performance.md).

### TC-Perf-03 — Page-load performance (CSQ-NF-006): ✅ Pass

- ✅ Browser: TC-Perf-03: main pages load within 3 s for at least 95% of loads at 10 Mbps (63.4 s)
- Real browser loads of the production build at 10 Mbps: 90 loads, 100% within 3 s, p95 428 ms.
- Team report: [tc-perf-03-page-load-performance.md](../tc-perf-03-page-load-performance.md).

### TC-Ops-01 — Availability (CSQ-NF-003): 🟡 Partial

- Supporting tests: 26/26 passed in `backend/tests/health.test.js`, `backend/tests/serverStartup.test.js`, `frontend/src/shell.test.jsx`.
- The health endpoint, its database check and the status pages are verified. The 99% monthly figure needs a month of uptime monitoring on the deployed server, which a test run cannot produce.
- Team report: [availability.md](../availability.md).

### TC-Ops-02 — Backup and restore (CSQ-NF-007): 🟡 Partial

- Backup/restore drill: retention kept exactly 7 backups; restore of the latest backup took 1021 ms and restored every collection ([log](raw/tc-ops-02-backup-drill.log)).
- Open defects: D-02, D-03.

### TC-UX-01 — First-time usability (CSQ-NF-004): 📝 Manual (recorded)

- User trial with 10 first-time participants, recorded by the team in November 2026: 10 of 10 completed all tasks within 10 minutes without help. A usability trial with people cannot be automated; the browser tests cover the same task script. See [tc-ux-01-usability-acceptance.md](../tc-ux-01-usability-acceptance.md).

### TC-Comp-01 — Browser and responsive compatibility (CSQ-NF-005): 🟡 Partial

- Compatibility matrix below: 18/18 runs passed.
- Each browser engine is tested at one version (the one bundled with Playwright). Edge is covered by the Chromium engine and Safari by WebKit; the "latest two versions" condition and real Safari/Edge builds still need the manual checks in the compatibility report.
- Team report: [compatibility-test-report.md](../compatibility-test-report.md).

### TC-Sec-01 — Password storage/logging (CSQ-SR-001): ✅ Pass

- ✅ Browser: TC-Sec-01: passwords are stored only as bcrypt hashes with cost >= 10 and never returned (1.6 s)
- Supporting tests: 8/8 passed in `backend/tests/registration.integration.test.js`.

### TC-Sec-02 — Role check on protected requests (CSQ-SR-002): ✅ Pass

- ✅ Browser: TC-Sec-02: a Student token on Contributor-only and Admin-only requests gets 403 "Access denied" (0.8 s)
- Supporting tests: 13/13 passed in `backend/tests/adminModeration.integration.test.js`, `backend/tests/authorization.test.js`.

### TC-Sec-03 — Invalid/expired/revoked JWT (CSQ-SR-003): ✅ Pass

- ✅ Browser: TC-Sec-03: missing, altered, 31-minute-old and revoked tokens all get 401 (0.9 s)
- Supporting tests: 16/16 passed in `backend/tests/logout.test.js`, `backend/tests/session.integration.test.js`, `frontend/src/api.test.js`.

### TC-Sec-04 — File type and size validation (CSQ-SR-004): ✅ Pass

- ✅ Browser: TC-Sec-04: a 21 MB PDF and an executable renamed to .pdf are rejected with "Invalid file" (2.2 s)
- Supporting tests: 30/30 passed in `backend/tests/fileValidation.test.js`, `backend/tests/materialUpload.integration.test.js`, `frontend/src/components/materials.test.jsx`.

### TC-Sec-05 — HTTPS/TLS validation (CSQ-SR-005): ❌ Fail

- Nginx checks with scripts/check-tls.sh: HTTP → 301 to HTTPS, HSTS present, TLS 1.2 and 1.3 accepted, TLS 1.1 rejected. Client API requests over plain HTTP: `POST http://localhost:5000/api/auth/login`, `GET http://localhost:5000/api/materials?page=1` ([log](raw/tc-sec-05-tls-check.log)).
- Team report: [https-tls.md](../https-tls.md).
- Open defect: D-01.

### TC-Sec-06 — Audit logging (CSQ-SR-006): ✅ Pass

- ✅ Browser: TC-Sec-06: login success and failure, upload and deletion each write one audit entry with user, action and time (0.8 s)
- Supporting tests: 6/6 passed in `backend/tests/auditLog.test.js`.

### TC-Sec-07 — Server-side injection/script validation (CSQ-SR-007): ✅ Pass

- ✅ Browser: TC-Sec-07: script and database-command input is rejected with 400 and not stored (0.4 s)
- Supporting tests: 3/3 passed in `backend/tests/inputValidation.test.js`.

## Compatibility matrix (TC-Comp-01)

Each cell is the core workflows (student: log in, search and download material, take a timed quiz; contributor: upload form and question bank) with a check that the page never scrolls sideways.

| Engine (stands in for) | mobile 360 px | tablet 768 px | desktop 1920 px |
| --- | --- | --- | --- |
| chromium 159.0.8154.6 (Chrome, Edge) | ✅ 2/2 | ✅ 2/2 | ✅ 2/2 |
| firefox 159.0 (Firefox) | ✅ 2/2 | ✅ 2/2 | ✅ 2/2 |
| webkit 27.2 (Safari) | ✅ 2/2 | ✅ 2/2 | ✅ 2/2 |

## Page-load measurements (TC-Perf-03)

Production build in Chromium, 10 Mbps down and up, 20 ms latency, cache disabled; time from navigation until the page's content and API data are shown.

| Page | Route | Loads | Mean | p50 | p95 | Max |
| --- | --- | --- | --- | --- | --- | --- |
| Home | `#/` | 10 | 372 ms | 367 ms | 416 ms | 416 ms |
| Create account | `#/register` | 10 | 352 ms | 349 ms | 368 ms | 368 ms |
| Log in | `#/login` | 10 | 321 ms | 316 ms | 334 ms | 334 ms |
| Materials | `#/materials` | 10 | 384 ms | 376 ms | 409 ms | 409 ms |
| Upload material | `#/materials/upload` | 10 | 333 ms | 333 ms | 364 ms | 364 ms |
| Question bank | `#/questions` | 10 | 399 ms | 401 ms | 443 ms | 443 ms |
| Published quizzes | `#/quizzes` | 10 | 336 ms | 333 ms | 370 ms | 370 ms |
| Performance | `#/performance` | 10 | 341 ms | 333 ms | 388 ms | 388 ms |
| System status | `#/status` | 10 | 417 ms | 406 ms | 501 ms | 501 ms |

Across all 90 loads: **p95 428 ms, 100% within 3 s** (target: 95% within 3 s). The team's model-based measurement is in [tc-perf-03-page-load-performance.md](../tc-perf-03-page-load-performance.md) and was re-run here ([log](raw/tc-perf-03-page-load-model.log)).

## Defects

| ID | Severity | Status | Test cases | Defect |
| --- | --- | --- | --- | --- |
| D-01 | High | Open | TC-Sec-05 | The client sends API requests, including the login password, over plain HTTP when the site is served over HTTPS |
| D-02 | Medium | Open | TC-Ops-02 | scripts/backup.sh reports "Backup done" even when mongodump fails |
| D-03 | Medium | Open | TC-Ops-02 | Nothing schedules the backup every 24 hours |
| D-04 | Medium | Open | TC-Adm-01 | The Admin page lists only the 10 newest materials |
| D-07 | Medium | Open | TC-Quiz-05 | A deleted (removed) quiz can be published again and reappears for students |
| D-05 | High | Fixed in Sprint 2 (PR #62) | TC-Quiz-02, TC-Quiz-03 | Every quiz submission failed with HTTP 500 |
| D-06 | Low | Fixed in Sprint 1 (PR #45) | TC-Mat-01 | Uploaded file names with non-ASCII characters were stored garbled |

**D-01 — The client sends API requests, including the login password, over plain HTTP when the site is served over HTTPS.** The React client defaults `VITE_API_URL` to `http://localhost:5000` (frontend/src/api.js, LoginPage.jsx, RegistrationPage.jsx, Layout.jsx). With the HTTPS stack running, the page at https://localhost:8443 sent `POST http://localhost:5000/api/auth/login` and `GET http://localhost:5000/api/materials` directly to Node, bypassing Nginx and TLS. Setting `VITE_API_URL` to an empty string does not help because the code uses `||`. *Fix:* Default the API base URL to the page origin (an empty string, using `??` instead of `||`) so the client calls `/api/...` on the same HTTPS origin, which Nginx already proxies; the Vite dev proxy keeps local development working.

**D-02 — scripts/backup.sh reports "Backup done" even when mongodump fails.** With mongodump missing from PATH the script printed "Backup done: backup_<time>.gz" and exited 0 although no file was written, so a failing nightly backup would look successful. *Fix:* Add `set -euo pipefail` to scripts/backup.sh and scripts/restore.sh.

**D-03 — Nothing schedules the backup every 24 hours.** CSQ-NF-007 requires an automatic backup every 24 hours. The repository has the backup script but no cron entry, scheduled task or deployment configuration that runs it. *Fix:* Add a cron entry (for example `0 2 * * * /path/to/scripts/backup.sh`) to the deployment documentation or configuration.

**D-04 — The Admin page lists only the 10 newest materials.** AdminPage loads `GET /api/materials`, the search endpoint, which returns 10 materials per page, and the page has no paging. An admin cannot reach older materials from the moderation page. *Fix:* Add paging (or search) to the Admin page.

**D-07 — A deleted (removed) quiz can be published again and reappears for students.** `POST /api/quizzes/:id/publish` sets the status to `published` without checking the current status, so the creator can undo a soft delete, including an Admin removal under CSQ-F-050. Recorded as the to-do test "a removed quiz cannot be published again" in backend/tests/quizCreate.integration.test.js (expected 404, got 200). *Fix:* Return 404 "Quiz not found" from the publish route when the quiz status is `removed`, then remove the `todo` option from the test.

**D-05 — Every quiz submission failed with HTTP 500.** The submit route used an update pipeline, which Mongoose 9 rejects unless `updatePipeline: true` is set. Found by the grading tests written for CSQ-F-032. *Fix:* Set `updatePipeline: true`. Covered by tests/quizGrading.integration.test.js.

**D-06 — Uploaded file names with non-ASCII characters were stored garbled.** Multer decoded file names as latin1, so "résumé.pdf" was stored as "rÃ©sumÃ©.pdf". *Fix:* Set `defParamCharset: "utf8"`. Covered by tests/materialUpload.integration.test.js.

## Deviations from the SRS/SAD

| Reference | Deviation |
| --- | --- |
| CSQ-F-030 / SRS 3.1 | There is no Quiz Builder page. Contributors create and publish quizzes through the REST API (`POST /api/quizzes`, `POST /api/quizzes/:id/publish`), so TC-Quiz-01 is validated through the API. |
| CSQ-F-034 | There is no contributor "delete quiz" button in the client; the route `DELETE /api/quizzes/:id` exists and TC-Quiz-05 is validated through it. Deletion is a soft delete (status `removed`) so past attempts and reports stay consistent. |
| SAD 4.3 API | Quiz attempt routes are under `/api/quizzes/attempts/:id/...` instead of `/api/attempts/:id/...`, students list quizzes with `GET /api/quizzes/published` instead of `GET /api/quizzes`, and admins use `GET /api/quizzes/all`. |
| SAD 4.3.1 error format | Errors are returned as `{ "message": "..." }` rather than `{ "error": { "code", "message", "details" } }`. The messages are the exact SRS texts. |
| SRS 3.1 Material Details page | Material details (title, subject, topic, size, date, download count) are shown in the search results instead of on a separate page. |
| Test Plan 6 tools | Tests use the Node.js test runner with c8 (backend), Vitest with React Testing Library (frontend) and Playwright (system and load tests) instead of Jest, Supertest and k6/Artillery. They cover the same levels and test cases. |

## Observations

- TC-Sec-07: a MongoDB operator in the query string (`?subject[$ne]=x`) is not rejected with 400, but Express 5 passes it to the search as a plain parameter named `subject[$ne]`, which is ignored, so it never reaches the database. Operators in JSON bodies and script or SQL-style text are rejected with 400.
- TC-Perf-01 and TC-Perf-02 are run with one test file at a time. When the backend suite runs all files in parallel on a busy machine, the 100-submission load test can miss its 3 s target because the other test files compete for the same CPU.

## Re-running

```bash
node scripts/generate-test-reports.mjs --with-backup-drill --with-tls
```

Browser test report: [html/e2e-report/index.html](html/e2e-report/index.html). Commands and exit codes of this run: Backend unit and integration tests (exit 0, 67.9 s, [log](raw/logs/backend-unit-and-integration-tests.log)); Frontend unit tests (exit 0, 17.9 s, [log](raw/logs/frontend-unit-tests.log)); System validation browser tests (exit 0, 280.1 s, [log](raw/logs/system-validation-browser-tests.log)); TC-Perf-01 load script (exit 0, 5.9 s, [log](raw/logs/tc-perf-01-load-script.log)); TC-Perf-02 load script (exit 0, 3.2 s, [log](raw/logs/tc-perf-02-load-script.log)); Frontend production build (exit 0, 1.6 s, [log](raw/logs/frontend-production-build.log)); TC-Perf-03 page-load model (exit 0, 0.2 s, [log](raw/logs/tc-perf-03-page-load-model.log)); Build frontend for HTTPS check (exit 0, 1.5 s, [log](raw/logs/build-frontend-for-https-check.log)); Start Nginx HTTPS stack (exit 0, 1.7 s, [log](raw/logs/start-nginx-https-stack.log)); TC-Sec-05 check-tls (exit 0, 4.4 s, [log](raw/logs/tc-sec-05-check-tls.log)); TC-Sec-05 client API URLs (exit 0, 4.5 s, [log](raw/logs/tc-sec-05-client-api-urls.log)); Stop Nginx HTTPS stack (exit 0, 1.5 s, [log](raw/logs/stop-nginx-https-stack.log)).
