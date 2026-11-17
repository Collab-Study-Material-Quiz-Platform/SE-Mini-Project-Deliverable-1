# Branch Coverage Report

**Project:** Collaborative Study Material & Quiz Platform (Project #21)  
**Generated:** 2026-11-17 16:31 UTC by `node scripts/generate-test-reports.mjs`  
**Code version:** commit `3218ccc` on branch `test/part-3-test-reports`  
**Environment:** Windows_NT 10.0.26200 (Intel(R) Core(TM) Ultra 5 125H, 15 GB RAM); Node.js v24.4.1; MongoDB 7.0.14

Branch coverage counts every path through each decision in the code: both outcomes of `if`/`else`, each side of `&&`, `||` and `??`, both results of `? :`, each `switch` case and default parameter values. A branch is covered when at least one test runs it. Measured with V8 coverage (c8 for the backend, Vitest for the frontend) during the unit and API integration tests.

## Summary

| Code | Branches covered | Branch coverage |
| --- | --- | --- |
| Backend (Node/Express) | 456 of 556 | 82.0% |
| Frontend (React) | 475 of 565 | 84.1% |
| **Whole application** | 931 of 1121 | 83.1% |

Branch coverage is lower than line coverage because one line often holds several branches. For example, `return res.status(error ? 500 : 200)` is one covered line but counts as two branches, and the 500 side only runs when a database call fails.

## Backend branches by file

| File | Branches | Covered | Lines of uncovered branches |
| --- | --- | --- | --- |
| `backend/routes/health.js` | 6 | 33.3% | 12, 13, 18, 19 |
| `backend/middleware/database.js` | 3 | 66.7% | 4 |
| `backend/routes/auth.js` | 33 | 66.7% | 17, 38, 41, 52, 53, 55, 76, 83, 91, 98, 108 |
| `backend/server.js` | 6 | 66.7% | 6, 16 |
| `backend/utils/auditService.js` | 3 | 66.7% | 20 |
| `backend/routes/quizzes.js` | 81 | 69.1% | 54, 77, 94, 107, 120, 131, 147, 154, 158, 165, 169, 181, 188, 190, 196, 197, 199, 217, 218, 220, 223, 245, 251, 258, 274 |
| `backend/routes/reports.js` | 52 | 69.2% | 48, 54, 55, 86, 88, 89, 90, 94, 117, 127, 146, 193, 219, 232, 237, 252 |
| `backend/utils/quizAttempt.js` | 4 | 75.0% | 9 |
| `backend/utils/authToken.js` | 37 | 75.7% | 8, 11, 35, 44, 54, 59, 60, 81 |
| `backend/routes/materials.js` | 46 | 78.3% | 40, 42, 87, 103, 112, 114, 146, 159, 179 |
| `backend/utils/quizValidation.js` | 17 | 82.3% | 2, 3, 7 |
| `backend/routes/questions.js` | 37 | 89.2% | 63, 93, 110, 129 |
| `backend/utils/fileValidation.js` | 38 | 89.5% | 42, 48, 53, 89 |
| `backend/utils/registrationValidation.js` | 31 | 90.3% | 9, 10, 14 |
| `backend/utils/materialValidation.js` | 38 | 92.1% | 20, 22, 37 |
| `backend/utils/quizGrading.js` | 13 | 92.3% | 31 |
| `backend/middleware/inputValidation.js` | 14 | 92.8% | 14 |
| `backend/utils/questionValidation.js` | 69 | 98.5% | 73 |
| `backend/app.js` | 1 | 100.0% | — |
| `backend/middleware/authorization.js` | 5 | 100.0% | — |
| `backend/models/AuditLog.js` | 1 | 100.0% | — |
| `backend/models/Material.js` | 2 | 100.0% | — |
| `backend/models/Question.js` | 3 | 100.0% | — |
| `backend/models/Quiz.js` | 2 | 100.0% | — |
| `backend/models/QuizAttempt.js` | 2 | 100.0% | — |
| `backend/models/RevokedToken.js` | 1 | 100.0% | — |
| `backend/models/User.js` | 1 | 100.0% | — |
| `backend/routes/protectedFeatures.js` | 2 | 100.0% | — |
| `backend/utils/fileStorage.js` | 6 | 100.0% | — |
| `backend/utils/questionUsage.js` | 2 | 100.0% | — |

## Frontend branches by file

| File | Branches | Covered | Lines of uncovered branches |
| --- | --- | --- | --- |
| `frontend/src/App.jsx` | 29 | 72.4% | 17, 32, 33, 35, 37, 38, 39, 40 |
| `frontend/src/components/AdminPage.jsx` | 54 | 75.9% | 22, 24, 25, 26, 27, 30, 49, 52, 54, 57 |
| `frontend/src/components/QuizzesPage.jsx` | 138 | 79.0% | 35, 36, 38, 45, 53, 63, 64, 67, 94, 108, 109, 111, 114, 140, 141, 143, 158, 161, 185, 189, 234, 245 |
| `frontend/src/components/Home.jsx` | 10 | 80.0% | 49, 51 |
| `frontend/src/components/UploadMaterialPage.jsx` | 25 | 80.0% | 34, 38, 39, 61, 67 |
| `frontend/src/components/PerformancePage.jsx` | 54 | 81.5% | 6, 26, 27, 29, 64, 84, 114, 169 |
| `frontend/src/api.js` | 28 | 89.3% | 21, 43, 51 |
| `frontend/src/components/MaterialsPage.jsx` | 47 | 89.4% | 15, 43, 47, 90, 104 |
| `frontend/src/RegistrationPage.jsx` | 29 | 89.7% | 19, 52, 59 |
| `frontend/src/LoginPage.jsx` | 10 | 90.0% | 21 |
| `frontend/src/components/StatusPage.jsx` | 34 | 91.2% | 21, 73, 84 |
| `frontend/src/components/QuestionBankPage.jsx` | 90 | 92.2% | 28, 47, 147, 152, 155, 205, 209 |
| `frontend/src/components/Layout.jsx` | 17 | 94.1% | 34 |

## Why the remaining branches are not covered

- **Database and server failure branches.** Most uncovered backend lines are `catch` blocks that turn an unexpected MongoDB error into a 500/503 response, and `readyState !== 1` checks for a lost database connection. The tests run against a working database, so these paths only run if MongoDB fails mid-request.
- **`server.js`** lines 17–21 run only when the file is started directly with a failing database connection.
- **Frontend effects and timers.** The remaining frontend gaps are cancellation guards for requests that finish after a page is closed, the quiz session heartbeat that runs once a minute, and a few defensive fallbacks for missing API fields.
- **Defaults and fallbacks** such as `process.env.PORT || 5000`, `user?.name ?? null` and `error.message || "Could not reach the server"` count their unused side as an uncovered branch.

The highlighted HTML reports mark each uncovered branch in the source: [backend](html/backend-coverage/index.html), [frontend](html/frontend-coverage/index.html).
