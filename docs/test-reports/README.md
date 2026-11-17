# Test reports (Deliverables Part-3)

Generated 2026-11-17 16:31 UTC from commit `3218ccc`.

| Report | Contents | Headline |
| --- | --- | --- |
| [Unit Test Report](unit-test-report.md) | Backend unit, API integration and load tests; frontend component tests | 268 passed, 0 failed, 1 to-do for an open defect |
| [System Validation Report](system-validation-report.md) | All 33 Test Plan test cases against the running system in real browsers | 26 pass, 1 fail, 5 partial, 1 manual |
| [Code Coverage Report](code-coverage-report.md) | Statement, line and function coverage | 94.7% of lines |
| [Branch Coverage Report](branch-coverage-report.md) | Coverage of every decision path | 83.1% of branches |

Failing test cases: TC-Sec-05 — see the defects in the System Validation Report.

HTML reports: [backend coverage](html/backend-coverage/index.html), [frontend coverage](html/frontend-coverage/index.html), [browser tests](html/e2e-report/index.html). Raw results and logs: [raw](raw).

Regenerate with `node scripts/generate-test-reports.mjs --with-backup-drill --with-tls` (MongoDB running; Docker for the TLS check; mongodump/mongorestore for the backup drill).
