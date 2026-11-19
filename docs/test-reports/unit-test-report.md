# Unit Test Report

**Project:** Collaborative Study Material & Quiz Platform (Project #21)  
**Generated:** 2026-11-19 02:54 UTC by `node scripts/generate-test-reports.mjs`  
**Code version:** commit `20f2942` on branch `fix/d-01-same-origin-api`  
**Environment:** Windows_NT 10.0.26200 (Intel(R) Core(TM) Ultra 5 125H, 15 GB RAM); Node.js v24.4.1; MongoDB 7.0.14

This report covers Test Plan level 1 (unit testing) and level 2 (integration/API testing): validation rules, grading and report calculations, token handling, middleware, every REST endpoint against a real MongoDB database, and every React page against a simulated API. Browser end-to-end results are in the [System Validation Report](system-validation-report.md).

## Summary

| Suite | Level | Test files | Tests | Passed | Failed | Skipped or to-do | Duration |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Backend | Unit | 10 | 54 | 54 | 0 | 0 | 2.2 s |
| Backend | API integration (real MongoDB) | 17 | 114 | 113 | 0 | 1 | 31.9 s |
| Backend | Load (NFR) | 2 | 6 | 6 | 0 | 0 | 6.4 s |
| Frontend | Unit (React components) | 7 | 96 | 96 | 0 | 0 | 24.6 s |
| **Total** |  | 36 | 270 | 269 | 0 | 1 | 65.1 s |

**Result: all 269 runnable tests passed.**

A to-do test documents an open defect and does not fail the suite: `tests/quizCreate.integration.test.js` — "a removed quiz cannot be published again" (Defect D-07: publish does not reject removed quizzes).

## How to run

```bash
# Backend (MongoDB running; uses the studyplatform_test database)
cd backend && NODE_ENV=test MONGO_URI=mongodb://127.0.0.1:27017/studyplatform_test npm run test:coverage
# Frontend
cd frontend && npm run test:coverage
```

Without `MONGO_URI`, `npm test` in `backend` still runs the unit tests and skips the database tests.

## Backend results by file

| File | Level | Tests | Passed | Failed | Duration |
| --- | --- | --- | --- | --- | --- |
| `tests/adminModeration.integration.test.js` | API integration | 11 | 11 | 0 | 5.00 s |
| `tests/contributorPerformance.integration.test.js` | API integration | 5 | 5 | 0 | 3.23 s |
| `tests/health.test.js` | API integration | 2 | 2 | 0 | 0.26 s |
| `tests/materialDownload.integration.test.js` | API integration | 5 | 5 | 0 | 1.10 s |
| `tests/materialSearch.integration.test.js` | API integration | 7 | 7 | 0 | 1.13 s |
| `tests/materialUpload.integration.test.js` | API integration | 10 | 10 | 0 | 1.94 s |
| `tests/questionBank.integration.test.js` | API integration | 5 | 5 | 0 | 1.10 s |
| `tests/questionFilter.integration.test.js` | API integration | 6 | 6 | 0 | 0.77 s |
| `tests/questionOwnership.integration.test.js` | API integration | 8 | 8 | 0 | 1.31 s |
| `tests/quizCreate.integration.test.js` | API integration | 8 | 7 | 0 | 1.28 s |
| `tests/quizDelete.integration.test.js` | API integration | 8 | 8 | 0 | 2.69 s |
| `tests/quizGrading.integration.test.js` | API integration | 12 | 12 | 0 | 4.46 s |
| `tests/quizList.integration.test.js` | API integration | 4 | 4 | 0 | 0.95 s |
| `tests/registration.integration.test.js` | API integration | 8 | 8 | 0 | 2.08 s |
| `tests/serverStartup.test.js` | API integration | 2 | 2 | 0 | 0.71 s |
| `tests/session.integration.test.js` | API integration | 5 | 5 | 0 | 1.09 s |
| `tests/studentPerformance.integration.test.js` | API integration | 8 | 8 | 0 | 2.81 s |
| `tests/quizSubmitPerformance.integration.test.js` | Load (NFR) | 3 | 3 | 0 | 2.62 s |
| `tests/searchPerformance.integration.test.js` | Load (NFR) | 3 | 3 | 0 | 3.77 s |
| `tests/auditLog.test.js` | Unit | 6 | 6 | 0 | 1.92 s |
| `tests/authorization.test.js` | Unit | 2 | 2 | 0 | 0.01 s |
| `tests/fileValidation.test.js` | Unit | 6 | 6 | 0 | 0.09 s |
| `tests/inputValidation.test.js` | Unit | 3 | 3 | 0 | 0.00 s |
| `tests/logout.test.js` | Unit | 2 | 2 | 0 | 0.12 s |
| `tests/materialValidation.test.js` | Unit | 6 | 6 | 0 | 0.01 s |
| `tests/questionValidation.test.js` | Unit | 10 | 10 | 0 | 0.01 s |
| `tests/quizGrading.test.js` | Unit | 7 | 7 | 0 | 0.01 s |
| `tests/quizValidation.test.js` | Unit | 2 | 2 | 0 | 0.00 s |
| `tests/registrationValidation.test.js` | Unit | 10 | 10 | 0 | 0.01 s |

## Frontend results by file

| File | Tests | Passed | Failed | Duration |
| --- | --- | --- | --- | --- |
| `frontend/src/api.test.js` | 10 | 10 | 0 | 0.05 s |
| `frontend/src/auth.test.jsx` | 11 | 11 | 0 | 7.98 s |
| `frontend/src/components/materials.test.jsx` | 14 | 14 | 0 | 5.76 s |
| `frontend/src/components/questionBank.test.jsx` | 12 | 12 | 0 | 5.12 s |
| `frontend/src/components/quizzes.test.jsx` | 16 | 16 | 0 | 2.18 s |
| `frontend/src/components/reportsAdmin.test.jsx` | 11 | 11 | 0 | 1.70 s |
| `frontend/src/shell.test.jsx` | 22 | 22 | 0 | 1.85 s |

## Every test

<details><summary><code>backend/tests/adminModeration.integration.test.js</code> — 11/11 passed</summary>

- ✅ an admin can remove another contributor’s quiz (1106.9 ms)
- ✅ after admin deletes a quiz it is no longer listed for students (597.9 ms)
- ✅ an admin can remove any material (535.9 ms)
- ✅ after admin deletes a material it no longer appears in search (405.5 ms)
- ✅ after admin deletes a material the download endpoint returns 404 (393 ms)
- ✅ a contributor cannot delete another contributor’s material and gets 403 (369.9 ms)
- ✅ a student cannot delete a material and gets 403 (433.2 ms)
- ✅ deleting a missing material returns 404 (191.3 ms)
- ✅ deleting a missing quiz returns 404 (177.3 ms)
- ✅ admin quiz deletion writes one DELETE audit entry (394.2 ms)
- ✅ admin material deletion writes one DELETE audit entry (394.1 ms)

</details>

<details><summary><code>backend/tests/contributorPerformance.integration.test.js</code> — 5/5 passed</summary>

- ✅ TC-Rep-02: Contributor quiz statistics match hand-calculated metrics and hardest questions (1539.6 ms)
- ✅ a quiz with no attempts returns zeroed statistics and empty hardest questions (232.8 ms)
- ✅ strict isolation: Contributor cannot view another Contributor quizzes or single quiz stats (654.6 ms)
- ✅ in_progress attempts are ignored in statistics calculations (420.8 ms)
- ✅ role-based access control: Students and Admins cannot access contributor statistics (377.6 ms)

</details>

<details><summary><code>backend/tests/health.test.js</code> — 2/2 passed</summary>

- ✅ GET /api/health reports the expected health-check shape (239.8 ms)
- ✅ GET /health is a backwards-compatible alias (23.6 ms)

</details>

<details><summary><code>backend/tests/materialDownload.integration.test.js</code> — 5/5 passed</summary>

- ✅ a logged-in user downloads the exact stored file (817.9 ms)
- ✅ each download increases the download count by exactly 1 (118.5 ms)
- ✅ concurrent downloads are all counted (106.7 ms)
- ✅ unknown or malformed material ids return 404 (21.6 ms)
- ✅ downloading requires a logged-in user (40.3 ms)

</details>

<details><summary><code>backend/tests/materialSearch.integration.test.js</code> — 7/7 passed</summary>

- ✅ a keyword search returns 10 results per page, newest first (712.9 ms)
- ✅ results contain list fields only and never the storage path (19 ms)
- ✅ search filters by subject, by topic and by both (92.8 ms)
- ✅ a search with no matches reports "No materials found" (15.7 ms)
- ✅ an uploaded material appears in search results (68.6 ms)
- ✅ every logged-in role can search and anonymous users cannot (216.5 ms)
- ✅ an invalid page number is rejected (9 ms)

</details>

<details><summary><code>backend/tests/materialUpload.integration.test.js</code> — 10/10 passed</summary>

- ✅ a contributor uploads a PDF with title, subject and topic (723.5 ms)
- ✅ DOCX and PPTX files are accepted (75.9 ms)
- ✅ non-ASCII file names are kept intact (35.5 ms)
- ✅ a valid 20 MB PDF is stored and confirmed within 10 seconds (381.4 ms)
- ✅ a 21 MB PDF is rejected with "Invalid file" and nothing is kept (320.3 ms)
- ✅ an executable renamed to .pdf is rejected and its temporary file is deleted (29.9 ms)
- ✅ unsupported formats and requests without a file are rejected (30.8 ms)
- ✅ title is accepted up to 100 characters and rejected beyond that (52.3 ms)
- ✅ title, subject and topic are required (62.8 ms)
- ✅ only contributors can upload material (224.7 ms)

</details>

<details><summary><code>backend/tests/questionBank.integration.test.js</code> — 5/5 passed</summary>

- ✅ a contributor adds a valid 500-character question and it is persisted (733.8 ms)
- ✅ a question with 3 options or with 2 correct options is rejected (45.2 ms)
- ✅ saved questions appear in the question bank, newest first (65 ms)
- ✅ only contributors can add or list questions (230.4 ms)
- ✅ page size is capped at 50 and invalid paging is rejected (26.2 ms)

</details>

<details><summary><code>backend/tests/questionFilter.integration.test.js</code> — 6/6 passed</summary>

- ✅ a question without a topic or difficulty is not saved (690.7 ms)
- ✅ every saved question has exactly one topic and one difficulty (9.7 ms)
- ✅ filtering by topic returns only that topic, ignoring case (20.1 ms)
- ✅ filtering by difficulty returns only that difficulty (15.4 ms)
- ✅ filtering by Algebra and Easy returns only matching questions (18.3 ms)
- ✅ an unknown difficulty filter is rejected (10.9 ms)

</details>

<details><summary><code>backend/tests/questionOwnership.integration.test.js</code> — 8/8 passed</summary>

- ✅ a contributor edits their own question (985.8 ms)
- ✅ an edit must still be a valid question (37.4 ms)
- ✅ a contributor deletes their own unused question (54.5 ms)
- ✅ another contributor cannot edit or delete the question (56.3 ms)
- ✅ students cannot edit or delete questions (41.9 ms)
- ✅ a question used in a published quiz cannot be deleted (46.4 ms)
- ✅ a question used only in draft or removed quizzes can be deleted (50.6 ms)
- ✅ unknown and malformed question ids return 404 (33.5 ms)

</details>

<details><summary><code>backend/tests/quizCreate.integration.test.js</code> — 7/8 passed</summary>

- ✅ TC-Quiz-01: quizzes with 5 or 50 questions and 5 or 180 minutes are created as drafts (1008.4 ms)
- ✅ TC-Quiz-01: 4 or 51 questions and 4 or 181 minutes are rejected (46.3 ms)
- ✅ a quiz can only use questions that exist (18.7 ms)
- ✅ only contributors can create quizzes (10.4 ms)
- ✅ TC-Quiz-01: publishing makes the quiz available to students (85 ms)
- ✅ only the quiz creator can publish it (26.5 ms)
- ✅ publishing an unknown or malformed quiz id returns 404 (16.2 ms)
- 🐞 to-do a removed quiz cannot be published again (65.9 ms) — Defect D-07: publish does not reject removed quizzes

</details>

<details><summary><code>backend/tests/quizDelete.integration.test.js</code> — 8/8 passed</summary>

- ✅ the creator deletes their own quiz and gets 200 (467.4 ms)
- ✅ a deleted quiz is not returned in the published list for students (458.1 ms)
- ✅ a deleted quiz cannot be started by a student (383.4 ms)
- ✅ another contributor cannot delete the quiz and gets 403 Access denied (363.5 ms)
- ✅ a student cannot delete a quiz and gets 403 (374.9 ms)
- ✅ deleting a missing quiz returns 404 (179.4 ms)
- ✅ deleting an already-removed quiz returns 404 (220.8 ms)
- ✅ deleting a quiz writes exactly one DELETE audit entry (237.6 ms)

</details>

<details><summary><code>backend/tests/quizGrading.integration.test.js</code> — 12/12 passed</summary>

- ✅ TC-Quiz-03: 7 correct answers out of 10 show 7/10, 70% and every correct answer within 3 s (1123.5 ms)
- ✅ an attempt with no answers scores 0 (71.2 ms)
- ✅ correct answers are never sent before the attempt is finished (81 ms)
- ✅ a second submit returns 409 with the original result (129.8 ms)
- ✅ simultaneous submits of one attempt grade it only once (160.9 ms)
- ✅ a past result does not change when a question is edited later (113 ms)
- ✅ after the time limit the answers given so far are graded and the status is timed_out (87.9 ms)
- ✅ opening an expired attempt also grades it (115.6 ms)
- ✅ an answer saved too late is refused, is not counted and returns the result (84.5 ms)
- ✅ each attempt is graded separately (125.4 ms)
- ✅ only the student who owns an attempt can submit it (244.4 ms)
- ✅ 100 simultaneous submissions return results within 3 s for at least 95% (2125.1 ms)

</details>

<details><summary><code>backend/tests/quizList.integration.test.js</code> — 4/4 passed</summary>

- ✅ TC-Quiz-04: a student sees every published quiz with its title, question count and time limit (712.8 ms)
- ✅ draft and removed quizzes are not listed (22.7 ms)
- ✅ list items do not reveal which questions a quiz contains (23.4 ms)
- ✅ only students can list published quizzes (192.2 ms)

</details>

<details><summary><code>backend/tests/registration.integration.test.js</code> — 8/8 passed</summary>

- ✅ registers a student, persists a bcrypt hash and returns only safe user fields (706.5 ms)
- ✅ registers a contributor account (189 ms)
- ✅ rejects duplicate emails with the required message (325.2 ms)
- ✅ rejects public administrator registration (4.7 ms)
- ✅ rejects invalid input before attempting persistence (3.4 ms)
- ✅ logs in with valid credentials and returns a token without a password hash (340.7 ms)
- ✅ rejects incorrect passwords and unknown emails with the same message and no token (335.1 ms)
- ✅ rejects missing, altered and expired authentication tokens with HTTP 401 (174.2 ms)

</details>

<details><summary><code>backend/tests/serverStartup.test.js</code> — 2/2 passed</summary>

- ✅ the API refuses to start without MONGO_URI (424 ms)
- ✅ the API connects to MongoDB before it starts listening (281.8 ms)

</details>

<details><summary><code>backend/tests/session.integration.test.js</code> — 5/5 passed</summary>

- ✅ TC-Auth-04: logout ends the session immediately and the old token is refused (632.3 ms)
- ✅ TC-Sec-03: logging out twice with the same token is refused the second time (208.7 ms)
- ✅ logout without a token returns 401 (4.2 ms)
- ✅ refresh issues a new working token and revokes the old one (224.5 ms)
- ✅ refresh and /me refuse a valid token whose user no longer exists (21.3 ms)

</details>

<details><summary><code>backend/tests/studentPerformance.integration.test.js</code> — 8/8 passed</summary>

- ✅ 3 submitted attempts produce correct overall average, topics and attempt list (813.4 ms)
- ✅ only the 20 newest attempts are returned when there are 25 (511.7 ms)
- ✅ another student's attempts are never included (565.2 ms)
- ✅ in_progress attempts are ignored (391.6 ms)
- ✅ a Student with no attempts gets empty lists and 0 (181.9 ms)
- ✅ a Contributor gets 403 Access denied (170.5 ms)
- ✅ an Admin gets 403 Access denied (164.9 ms)
- ✅ no token gets 401 (6.1 ms)

</details>

<details><summary><code>backend/tests/quizSubmitPerformance.integration.test.js</code> — 3/3 passed</summary>

- ✅ percentile calculation follows nearest-rank standard (188.6 ms)
- ✅ summarise correctly reports pass criteria and latency metrics (1.2 ms)
- ✅ TC-Perf-02: 100 simultaneous student submissions return results within 3 s for at least 95% (2429.4 ms)

</details>

<details><summary><code>backend/tests/searchPerformance.integration.test.js</code> — 3/3 passed</summary>

- ✅ percentile uses the nearest-rank method (1569 ms)
- ✅ the search mix covers keyword, subject, topic and combined searches (1.6 ms)
- ✅ TC-Perf-01: 95th percentile of 200 searches over 10,000 materials is within 2 s (2195.3 ms)

</details>

<details><summary><code>backend/tests/auditLog.test.js</code> — 6/6 passed</summary>

- ✅ a successful login creates exactly one LOGIN_SUCCESS entry (637.7 ms)
- ✅ a wrong password creates exactly one LOGIN_FAILED entry with the matched user id (378.6 ms)
- ✅ an unknown email creates one LOGIN_FAILED entry with null userId (30.1 ms)
- ✅ a material upload creates exactly one UPLOAD entry (237.8 ms)
- ✅ deleting a question creates exactly one DELETE entry (263.9 ms)
- ✅ no audit log entry contains a password or token (370 ms)

</details>

<details><summary><code>backend/tests/authorization.test.js</code> — 2/2 passed</summary>

- ✅ role middleware permits the configured role and rejects other roles with exact 403 response (5.4 ms)
- ✅ permission matrix gives every account exactly one supported role (1.1 ms)

</details>

<details><summary><code>backend/tests/fileValidation.test.js</code> — 6/6 passed</summary>

- ✅ detects PDF, DOCX and PPTX files from their content (31.4 ms)
- ✅ accepts valid documents and reports the verified MIME type (15.9 ms)
- ✅ rejects an executable renamed with a document extension (11.1 ms)
- ✅ rejects files whose extension does not match the real content (15.2 ms)
- ✅ rejects ZIP archives that are not Word or PowerPoint packages (13.7 ms)
- ✅ rejects empty, missing and oversized files (6.1 ms)

</details>

<details><summary><code>backend/tests/inputValidation.test.js</code> — 3/3 passed</summary>

- ✅ rejects script and event-handler payloads (4 ms)
- ✅ rejects database operators and SQL command payloads (0.5 ms)
- ✅ accepts ordinary user input (0.4 ms)

</details>

<details><summary><code>backend/tests/logout.test.js</code> — 2/2 passed</summary>

- ✅ signed tokens carry the required 30-minute expiry (76.4 ms)
- ✅ revoking a token persists its revocation until its expiry (43.2 ms)

</details>

<details><summary><code>backend/tests/materialValidation.test.js</code> — 6/6 passed</summary>

- ✅ accepts and trims upload metadata (3.6 ms)
- ✅ rejects missing or overlong upload metadata (1.7 ms)
- ✅ builds a keyword, subject and topic search filter (0.6 ms)
- ✅ an empty search lists every material from page 1 (0.3 ms)
- ✅ rejects invalid page numbers (0.2 ms)
- ✅ ignores non-string search parameters such as operator objects (0.3 ms)

</details>

<details><summary><code>backend/tests/questionValidation.test.js</code> — 10/10 passed</summary>

- ✅ accepts a question with four options and one correct option (9.2 ms)
- ✅ accepts options given as objects with exactly one marked correct (0.8 ms)
- ✅ limits question text to 500 characters (0.5 ms)
- ✅ requires exactly four options (0.3 ms)
- ✅ rejects empty, mixed or duplicate options (0.5 ms)
- ✅ requires exactly one correct option (0.8 ms)
- ✅ requires a topic and a difficulty of Easy, Medium or Hard (0.5 ms)
- ✅ normalizes difficulty spelling (0.3 ms)
- ✅ rejects a missing or non-object body (0.3 ms)
- ✅ builds topic, difficulty and combined question filters (0.8 ms)

</details>

<details><summary><code>backend/tests/quizGrading.test.js</code> — 7/7 passed</summary>

- ✅ a 10-question quiz with 7 correct answers scores 7/10 and 70% (6.3 ms)
- ✅ correct answers earn 1 mark and wrong or unanswered questions earn 0 (0.6 ms)
- ✅ option 0 is treated as an answer, not as unanswered (0.4 ms)
- ✅ an attempt with no answers scores 0 out of the full total (0.3 ms)
- ✅ every question reports its correct answer, in quiz order (2 ms)
- ✅ percentages are rounded to one decimal place (0.6 ms)
- ✅ a question that no longer exists still counts towards the total (0.4 ms)

</details>

<details><summary><code>backend/tests/quizValidation.test.js</code> — 2/2 passed</summary>

- ✅ accepts a valid quiz with 5 questions and a 5-minute limit (3.3 ms)
- ✅ rejects invalid quiz time limits and question counts (0.3 ms)

</details>

<details><summary><code>backend/tests/registrationValidation.test.js</code> — 10/10 passed</summary>

- ✅ accepts student registration, defaults the role, trims the name and normalizes email (8.3 ms)
- ✅ accepts contributor registration (0.8 ms)
- ✅ rejects names shorter than 2 characters and longer than 50 characters (0.5 ms)
- ✅ rejects malformed email addresses (0.3 ms)
- ✅ rejects missing passwords (0.4 ms)
- ✅ does not allow public registration as an administrator (0.4 ms)
- ✅ does not allow an administrator role through public registration (0.3 ms)
- ✅ rejects an absent or non-object request body (0.2 ms)
- ✅ rejects passwords longer than bcrypt supports without truncating them (0.4 ms)
- ✅ rejects passwords that are shorter than 8 characters, lack a digit, or lack a letter (0.4 ms)

</details>

<details><summary><code>frontend/src/api.test.js</code> — 10/10 passed</summary>

- ✅ getAuthUser > returns the stored user (16.9 ms)
- ✅ getAuthUser > returns null when nothing or invalid JSON is stored (2 ms)
- ✅ apiRequest > sends the stored token as a bearer header (9.4 ms)
- ✅ apiRequest > calls the API on the page origin, so HTTPS pages never send requests over plain HTTP (D-01) (1.8 ms)
- ✅ apiRequest > sends no authorization header when logged out (1.8 ms)
- ✅ apiRequest > a 401 response clears the session and opens the login page (TC-Auth-04) (3.6 ms)
- ✅ apiRequest > refreshes a token that expires within 15 minutes before calling the API (8 ms)
- ✅ apiRequest > keeps the old token when the refresh fails (2.1 ms)
- ✅ apiRequest > uses a token that cannot be decoded as it is (3.6 ms)
- ✅ readJson > parses JSON and falls back to an empty object (1.8 ms)

</details>

<details><summary><code>frontend/src/auth.test.jsx</code> — 11/11 passed</summary>

- ✅ LoginPage (TC-Auth-02) > stores the session and opens the home page on success (1175 ms)
- ✅ LoginPage (TC-Auth-02) > shows "Invalid email or password" and creates no session (701.3 ms)
- ✅ LoginPage (TC-Auth-02) > explains when the server cannot be reached (552.6 ms)
- ✅ RegistrationPage (TC-Auth-01, TC-Auth-05) > offers only Student and Contributor accounts (101.7 ms)
- ✅ RegistrationPage (TC-Auth-01, TC-Auth-05) > creates a contributor account (917.5 ms)
- ✅ RegistrationPage (TC-Auth-01, TC-Auth-05) > rejects the weak password abc12 with "Password too weak" before calling the API (807.7 ms)
- ✅ RegistrationPage (TC-Auth-01, TC-Auth-05) > rejects the weak password abcdefgh with "Password too weak" before calling the API (805.5 ms)
- ✅ RegistrationPage (TC-Auth-01, TC-Auth-05) > rejects the weak password 12345678 with "Password too weak" before calling the API (788.8 ms)
- ✅ RegistrationPage (TC-Auth-01, TC-Auth-05) > rejects a one-character name (623.5 ms)
- ✅ RegistrationPage (TC-Auth-01, TC-Auth-05) > shows "Email already registered" from the server (743.1 ms)
- ✅ RegistrationPage (TC-Auth-01, TC-Auth-05) > explains when the server cannot be reached (760.6 ms)

</details>

<details><summary><code>frontend/src/components/materials.test.jsx</code> — 14/14 passed</summary>

- ✅ MaterialsPage (TC-Mat-02, TC-Mat-03) > lists the newest materials with their details (620.7 ms)
- ✅ MaterialsPage (TC-Mat-02, TC-Mat-03) > shows "No materials found" when nothing matches (47.6 ms)
- ✅ MaterialsPage (TC-Mat-02, TC-Mat-03) > searches by keyword, subject and topic from page 1 (920.2 ms)
- ✅ MaterialsPage (TC-Mat-02, TC-Mat-03) > pages through results 10 at a time (380.9 ms)
- ✅ MaterialsPage (TC-Mat-02, TC-Mat-03) > downloading saves the file and adds 1 to the download count (115.4 ms)
- ✅ MaterialsPage (TC-Mat-02, TC-Mat-03) > shows the server message when a download fails (144.5 ms)
- ✅ MaterialsPage (TC-Mat-02, TC-Mat-03) > shows search errors and connection failures (74.7 ms)
- ✅ MaterialsPage (TC-Mat-02, TC-Mat-03) > only contributors see the upload link (62 ms)
- ✅ UploadMaterialPage (TC-Mat-01, TC-Sec-04) > is denied to anyone who is not a contributor (16 ms)
- ✅ UploadMaterialPage (TC-Mat-01, TC-Sec-04) > uploads the file with its title, subject and topic and resets the form (725.9 ms)
- ✅ UploadMaterialPage (TC-Mat-01, TC-Sec-04) > rejects an unsupported format before uploading (650.1 ms)
- ✅ UploadMaterialPage (TC-Mat-01, TC-Sec-04) > rejects a file over 20 MB before uploading (682.6 ms)
- ✅ UploadMaterialPage (TC-Mat-01, TC-Sec-04) > shows the server rejection for a disguised file (667.1 ms)
- ✅ UploadMaterialPage (TC-Mat-01, TC-Sec-04) > explains when the server cannot be reached (650.5 ms)

</details>

<details><summary><code>frontend/src/components/questionBank.test.jsx</code> — 12/12 passed</summary>

- ✅ QuestionBankPage > is denied to anyone who is not a contributor (386.1 ms)
- ✅ QuestionBankPage > TC-QB-01: saves a question with four options, one correct answer, a topic and a difficulty (1694 ms)
- ✅ QuestionBankPage > shows the server message for an invalid question (1102.9 ms)
- ✅ QuestionBankPage > lists questions with the correct answer, tags and "Yours" only on own questions (81.8 ms)
- ✅ QuestionBankPage > TC-QB-02: edits an own question with PUT and shows "Question updated." (444.9 ms)
- ✅ QuestionBankPage > cancelling an edit returns to the add form (222.5 ms)
- ✅ QuestionBankPage > TC-QB-02: deletes an own question after confirmation (116.4 ms)
- ✅ QuestionBankPage > TC-QB-02: shows "Question is in use" when the question is in a published quiz (108.1 ms)
- ✅ QuestionBankPage > does not delete when the confirmation is cancelled (121.1 ms)
- ✅ QuestionBankPage > TC-QB-03: filters by topic and difficulty, then clears the filters (528.3 ms)
- ✅ QuestionBankPage > pages through the question bank (233.3 ms)
- ✅ QuestionBankPage > shows load errors and connection failures (77.6 ms)

</details>

<details><summary><code>frontend/src/components/quizzes.test.jsx</code> — 16/16 passed</summary>

- ✅ Published quiz list (TC-Quiz-04) > is denied to anyone who is not a student (380.5 ms)
- ✅ Published quiz list (TC-Quiz-04) > lists each published quiz with its title, question count and time limit (206.1 ms)
- ✅ Published quiz list (TC-Quiz-04) > says when there are no published quizzes (35.5 ms)
- ✅ Published quiz list (TC-Quiz-04) > shows an error when the list cannot be loaded (37.7 ms)
- ✅ Published quiz list (TC-Quiz-04) > starting a quiz opens the new attempt (172.7 ms)
- ✅ Published quiz list (TC-Quiz-04) > shows why a quiz could not be started (118.4 ms)
- ✅ Quiz attempt (TC-Quiz-02) > is denied to anyone who is not a student (19.3 ms)
- ✅ Quiz attempt (TC-Quiz-02) > shows the questions and a countdown timer from the server time (220.5 ms)
- ✅ Quiz attempt (TC-Quiz-02) > saves each answer as soon as it is chosen (261.3 ms)
- ✅ Quiz attempt (TC-Quiz-02) > puts an answer back when it cannot be saved (264.5 ms)
- ✅ Quiz attempt (TC-Quiz-02) > TC-Quiz-03: submitting shows the score, percentage and correct answer to each question (121.1 ms)
- ✅ Quiz attempt (TC-Quiz-02) > a repeated submit that returns 409 with the stored result still shows the result (106.2 ms)
- ✅ Quiz attempt (TC-Quiz-02) > a failed submit keeps the attempt open and explains the error (123 ms)
- ✅ Quiz attempt (TC-Quiz-02) > auto-submits when the time is already up (TC-Quiz-02) (48.9 ms)
- ✅ Quiz attempt (TC-Quiz-02) > opening a finished attempt shows its result (30.2 ms)
- ✅ Quiz attempt (TC-Quiz-02) > shows an error when the attempt cannot be loaded (38.3 ms)

</details>

<details><summary><code>frontend/src/components/reportsAdmin.test.jsx</code> — 11/11 passed</summary>

- ✅ Student performance page (TC-Rep-01) > shows the overall average, the score per topic and the attempts (739 ms)
- ✅ Student performance page (TC-Rep-01) > says when there are no attempts yet (31.5 ms)
- ✅ Student performance page (TC-Rep-01) > shows an error when the report cannot be loaded (32.9 ms)
- ✅ Student performance page (TC-Rep-01) > is denied to admins (16.6 ms)
- ✅ Contributor quiz statistics (TC-Rep-02) > shows attempts, average, highest, lowest and the hardest questions for each own quiz (125.5 ms)
- ✅ Contributor quiz statistics (TC-Rep-02) > says when the contributor has no quizzes (27.4 ms)
- ✅ Admin moderation page (TC-Adm-01) > is denied to anyone who is not an admin (19.3 ms)
- ✅ Admin moderation page (TC-Adm-01) > lists materials and quizzes and removes each after confirmation (339.3 ms)
- ✅ Admin moderation page (TC-Adm-01) > keeps an item and shows the error when removal fails (180.3 ms)
- ✅ Admin moderation page (TC-Adm-01) > does nothing when the confirmation is cancelled (155.2 ms)
- ✅ Admin moderation page (TC-Adm-01) > shows an error when the lists cannot be loaded (33.1 ms)

</details>

<details><summary><code>frontend/src/shell.test.jsx</code> — 22/22 passed</summary>

- ✅ App routing (TC-Auth-04) > #/materials shows the login page when logged out (549.4 ms)
- ✅ App routing (TC-Auth-04) > #/questions shows the login page when logged out (79.9 ms)
- ✅ App routing (TC-Auth-04) > #/quizzes shows the login page when logged out (44.3 ms)
- ✅ App routing (TC-Auth-04) > #/performance shows the login page when logged out (54.8 ms)
- ✅ App routing (TC-Auth-04) > #/admin shows the login page when logged out (66.4 ms)
- ✅ App routing (TC-Auth-04) > opens the matching page for a logged-in user and follows hash changes (135.8 ms)
- ✅ App routing (TC-Auth-04) > shows the home page for unknown routes (66.9 ms)
- ✅ Layout navigation (TC-Auth-03) > logged-out visitors see only public links and no logout button (58.8 ms)
- ✅ Layout navigation (TC-Auth-03) > a student sees only the links for that role (60.4 ms)
- ✅ Layout navigation (TC-Auth-03) > a contributor sees only the links for that role (48.5 ms)
- ✅ Layout navigation (TC-Auth-03) > a admin sees only the links for that role (39.5 ms)
- ✅ Layout navigation (TC-Auth-03) > marks the current page link (46 ms)
- ✅ Layout navigation (TC-Auth-03) > logout revokes the token on the server and clears the session (TC-Auth-04) (107.5 ms)
- ✅ Layout navigation (TC-Auth-03) > logout still clears the session when the server is unreachable (89.9 ms)
- ✅ Home page status badge (CSQ-NF-003) > reports when all systems are operational (53.3 ms)
- ✅ Home page status badge (CSQ-NF-003) > reports when the service is unavailable (39.1 ms)
- ✅ Home page status badge (CSQ-NF-003) > reports unavailable when the request fails (29.5 ms)
- ✅ System status page (CSQ-NF-003) > shows uptime, database state and session availability (87.6 ms)
- ✅ System status page (CSQ-NF-003) > records a failed check and "Check now" runs another (100.6 ms)
- ✅ System status page (CSQ-NF-003) > formats 42 seconds of uptime as 42s (29.4 ms)
- ✅ System status page (CSQ-NF-003) > formats 125 seconds of uptime as 2m 5s (31.5 ms)
- ✅ System status page (CSQ-NF-003) > formats 90061 seconds of uptime as 1d 1h 1m (29.7 ms)

</details>

Raw results: [backend JSON](raw/backend-test-results.json), [backend JUnit](raw/backend-junit.xml), [frontend JUnit](raw/frontend-junit.xml). Logs: [raw/logs](raw/logs).
