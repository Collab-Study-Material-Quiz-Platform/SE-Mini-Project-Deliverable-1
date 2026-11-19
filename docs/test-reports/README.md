# Test reports (Deliverables Part-3)

Generated 2026-11-19 02:54 UTC from commit `20f2942`.

| Report | Contents | Headline |
| --- | --- | --- |
| [Unit Test Report](unit-test-report.md) | Backend unit, API integration and load tests; frontend component tests | 269 passed, 0 failed, 1 to-do for an open defect |
| [System Validation Report](system-validation-report.md) | All 33 Test Plan test cases against the running system in real browsers | 27 pass, 5 partial, 1 manual |
| [Code Coverage Report](code-coverage-report.md) | Statement, line and function coverage | 94.7% of lines |
| [Branch Coverage Report](branch-coverage-report.md) | Coverage of every decision path | 83.0% of branches |

No test case failed.

HTML reports: [backend coverage](html/backend-coverage/index.html), [frontend coverage](html/frontend-coverage/index.html), [browser tests](html/e2e-report/index.html). Raw results and logs: [raw](raw).

Regenerate with `node scripts/generate-test-reports.mjs --with-backup-drill --with-tls` (MongoDB running; Docker for the TLS check; mongodump/mongorestore for the backup drill).
