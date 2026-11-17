# Code Coverage Report

**Project:** Collaborative Study Material & Quiz Platform (Project #21)  
**Generated:** 2026-11-17 16:31 UTC by `node scripts/generate-test-reports.mjs`  
**Code version:** commit `3218ccc` on branch `test/part-3-test-reports`  
**Environment:** Windows_NT 10.0.26200 (Intel(R) Core(TM) Ultra 5 125H, 15 GB RAM); Node.js v24.4.1; MongoDB 7.0.14

Statement, line and function coverage of the application code by the unit and API integration tests in the [Unit Test Report](unit-test-report.md). Backend coverage is measured with c8 (V8 coverage) across `app.js`, `server.js`, `routes/`, `middleware/`, `models/` and `utils/`, including files no test loads. Frontend coverage is measured with Vitest (V8 coverage) across `frontend/src`, excluding test files and the `main.jsx` entry point. Branch coverage is detailed in the [Branch Coverage Report](branch-coverage-report.md).

## Summary

| Code | Statements | Lines | Functions | Branches |
| --- | --- | --- | --- | --- |
| Backend (Node/Express) | 93.0% (1711/1839) | 93.0% (1711/1839) | 100.0% (51/51) | 82.0% (456/556) |
| Frontend (React) | 95.7% (713/745) | 99.4% (628/632) | 95.3% (161/169) | 84.1% (475/565) |
| **Whole application** | 93.8% (2424/2584) | 94.7% (2339/2471) | 96.4% (212/220) | 83.1% (931/1121) |

HTML reports with line-by-line highlighting: [backend](html/backend-coverage/index.html), [frontend](html/frontend-coverage/index.html). LCOV files: [backend](raw/backend-lcov.info), [frontend](raw/frontend-lcov.info).

## Backend coverage by file

| File | Statements | Lines | Functions | Branches | Uncovered lines |
| --- | --- | --- | --- | --- | --- |
| `backend/server.js` | 78.3% | 78.3% | 100.0% | 66.7% | 17–21 |
| `backend/middleware/database.js` | 80.0% | 80.0% | 100.0% | 66.7% | 5–6 |
| `backend/routes/auth.js` | 81.6% | 81.6% | 100.0% | 66.7% | 18–19, 41–48, 56–57, 77–79, 92–94, 109–111 |
| `backend/routes/questions.js` | 88.1% | 88.1% | 100.0% | 89.2% | 64–69, 94–96, 111–114, 130–132 |
| `backend/routes/quizzes.js` | 88.2% | 88.2% | 100.0% | 69.1% | 78–81, 95–97, 108–110, 115–116, 148–150, 182–184, 191–192, 200–201, 220–221, 224–226, 252–254, 275–277 |
| `backend/routes/materials.js` | 88.6% | 88.6% | 100.0% | 78.3% | 42–43, 88–90, 104–106, 115–117, 147–153, 180–182 |
| `backend/middleware/inputValidation.js` | 90.0% | 90.0% | 100.0% | 92.8% | 15–16 |
| `backend/utils/authToken.js` | 91.1% | 91.1% | 100.0% | 75.7% | 9–10, 12–13, 45–46, 82–83 |
| `backend/utils/auditService.js` | 92.0% | 92.0% | 100.0% | 66.7% | 21–22 |
| `backend/utils/fileStorage.js` | 93.8% | 93.8% | 100.0% | 100.0% | 12 |
| `backend/routes/reports.js` | 94.2% | 94.2% | 100.0% | 69.2% | 95–97, 194–195, 220–222, 233–234, 238–239, 253–255 |
| `backend/utils/materialValidation.js` | 95.9% | 95.9% | 100.0% | 92.1% | 38–39 |
| `backend/app.js` | 100.0% | 100.0% | 100.0% | 100.0% | — |
| `backend/middleware/authorization.js` | 100.0% | 100.0% | 100.0% | 100.0% | — |
| `backend/models/AuditLog.js` | 100.0% | 100.0% | 100.0% | 100.0% | — |
| `backend/models/Material.js` | 100.0% | 100.0% | 100.0% | 100.0% | — |
| `backend/models/Question.js` | 100.0% | 100.0% | 100.0% | 100.0% | — |
| `backend/models/Quiz.js` | 100.0% | 100.0% | 100.0% | 100.0% | — |
| `backend/models/QuizAttempt.js` | 100.0% | 100.0% | 100.0% | 100.0% | — |
| `backend/models/RevokedToken.js` | 100.0% | 100.0% | 100.0% | 100.0% | — |
| `backend/models/User.js` | 100.0% | 100.0% | 100.0% | 100.0% | — |
| `backend/routes/health.js` | 100.0% | 100.0% | 100.0% | 33.3% | — |
| `backend/routes/protectedFeatures.js` | 100.0% | 100.0% | 100.0% | 100.0% | — |
| `backend/utils/fileValidation.js` | 100.0% | 100.0% | 100.0% | 89.5% | — |
| `backend/utils/questionUsage.js` | 100.0% | 100.0% | 100.0% | 100.0% | — |
| `backend/utils/questionValidation.js` | 100.0% | 100.0% | 100.0% | 98.5% | — |
| `backend/utils/quizAttempt.js` | 100.0% | 100.0% | 100.0% | 75.0% | — |
| `backend/utils/quizGrading.js` | 100.0% | 100.0% | 100.0% | 92.3% | — |
| `backend/utils/quizValidation.js` | 100.0% | 100.0% | 100.0% | 82.3% | — |
| `backend/utils/registrationValidation.js` | 100.0% | 100.0% | 100.0% | 90.3% | — |

## Frontend coverage by file

| File | Statements | Lines | Functions | Branches |
| --- | --- | --- | --- | --- |
| `frontend/src/components/QuestionBankPage.jsx` | 96.0% | 98.2% | 100.0% | 92.2% |
| `frontend/src/components/MaterialsPage.jsx` | 97.4% | 98.5% | 100.0% | 89.4% |
| `frontend/src/components/QuizzesPage.jsx` | 96.3% | 99.2% | 91.2% | 79.0% |
| `frontend/src/api.js` | 95.1% | 100.0% | 88.9% | 89.3% |
| `frontend/src/App.jsx` | 78.8% | 100.0% | 100.0% | 72.4% |
| `frontend/src/components/AdminPage.jsx` | 98.0% | 100.0% | 100.0% | 75.9% |
| `frontend/src/components/Home.jsx` | 95.7% | 100.0% | 85.7% | 80.0% |
| `frontend/src/components/Layout.jsx` | 100.0% | 100.0% | 100.0% | 94.1% |
| `frontend/src/components/PerformancePage.jsx` | 97.4% | 100.0% | 100.0% | 81.5% |
| `frontend/src/components/StatusPage.jsx` | 97.6% | 100.0% | 92.8% | 91.2% |
| `frontend/src/components/UploadMaterialPage.jsx` | 95.7% | 100.0% | 100.0% | 80.0% |
| `frontend/src/LoginPage.jsx` | 95.5% | 100.0% | 80.0% | 90.0% |
| `frontend/src/RegistrationPage.jsx` | 93.5% | 100.0% | 80.0% | 89.7% |

## What is not covered

- **Database and server failure branches.** Most uncovered backend lines are `catch` blocks that turn an unexpected MongoDB error into a 500/503 response, and `readyState !== 1` checks for a lost database connection. The tests run against a working database, so these paths only run if MongoDB fails mid-request.
- **`server.js`** lines 17–21 run only when the file is started directly with a failing database connection.
- **Frontend effects and timers.** The remaining frontend gaps are cancellation guards for requests that finish after a page is closed, the quiz session heartbeat that runs once a minute, and a few defensive fallbacks for missing API fields.

The browser tests in the [System Validation Report](system-validation-report.md) exercise the same code end to end but are not included in these figures.
