#!/usr/bin/env node
// Runs every automated test suite in the Test Plan and writes the Part-3 test reports to docs/test-reports:
//   Unit Test Report, System Validation Report, Code Coverage Report and Branch Coverage Report.
//
// Usage (MongoDB must be running):
//   node scripts/generate-test-reports.mjs [--skip-run] [--skip-e2e] [--with-backup-drill] [--with-tls]
//
//   --skip-run           rebuild the reports from the last results without running any tests
//   --skip-e2e           skip the Playwright browser tests (system validation will show them as not run)
//   --with-backup-drill  run the TC-Ops-02 backup/restore drill (needs mongodump and mongorestore on PATH)
//   --with-tls           run the TC-Sec-05 HTTPS checks (needs Docker running and openssl)
//
// Environment: MONGO_BASE_URI (default mongodb://127.0.0.1:27017). The tests use the studyplatform_test and
// studyplatform_e2e databases and never touch the application database.
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backend = path.join(root, 'backend')
const frontend = path.join(root, 'frontend')
const out = path.join(root, 'docs', 'test-reports')
const raw = path.join(out, 'raw')
const logs = path.join(raw, 'logs')

const args = new Set(process.argv.slice(2))
const MONGO_BASE = (process.env.MONGO_BASE_URI || 'mongodb://127.0.0.1:27017').replace(/\/$/, '')
const TEST_DB = `${MONGO_BASE}/studyplatform_test`
const E2E_DB = `${MONGO_BASE}/studyplatform_e2e`

// ---------------------------------------------------------------------------------------------------------
// Test-case catalogue (Test Case Document v1.1). `backend` and `frontend` list the unit/API test files that
// support each case; browser tests are matched by the TC ID in their titles.
// ---------------------------------------------------------------------------------------------------------
const TEST_CASES = [
  { id: 'TC-Auth-01', req: 'CSQ-F-001', title: 'Registration', backend: ['registration.integration', 'registrationValidation'], frontend: ['auth.test'] },
  { id: 'TC-Auth-02', req: 'CSQ-F-002', title: 'Login', backend: ['registration.integration'], frontend: ['auth.test'] },
  { id: 'TC-Auth-03', req: 'CSQ-F-003', title: 'Role-based access', backend: ['authorization'], frontend: ['shell.test'] },
  { id: 'TC-Auth-04', req: 'CSQ-F-004', title: 'Logout', backend: ['logout', 'session.integration'], frontend: ['shell.test', 'api.test'] },
  { id: 'TC-Auth-05', req: 'CSQ-F-005', title: 'Password validation', backend: ['registrationValidation'], frontend: ['auth.test'] },
  { id: 'TC-Mat-01', req: 'CSQ-F-010', title: 'Upload study material', backend: ['materialUpload.integration'], frontend: ['materials.test'] },
  { id: 'TC-Mat-02', req: 'CSQ-F-011', title: 'Search material', backend: ['materialSearch.integration', 'materialValidation'], frontend: ['materials.test'] },
  { id: 'TC-Mat-03', req: 'CSQ-F-012', title: 'Download material', backend: ['materialDownload.integration'], frontend: ['materials.test'] },
  { id: 'TC-QB-01', req: 'CSQ-F-020', title: 'Add question', backend: ['questionBank.integration', 'questionValidation'], frontend: ['questionBank.test'] },
  { id: 'TC-QB-02', req: 'CSQ-F-021', title: 'Edit/delete own question', backend: ['questionOwnership.integration'], frontend: ['questionBank.test'] },
  { id: 'TC-QB-03', req: 'CSQ-F-022', title: 'Tag/filter questions', backend: ['questionFilter.integration'], frontend: ['questionBank.test'] },
  { id: 'TC-Quiz-01', req: 'CSQ-F-030', title: 'Create and publish quiz', backend: ['quizValidation', 'quizCreate.integration'], frontend: [] },
  { id: 'TC-Quiz-02', req: 'CSQ-F-031', title: 'Timed quiz attempt and auto-submit', backend: [], frontend: ['quizzes.test'] },
  { id: 'TC-Quiz-03', req: 'CSQ-F-032', title: 'Automatic grading/result', backend: ['quizGrading', 'quizGrading.integration'], frontend: ['quizzes.test'] },
  { id: 'TC-Quiz-04', req: 'CSQ-F-033', title: 'Published quiz listing', backend: ['quizList.integration'], frontend: ['quizzes.test'] },
  { id: 'TC-Quiz-05', req: 'CSQ-F-034', title: 'Delete own quiz', backend: ['quizDelete.integration'], frontend: [] },
  { id: 'TC-Rep-01', req: 'CSQ-F-040', title: 'Student performance page', backend: ['studentPerformance.integration'], frontend: ['reportsAdmin.test'] },
  { id: 'TC-Rep-02', req: 'CSQ-F-041', title: 'Contributor quiz statistics', backend: ['contributorPerformance.integration'], frontend: ['reportsAdmin.test'] },
  { id: 'TC-Adm-01', req: 'CSQ-F-050', title: 'Admin moderation', backend: ['adminModeration.integration'], frontend: ['reportsAdmin.test'] },
  { id: 'TC-Perf-01', req: 'CSQ-NF-001', title: 'Material search performance', backend: ['searchPerformance.integration'], frontend: [], evidence: 'docs/tc-perf-01-search-performance.md' },
  { id: 'TC-Perf-02', req: 'CSQ-NF-002', title: 'Concurrent quiz-result performance', backend: ['quizSubmitPerformance.integration'], frontend: [], evidence: 'docs/tc-perf-02-quiz-result-performance.md' },
  { id: 'TC-Perf-03', req: 'CSQ-NF-006', title: 'Page-load performance', backend: [], frontend: [], evidence: 'docs/tc-perf-03-page-load-performance.md' },
  { id: 'TC-Ops-01', req: 'CSQ-NF-003', title: 'Availability', backend: ['health', 'serverStartup'], frontend: ['shell.test'], evidence: 'docs/availability.md',
    partial: 'The health endpoint, its database check and the status pages are verified. The 99% monthly figure needs a month of uptime monitoring on the deployed server, which a test run cannot produce.' },
  { id: 'TC-Ops-02', req: 'CSQ-NF-007', title: 'Backup and restore', backend: [], frontend: [] },
  { id: 'TC-UX-01', req: 'CSQ-NF-004', title: 'First-time usability', backend: [], frontend: [], manual: 'docs/tc-ux-01-usability-acceptance.md',
    manualNote: 'User trial with 10 first-time participants, recorded by the team in November 2026: 10 of 10 completed all tasks within 10 minutes without help. A usability trial with people cannot be automated; the browser tests cover the same task script.' },
  { id: 'TC-Comp-01', req: 'CSQ-NF-005', title: 'Browser and responsive compatibility', backend: [], frontend: [], evidence: 'docs/compatibility-test-report.md',
    partial: 'Each browser engine is tested at one version (the one bundled with Playwright). Edge is covered by the Chromium engine and Safari by WebKit; the "latest two versions" condition and real Safari/Edge builds still need the manual checks in the compatibility report.' },
  { id: 'TC-Sec-01', req: 'CSQ-SR-001', title: 'Password storage/logging', backend: ['registration.integration'], frontend: [] },
  { id: 'TC-Sec-02', req: 'CSQ-SR-002', title: 'Role check on protected requests', backend: ['authorization', 'adminModeration.integration'], frontend: [] },
  { id: 'TC-Sec-03', req: 'CSQ-SR-003', title: 'Invalid/expired/revoked JWT', backend: ['logout', 'session.integration'], frontend: ['api.test'] },
  { id: 'TC-Sec-04', req: 'CSQ-SR-004', title: 'File type and size validation', backend: ['fileValidation', 'materialUpload.integration'], frontend: ['materials.test'] },
  { id: 'TC-Sec-05', req: 'CSQ-SR-005', title: 'HTTPS/TLS validation', backend: [], frontend: [], evidence: 'docs/https-tls.md' },
  { id: 'TC-Sec-06', req: 'CSQ-SR-006', title: 'Audit logging', backend: ['auditLog'], frontend: [] },
  { id: 'TC-Sec-07', req: 'CSQ-SR-007', title: 'Server-side injection/script validation', backend: ['inputValidation'], frontend: [] },
]

// Defects found while executing the Test Plan. Update the status when a defect is fixed.
const DEFECTS = [
  {
    id: 'D-01', severity: 'High', status: 'Fixed in Sprint 3', testCases: ['TC-Sec-05'],
    title: 'The client sends API requests, including the login password, over plain HTTP when the site is served over HTTPS',
    detail: 'The React client defaults `VITE_API_URL` to `http://localhost:5000` (frontend/src/api.js, LoginPage.jsx, RegistrationPage.jsx, Layout.jsx). With the HTTPS stack running, the page at https://localhost:8443 sent `POST http://localhost:5000/api/auth/login` and `GET http://localhost:5000/api/materials` directly to Node, bypassing Nginx and TLS. Setting `VITE_API_URL` to an empty string does not help because the code uses `||`.',
    fix: 'Default the API base URL to the page origin (an empty string, using `??` instead of `||`) so the client calls `/api/...` on the same HTTPS origin, which Nginx already proxies; the Vite dev proxy keeps local development working.',
  },
  {
    id: 'D-02', severity: 'Medium', status: 'Open', testCases: ['TC-Ops-02'],
    title: 'scripts/backup.sh reports "Backup done" even when mongodump fails',
    detail: 'With mongodump missing from PATH the script printed "Backup done: backup_<time>.gz" and exited 0 although no file was written, so a failing nightly backup would look successful.',
    fix: 'Add `set -euo pipefail` to scripts/backup.sh and scripts/restore.sh.',
  },
  {
    id: 'D-03', severity: 'Medium', status: 'Open', testCases: ['TC-Ops-02'],
    title: 'Nothing schedules the backup every 24 hours',
    detail: 'CSQ-NF-007 requires an automatic backup every 24 hours. The repository has the backup script but no cron entry, scheduled task or deployment configuration that runs it.',
    fix: 'Add a cron entry (for example `0 2 * * * /path/to/scripts/backup.sh`) to the deployment documentation or configuration.',
  },
  {
    id: 'D-04', severity: 'Medium', status: 'Open', testCases: ['TC-Adm-01'],
    title: 'The Admin page lists only the 10 newest materials',
    detail: 'AdminPage loads `GET /api/materials`, the search endpoint, which returns 10 materials per page, and the page has no paging. An admin cannot reach older materials from the moderation page.',
    fix: 'Add paging (or search) to the Admin page.',
  },
  {
    id: 'D-07', severity: 'Medium', status: 'Open', testCases: ['TC-Quiz-05'],
    title: 'A deleted (removed) quiz can be published again and reappears for students',
    detail: '`POST /api/quizzes/:id/publish` sets the status to `published` without checking the current status, so the creator can undo a soft delete, including an Admin removal under CSQ-F-050. Recorded as the to-do test "a removed quiz cannot be published again" in backend/tests/quizCreate.integration.test.js (expected 404, got 200).',
    fix: 'Return 404 "Quiz not found" from the publish route when the quiz status is `removed`, then remove the `todo` option from the test.',
  },
  {
    id: 'D-05', severity: 'High', status: 'Fixed in Sprint 2 (PR #62)', testCases: ['TC-Quiz-02', 'TC-Quiz-03'],
    title: 'Every quiz submission failed with HTTP 500',
    detail: 'The submit route used an update pipeline, which Mongoose 9 rejects unless `updatePipeline: true` is set. Found by the grading tests written for CSQ-F-032.',
    fix: 'Set `updatePipeline: true`. Covered by tests/quizGrading.integration.test.js.',
  },
  {
    id: 'D-06', severity: 'Low', status: 'Fixed in Sprint 1 (PR #45)', testCases: ['TC-Mat-01'],
    title: 'Uploaded file names with non-ASCII characters were stored garbled',
    detail: 'Multer decoded file names as latin1, so "résumé.pdf" was stored as "rÃ©sumÃ©.pdf".',
    fix: 'Set `defParamCharset: "utf8"`. Covered by tests/materialUpload.integration.test.js.',
  },
]

// Differences between the delivered product and the SRS/SAD, to be explained in the final demo.
const DEVIATIONS = [
  ['CSQ-F-030 / SRS 3.1', 'There is no Quiz Builder page. Contributors create and publish quizzes through the REST API (`POST /api/quizzes`, `POST /api/quizzes/:id/publish`), so TC-Quiz-01 is validated through the API.'],
  ['CSQ-F-034', 'There is no contributor "delete quiz" button in the client; the route `DELETE /api/quizzes/:id` exists and TC-Quiz-05 is validated through it. Deletion is a soft delete (status `removed`) so past attempts and reports stay consistent.'],
  ['SAD 4.3 API', 'Quiz attempt routes are under `/api/quizzes/attempts/:id/...` instead of `/api/attempts/:id/...`, students list quizzes with `GET /api/quizzes/published` instead of `GET /api/quizzes`, and admins use `GET /api/quizzes/all`.'],
  ['SAD 4.3.1 error format', 'Errors are returned as `{ "message": "..." }` rather than `{ "error": { "code", "message", "details" } }`. The messages are the exact SRS texts.'],
  ['SRS 3.1 Material Details page', 'Material details (title, subject, topic, size, date, download count) are shown in the search results instead of on a separate page.'],
  ['Test Plan 6 tools', 'Tests use the Node.js test runner with c8 (backend), Vitest with React Testing Library (frontend) and Playwright (system and load tests) instead of Jest, Supertest and k6/Artillery. They cover the same levels and test cases.'],
]

// ---------------------------------------------------------------------------------------------------------
// Running the suites
// ---------------------------------------------------------------------------------------------------------
const runs = []

function run(label, command, { cwd = root, env = {}, allowFailure = true } = {}) {
  process.stdout.write(`\n▶ ${label}\n  ${command}\n`)
  const startedAt = Date.now()
  const result = spawnSync(command, { cwd, shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: { ...process.env, ...env } })
  const durationS = Math.round((Date.now() - startedAt) / 100) / 10
  const output = `${result.stdout || ''}${result.stderr || ''}`
  const logName = `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.log`
  fs.writeFileSync(path.join(logs, logName), output)
  runs.push({ label, command, exitCode: result.status, durationS, log: `raw/logs/${logName}` })
  process.stdout.write(`  exit ${result.status} in ${durationS} s (log: docs/test-reports/raw/logs/${logName})\n`)
  if (result.status !== 0 && !allowFailure) throw new Error(`${label} failed`)
  return { ...result, output }
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return false
  fs.rmSync(to, { recursive: true, force: true })
  fs.cpSync(from, to, { recursive: true })
  return true
}

function copyFile(from, to) {
  if (!fs.existsSync(from)) return false
  fs.copyFileSync(from, to)
  return true
}

function runBackupDrill() {
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csq-backup-drill-'))
  const env = { MONGO_URI: E2E_DB, BACKUP_DIR: backupDir.replace(/\\/g, '/') }
  const counts = () => spawnSync('mongosh', ['--quiet', E2E_DB, '--eval', 'JSON.stringify(Object.fromEntries(db.getCollectionNames().sort().map(c => [c, db.getCollection(c).countDocuments()])))'], { encoding: 'utf8' }).stdout.trim()
  const lines = [`TC-Ops-02 backup and restore drill — ${new Date().toISOString()}`, `Database: ${E2E_DB} (data left by the browser tests)`]
  const before = counts()
  lines.push(`Before backup: ${before}`, '--- 1. Run scripts/backup.sh 9 times; retention must keep the newest 7')
  for (let i = 0; i < 9; i += 1) {
    lines.push(spawnSync('bash', ['scripts/backup.sh'], { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } }).stdout.trim())
    spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 1100)'])
  }
  const backups = fs.readdirSync(backupDir).filter(name => /^backup_.*\.gz$/.test(name)).sort()
  lines.push(`Backups kept: ${backups.length}`)
  if (backups.length === 0) {
    lines.push('RESULT: FAIL — no backup files were written (is mongodump on PATH?)')
    return { passed: false, retentionOk: false, log: lines.join('\n') }
  }
  lines.push('--- 2. Simulate data loss: drop the users, questions, quizzes and materials collections')
  spawnSync('mongosh', ['--quiet', E2E_DB, '--eval', 'db.users.drop(); db.questions.drop(); db.quizzes.drop(); db.materials.drop()'])
  lines.push(`After loss: ${counts()}`)
  const latest = backups.at(-1)
  lines.push(`--- 3. Run scripts/restore.sh on the latest backup (${latest})`)
  const startedAt = Date.now()
  const restore = spawnSync('bash', ['scripts/restore.sh', `${env.BACKUP_DIR}/${latest}`], { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } })
  const restoreMs = Date.now() - startedAt
  lines.push(...`${restore.stdout}${restore.stderr}`.split('\n').filter(line => /restored successfully|Restore done/.test(line)))
  const after = counts()
  lines.push(`After restore: ${after}`, `Restore took ${restoreMs} ms (target: within 4 hours)`)
  const passed = before === after && backups.length === 7
  lines.push(passed ? 'RESULT: PASS — retention kept 7 backups and every collection has the same document count as before the backup' : 'RESULT: FAIL')
  fs.rmSync(backupDir, { recursive: true, force: true })
  return { passed, retentionOk: backups.length === 7, restoreMs, log: lines.join('\n') }
}

async function runTlsChecks() {
  const lines = []
  run('Build frontend for HTTPS check', 'npm run build', { cwd: frontend })
  if (!fs.existsSync(path.join(root, 'deploy', 'certs', 'localhost.crt'))) {
    fs.mkdirSync(path.join(root, 'deploy', 'certs'), { recursive: true })
    spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', 'localhost.key', '-out', 'localhost.crt', '-days', '365', '-nodes',
      '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { cwd: path.join(root, 'deploy', 'certs'), env: { ...process.env, MSYS_NO_PATHCONV: '1' } })
  }
  const server = spawn(process.execPath, ['server.js'], { cwd: backend, env: { ...process.env, NODE_ENV: 'development', PORT: '5000', MONGO_URI: E2E_DB } })
  // host-gateway makes host.docker.internal resolvable, as described in docker-compose.https.yml.
  const override = path.join(os.tmpdir(), 'csq-tls-override.yml')
  fs.writeFileSync(override, 'services:\n  nginx:\n    extra_hosts:\n      - "host.docker.internal:host-gateway"\n')
  try {
    await new Promise(resolve => setTimeout(resolve, 4000))
    run('Start Nginx HTTPS stack', `docker compose -f docker-compose.https.yml -f "${override}" up -d --force-recreate`)
    await new Promise(resolve => setTimeout(resolve, 4000))
    const check = run('TC-Sec-05 check-tls', 'bash scripts/check-tls.sh 8080 8443')
    lines.push(check.output.trim())
    // Records which URLs the client calls when it is served over HTTPS (TC-Sec-05 step 4).
    const probeFile = path.join(frontend, 'test-results', 'tls-probe.cjs')
    fs.mkdirSync(path.dirname(probeFile), { recursive: true })
    fs.writeFileSync(probeFile, `const { chromium } = require('@playwright/test')
;(async () => {
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage()
  const seen = []
  page.on('request', request => { if (request.url().includes('/api/')) seen.push(request.method() + ' ' + request.url()) })
  await page.goto('https://localhost:8443/#/login')
  await page.getByLabel('Email address').fill('admin@e2e.test')
  await page.getByLabel('Password').fill('AdminPass123')
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.waitForTimeout(1500)
  await page.goto('https://localhost:8443/#/materials')
  await page.waitForTimeout(1500)
  console.log('Page origin: ' + new URL(page.url()).origin)
  console.log(seen.join('\\n'))
  await browser.close()
})()
`)
    const probe = run('TC-Sec-05 client API URLs', 'node test-results/tls-probe.cjs', { cwd: frontend })
    lines.push('', '--- Step 4: API requests made by the client served over HTTPS', probe.output.trim())
    const tlsPassed = /All performed checks PASSED/.test(check.output)
    const insecureCalls = probe.output.split('\n').filter(line => line.includes('http://'))
    return { tlsPassed, insecureCalls, checkedAt: new Date().toISOString().slice(0, 10), log: lines.join('\n') }
  } finally {
    run('Stop Nginx HTTPS stack', `docker compose -f docker-compose.https.yml -f "${override}" down`)
    server.kill()
  }
}

// ---------------------------------------------------------------------------------------------------------
// Reading results
// ---------------------------------------------------------------------------------------------------------
// The load scripts print their results as the last JSON object in their output.
function lastJson(output) {
  const start = output.lastIndexOf('\n{')
  try {
    return start >= 0 ? JSON.parse(output.slice(start + 1, output.lastIndexOf('}') + 1)) : null
  } catch {
    return null
  }
}

function readJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null
}

function decodeXml(text) {
  return text.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

// Vitest JUnit output: one <testsuite> per file, one <testcase> per test.
function readVitestJunit(file) {
  if (!fs.existsSync(file)) return []
  const xml = fs.readFileSync(file, 'utf8')
  const tests = []
  for (const match of xml.matchAll(/<testcase classname="([^"]*)" name="([^"]*)" time="([^"]*)"[^>]*?(\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const body = match[5] || ''
    tests.push({
      file: decodeXml(match[1]),
      name: decodeXml(match[2]),
      durationMs: Math.round(Number(match[3]) * 10000) / 10,
      status: /<failure/.test(body) ? 'failed' : /<skipped/.test(body) ? 'skipped' : 'passed',
      error: (body.match(/<failure message="([^"]*)"/) || [])[1],
    })
  }
  return tests
}

// Playwright JSON output: suites nest by file and describe block; each spec has one test per project.
function readPlaywright(file) {
  const report = readJson(file)
  if (!report) return { tests: [], pageLoad: null }
  const tests = []
  let pageLoad = null
  const walk = (suite, titles) => {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests) {
        const last = test.results.at(-1) || {}
        const status = test.status === 'skipped' ? 'skipped' : test.status === 'expected' ? 'passed' : test.status === 'flaky' ? 'flaky' : 'failed'
        tests.push({
          file: spec.file, project: test.projectName, name: [...titles, spec.title].join(' › '), title: spec.title,
          status, durationMs: last.duration ?? 0, error: last.error?.message?.split('\n')[0],
        })
        for (const attachment of last.attachments || []) {
          if (attachment.name === 'page-load-results.json' && attachment.body) pageLoad = JSON.parse(Buffer.from(attachment.body, 'base64').toString('utf8'))
        }
      }
    }
    for (const child of suite.suites || []) walk(child, child.title && !child.title.endsWith('.js') ? [...titles, child.title] : titles)
  }
  for (const suite of report.suites || []) walk(suite, [])
  return { tests, pageLoad, stats: report.stats }
}

function relativeTo(base, file) {
  return path.relative(base, file).replace(/\\/g, '/')
}

function readCoverage(dir) {
  const summary = readJson(path.join(dir, 'coverage-summary.json'))
  const detail = readJson(path.join(dir, 'coverage-final.json'))
  if (!summary) return null
  const files = Object.entries(summary).filter(([key]) => key !== 'total').map(([file, metrics]) => ({ file: relativeTo(path.dirname(dir), file), ...metrics }))
  // Uncovered branch paths from the Istanbul detail file: one entry per branch path that never ran.
  const uncovered = {}
  for (const [file, data] of Object.entries(detail || {})) {
    const name = relativeTo(path.dirname(dir), file)
    for (const [id, counts] of Object.entries(data.b || {})) {
      const branch = data.branchMap[id]
      counts.forEach((count, i) => {
        if (count > 0) return
        const location = branch.locations?.[i] || branch.loc
        ;(uncovered[name] ||= []).push({ line: location?.start?.line ?? branch.line, type: branch.type, path: i })
      })
    }
  }
  return { total: summary.total, files, uncovered }
}

// ---------------------------------------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------------------------------------
const pct = value => `${Number(value).toFixed(1)}%`
const ICON = { PASS: '✅ Pass', FAIL: '❌ Fail', PARTIAL: '🟡 Partial', MANUAL: '📝 Manual (recorded)', 'NOT RUN': '⚪ Not run' }

function table(headers, rows) {
  const escape = cell => String(cell ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
  return [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map(row => `| ${row.map(escape).join(' | ')} |`)].join('\n')
}

function counts(tests) {
  const c = { total: tests.length, passed: 0, failed: 0, skipped: 0, flaky: 0, durationMs: 0 }
  for (const test of tests) {
    if (test.status === 'passed') c.passed += 1
    else if (test.status === 'failed') c.failed += 1
    else if (test.status === 'flaky') c.flaky += 1
    else c.skipped += 1
    c.durationMs += test.durationMs || 0
  }
  return c
}

function header(title, info) {
  return [
    `# ${title}`,
    '',
    '**Project:** Collaborative Study Material & Quiz Platform (Project #21)  ',
    `**Generated:** ${info.date} by \`node scripts/generate-test-reports.mjs\`  `,
    `**Code version:** commit \`${info.commit}\` on branch \`${info.branch}\`  `,
    `**Environment:** ${info.os}; Node.js ${info.node}; MongoDB ${info.mongo}`,
    '',
  ].join('\n')
}

function gitValue(gitArgs) {
  return spawnSync('git', gitArgs, { cwd: root, encoding: 'utf8' }).stdout.trim()
}

// ---------------------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------------------
async function main() {
  fs.mkdirSync(logs, { recursive: true })
  const extras = readJson(path.join(raw, 'extra-checks.json')) || {}

  if (!args.has('--skip-run')) {
    // 1. Backend unit and API integration tests with code and branch coverage. Files run one at a time so the
    //    load tests (TC-Perf-01, TC-Perf-02) are not slowed down by other test files running in parallel.
    run('Backend unit and integration tests', 'npm run test:coverage -- --test-concurrency=1', { cwd: backend, env: { NODE_ENV: 'test', MONGO_URI: TEST_DB } })
    // 2. Frontend unit tests with coverage.
    run('Frontend unit tests', 'npm run test:coverage', { cwd: frontend })
    // 3. System validation in real browsers.
    if (!args.has('--skip-e2e')) run('System validation browser tests', 'npx playwright test', { cwd: frontend, env: { E2E_MONGO_URI: E2E_DB } })
    // 4. The team's load scripts for TC-Perf-01 and TC-Perf-02, which print full timing statistics.
    //    Both are given a dedicated database: perf:quiz-submit otherwise falls back to the application database.
    const perfEnv = { NODE_ENV: 'test', PERF_MONGO_URI: `${MONGO_BASE}/studyplatform_perf` }
    extras.perfSearch = lastJson(run('TC-Perf-01 load script', 'npm run perf:search', { cwd: backend, env: perfEnv }).output)
    extras.perfQuizSubmit = lastJson(run('TC-Perf-02 load script', 'npm run perf:quiz-submit', { cwd: backend, env: perfEnv }).output)
    // 5. TC-Perf-03 page-load model from the team's report (uses the production build).
    run('Frontend production build', 'npm run build', { cwd: frontend })
    extras.pageLoadModel = run('TC-Perf-03 page-load model', 'node scripts/measure-page-load.js').output
    // 6. Operational and deployment checks that need extra tools.
    if (args.has('--with-backup-drill')) extras.backupDrill = runBackupDrill()
    if (args.has('--with-tls')) extras.tls = await runTlsChecks()
    fs.writeFileSync(path.join(raw, 'extra-checks.json'), `${JSON.stringify(extras, null, 2)}\n`)
  }

  // Keep the raw results and the HTML reports with the documentation.
  copyFile(path.join(backend, 'coverage', 'test-results.json'), path.join(raw, 'backend-test-results.json'))
  copyFile(path.join(backend, 'coverage', 'junit.xml'), path.join(raw, 'backend-junit.xml'))
  copyFile(path.join(backend, 'coverage', 'coverage-summary.json'), path.join(raw, 'backend-coverage-summary.json'))
  copyFile(path.join(backend, 'coverage', 'lcov.info'), path.join(raw, 'backend-lcov.info'))
  copyFile(path.join(frontend, 'coverage', 'junit.xml'), path.join(raw, 'frontend-junit.xml'))
  copyFile(path.join(frontend, 'coverage', 'coverage-summary.json'), path.join(raw, 'frontend-coverage-summary.json'))
  copyFile(path.join(frontend, 'coverage', 'lcov.info'), path.join(raw, 'frontend-lcov.info'))
  copyFile(path.join(frontend, 'test-results', 'e2e-results.json'), path.join(raw, 'e2e-results.json'))
  copyFile(path.join(frontend, 'test-results', 'e2e-junit.xml'), path.join(raw, 'e2e-junit.xml'))
  if (extras.backupDrill) fs.writeFileSync(path.join(raw, 'tc-ops-02-backup-drill.log'), `${extras.backupDrill.log}\n`)
  if (extras.tls) fs.writeFileSync(path.join(raw, 'tc-sec-05-tls-check.log'), `${extras.tls.log}\n`)
  if (extras.pageLoadModel) fs.writeFileSync(path.join(raw, 'tc-perf-03-page-load-model.log'), extras.pageLoadModel)

  const html = path.join(out, 'html')
  const backendHtml = copyDir(path.join(backend, 'coverage', 'lcov-report'), path.join(html, 'backend-coverage'))
  const frontendHtml = copyDir(path.join(frontend, 'coverage'), path.join(html, 'frontend-coverage'))
  // Keep only Vitest's HTML report; lcov-report is a second copy of it.
  if (frontendHtml) for (const extra of ['coverage-final.json', 'lcov.info', 'junit.xml', 'coverage-summary.json', 'lcov-report']) fs.rmSync(path.join(html, 'frontend-coverage', extra), { recursive: true, force: true })
  const e2eHtml = copyDir(path.join(frontend, 'playwright-report'), path.join(html, 'e2e-report'))

  const backendTests = (readJson(path.join(raw, 'backend-test-results.json'))?.tests || []).map(test => ({ ...test, suite: 'backend' }))
  const frontendTests = readVitestJunit(path.join(raw, 'frontend-junit.xml')).map(test => ({ ...test, suite: 'frontend' }))
  const e2e = readPlaywright(path.join(raw, 'e2e-results.json'))
  const backendCoverage = readCoverage(path.join(backend, 'coverage'))
  const frontendCoverage = readCoverage(path.join(frontend, 'coverage'))

  const mongoVersion = spawnSync('mongosh', ['--quiet', MONGO_BASE, '--eval', 'db.version()'], { encoding: 'utf8' }).stdout.trim() || 'unknown'
  const browserVersions = spawnSync(process.execPath, ['-e', [
    "const pw = require('@playwright/test');",
    "(async () => { const out = {}; for (const name of ['chromium', 'firefox', 'webkit']) { try { const b = await pw[name].launch(); out[name] = b.version(); await b.close() } catch { out[name] = 'not installed' } } console.log(JSON.stringify(out)) })()",
  ].join(' ')], { cwd: frontend, encoding: 'utf8' }).stdout.trim()
  const info = {
    date: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
    commit: gitValue(['rev-parse', '--short', 'HEAD']),
    branch: gitValue(['rev-parse', '--abbrev-ref', 'HEAD']),
    os: `${os.type()} ${os.release()} (${os.cpus()[0]?.model.trim()}, ${Math.round(os.totalmem() / 2 ** 30)} GB RAM)`,
    node: process.version,
    mongo: mongoVersion,
    browsers: browserVersions ? JSON.parse(browserVersions) : {},
  }

  // --------------------------------------------- Unit Test Report ---------------------------------------------
  const levelOf = file => (/searchPerformance|quizSubmitPerformance/.test(file) ? 'Load (NFR)' : /\.integration\.test\.js$/.test(file) || /serverStartup|health/.test(file) ? 'API integration' : 'Unit')
  const byFile = tests => Object.values(tests.reduce((groups, test) => ((groups[test.file] ||= { file: test.file, tests: [] }).tests.push(test), groups), {}))
  const backendFiles = byFile(backendTests).map(group => ({ ...group, level: levelOf(group.file), ...counts(group.tests) })).sort((a, b) => a.level.localeCompare(b.level) || a.file.localeCompare(b.file))
  const frontendFiles = byFile(frontendTests).map(group => ({ ...group, level: 'Unit (component)', ...counts(group.tests) })).sort((a, b) => a.file.localeCompare(b.file))
  const levelTotals = level => counts(backendTests.filter(test => levelOf(test.file) === level))
  const b = counts(backendTests)
  const f = counts(frontendTests)
  const failures = [...backendTests, ...frontendTests].filter(test => test.status === 'failed')
  const todos = backendTests.filter(test => test.status === 'todo')
  const unitLines = [
    header('Unit Test Report', info),
    'This report covers Test Plan level 1 (unit testing) and level 2 (integration/API testing): validation rules, grading and report calculations, token handling, middleware, every REST endpoint against a real MongoDB database, and every React page against a simulated API. Browser end-to-end results are in the [System Validation Report](system-validation-report.md).',
    '',
    '## Summary',
    '',
    table(['Suite', 'Level', 'Test files', 'Tests', 'Passed', 'Failed', 'Skipped or to-do', 'Duration'], [
      ['Backend', 'Unit', backendFiles.filter(g => g.level === 'Unit').length, levelTotals('Unit').total, levelTotals('Unit').passed, levelTotals('Unit').failed, levelTotals('Unit').skipped, `${(levelTotals('Unit').durationMs / 1000).toFixed(1)} s`],
      ['Backend', 'API integration (real MongoDB)', backendFiles.filter(g => g.level === 'API integration').length, levelTotals('API integration').total, levelTotals('API integration').passed, levelTotals('API integration').failed, levelTotals('API integration').skipped, `${(levelTotals('API integration').durationMs / 1000).toFixed(1)} s`],
      ['Backend', 'Load (NFR)', backendFiles.filter(g => g.level === 'Load (NFR)').length, levelTotals('Load (NFR)').total, levelTotals('Load (NFR)').passed, levelTotals('Load (NFR)').failed, levelTotals('Load (NFR)').skipped, `${(levelTotals('Load (NFR)').durationMs / 1000).toFixed(1)} s`],
      ['Frontend', 'Unit (React components)', frontendFiles.length, f.total, f.passed, f.failed, f.skipped, `${(f.durationMs / 1000).toFixed(1)} s`],
      ['**Total**', '', backendFiles.length + frontendFiles.length, b.total + f.total, b.passed + f.passed, b.failed + f.failed, b.skipped + f.skipped, `${((b.durationMs + f.durationMs) / 1000).toFixed(1)} s`],
    ]),
    '',
    `**Result: ${failures.length === 0 ? `all ${b.passed + f.passed} runnable tests passed` : `${failures.length} of ${b.total + f.total} tests failed`}.**`,
    '',
    ...todos.map(test => `A to-do test documents an open defect and does not fail the suite: \`${test.file}\` — "${test.name}" (${test.todo}).`),
    ...(todos.length ? [''] : []),
    '## How to run',
    '',
    '```bash',
    '# Backend (MongoDB running; uses the studyplatform_test database)',
    'cd backend && NODE_ENV=test MONGO_URI=mongodb://127.0.0.1:27017/studyplatform_test npm run test:coverage',
    '# Frontend',
    'cd frontend && npm run test:coverage',
    '```',
    '',
    'Without `MONGO_URI`, `npm test` in `backend` still runs the unit tests and skips the database tests.',
    '',
  ]
  if (failures.length) {
    unitLines.push('## Failures', '', table(['Suite', 'File', 'Test', 'Message'], failures.map(t => [t.suite, t.file, t.name, t.error || ''])), '')
  }
  unitLines.push('## Backend results by file', '', table(['File', 'Level', 'Tests', 'Passed', 'Failed', 'Duration'], backendFiles.map(g => [`\`${g.file}\``, g.level, g.total, g.passed, g.failed, `${(g.durationMs / 1000).toFixed(2)} s`])), '')
  unitLines.push('## Frontend results by file', '', table(['File', 'Tests', 'Passed', 'Failed', 'Duration'], frontendFiles.map(g => [`\`frontend/${g.file}\``, g.total, g.passed, g.failed, `${(g.durationMs / 1000).toFixed(2)} s`])), '')
  unitLines.push('## Every test', '')
  for (const [suite, groups] of [['backend', backendFiles], ['frontend', frontendFiles]]) {
    for (const group of groups) {
      unitLines.push(`<details><summary><code>${suite}/${group.file}</code> — ${group.passed}/${group.total} passed</summary>`, '')
      unitLines.push(...group.tests.map(test => `- ${{ passed: '✅', failed: '❌', todo: '🐞 to-do' }[test.status] || '⏭️'} ${test.name} (${test.durationMs} ms)${test.todo ? ` — ${test.todo}` : ''}`), '', '</details>', '')
    }
  }
  unitLines.push('Raw results: [backend JSON](raw/backend-test-results.json), [backend JUnit](raw/backend-junit.xml), [frontend JUnit](raw/frontend-junit.xml). Logs: [raw/logs](raw/logs).', '')
  fs.writeFileSync(path.join(out, 'unit-test-report.md'), unitLines.join('\n'))

  // ------------------------------------------ System Validation Report ------------------------------------------
  const systemTests = e2e.tests.filter(test => test.project === 'system-chromium')
  const compatTests = e2e.tests.filter(test => test.project.startsWith('compat-'))
  const findTagged = (tests, id) => tests.filter(test => test.name.includes(`${id}:`) || test.name.includes(`(${id}`) || test.name.includes(` ${id})`) || test.name.includes(`, ${id}`))
  const baseName = file => path.basename(file).replace(/\.test\.jsx?$/, '')
  const linked = (tests, files) => tests.filter(test => files.some(name => baseName(test.file) === name.replace(/\.test$/, '')))
  const e2eRan = e2e.tests.length > 0

  const results = TEST_CASES.map((tc) => {
    const browser = tc.id === 'TC-Comp-01' ? compatTests : findTagged(systemTests, tc.id)
    // To-do tests document open defects, which are reported through DEFECTS rather than as passing or failing support.
    const supporting = [...linked(backendTests, tc.backend), ...linked(frontendTests, tc.frontend)].filter(test => test.status !== 'todo')
    const all = [...browser, ...supporting]
    const failed = all.filter(test => test.status === 'failed')
    const openDefects = DEFECTS.filter(defect => defect.status === 'Open' && defect.testCases.includes(tc.id))
    let status
    let evidence = []
    if (tc.manual) {
      status = 'MANUAL'
      evidence.push(`${tc.manualNote} See [${path.basename(tc.manual)}](../${path.basename(tc.manual)}).`)
    } else if (tc.id === 'TC-Ops-02') {
      if (extras.backupDrill) {
        status = extras.backupDrill.passed ? (openDefects.length ? 'PARTIAL' : 'PASS') : 'FAIL'
        evidence.push(`Backup/restore drill: retention ${extras.backupDrill.retentionOk ? 'kept exactly 7 backups' : 'did not keep 7 backups'}; restore of the latest backup took ${extras.backupDrill.restoreMs} ms and restored every collection ([log](raw/tc-ops-02-backup-drill.log)).`)
      } else {
        status = 'NOT RUN'
        evidence.push('Run with `--with-backup-drill` (needs mongodump/mongorestore).')
      }
    } else if (tc.id === 'TC-Sec-05') {
      if (extras.tls) {
        // The browser test checks that the client keeps every API request on the page origin; when it ran,
        // it replaces the URL probe from the last --with-tls run, which may predate a client change.
        const clientOk = browser.length ? failed.length === 0 : extras.tls.insecureCalls.length === 0
        status = extras.tls.tlsPassed && clientOk ? 'PASS' : 'FAIL'
        evidence.push(`Nginx checks with scripts/check-tls.sh${extras.tls.checkedAt ? ` (run ${extras.tls.checkedAt})` : ''}: ${extras.tls.tlsPassed ? 'HTTP → 301 to HTTPS, HSTS present, TLS 1.2 and 1.3 accepted, TLS 1.1 rejected' : 'failed'} ([log](raw/tc-sec-05-tls-check.log)).`)
        evidence.push(browser.length
          ? `Client API requests: ${clientOk ? 'every request stayed on the page origin, so the client never bypasses HTTPS' : 'some requests left the page origin'} (browser test).`
          : `Client API requests over plain HTTP: ${extras.tls.insecureCalls.length ? extras.tls.insecureCalls.map(call => `\`${call}\``).join(', ') : 'none'}.`)
      } else {
        status = 'NOT RUN'
        evidence.push('Run with `--with-tls` (needs Docker running).')
      }
    } else if (all.length === 0 && !(tc.id === 'TC-Perf-03' && e2e.pageLoad)) {
      status = 'NOT RUN'
    } else {
      status = failed.length ? 'FAIL' : tc.partial || openDefects.length ? 'PARTIAL' : 'PASS'
    }
    if (tc.id === 'TC-Perf-03' && e2e.pageLoad) {
      evidence.push(`Real browser loads of the production build at 10 Mbps: ${e2e.pageLoad.loads} loads, ${e2e.pageLoad.withinTargetPercent}% within 3 s, p95 ${e2e.pageLoad.p95Ms} ms.`)
      if (!e2e.pageLoad.loads || e2e.pageLoad.withinTargetPercent < 95) status = 'FAIL'
    }
    const load = { 'TC-Perf-01': extras.perfSearch, 'TC-Perf-02': extras.perfQuizSubmit }[tc.id]
    if (load) {
      const volume = tc.id === 'TC-Perf-01' ? `${load.searches} searches over ${load.materialsStored} materials` : `${load.submissions} simultaneous submissions`
      evidence.push(`Load script (\`npm run ${tc.id === 'TC-Perf-01' ? 'perf:search' : 'perf:quiz-submit'}\`): ${volume}, p50 ${load.p50Ms} ms, **p95 ${load.p95Ms} ms**, max ${load.maxMs} ms, ${load.withinTargetPercent}% within ${load.targetMs / 1000} s, ${load.failures.length} failed requests.`)
      if (!load.passed) status = 'FAIL'
    }
    if (tc.partial) evidence.push(tc.partial)
    if (tc.evidence) evidence.push(`Team report: [${path.basename(tc.evidence)}](../${path.basename(tc.evidence)}).`)
    if (openDefects.length) evidence.push(`Open defect${openDefects.length > 1 ? 's' : ''}: ${openDefects.map(d => d.id).join(', ')}.`)
    return { ...tc, status, browser, supporting, failed, evidence }
  })

  fs.writeFileSync(path.join(raw, 'test-case-results.json'), `${JSON.stringify(results.map(r => ({
    id: r.id, requirement: r.req, title: r.title, status: r.status,
    browserTests: { passed: r.browser.filter(t => t.status === 'passed').length, total: r.browser.length, files: [...new Set(r.browser.map(t => `frontend/e2e/${path.basename(t.file)}`))] },
    supportingTests: { passed: r.supporting.filter(t => t.status === 'passed').length, total: r.supporting.length, files: [...new Set(r.supporting.map(t => (t.suite === 'frontend' ? `frontend/${t.file}` : `backend/${t.file}`)))] },
    evidence: r.evidence,
  })), null, 2)}\n`)

  const statusCount = Object.keys(ICON).map(key => [key, results.filter(r => r.status === key).length]).filter(([, n]) => n > 0)
  const sys = counts(systemTests)
  const comp = counts(compatTests)
  const sysLines = [
    header('System Validation Report', info),
    'This report records the execution of every test case in the Test Case Document (TC-Auth-01 to TC-Sec-07) against the integrated system: the React client, the Express API and MongoDB, driven through real browsers by Playwright (Test Plan level 3, system testing, and level 4, acceptance). Each test case also lists the unit and API tests that support it ([Unit Test Report](unit-test-report.md)).',
    '',
    '## Summary',
    '',
    table(['Result', 'Test cases'], statusCount.map(([key, n]) => [ICON[key], n])),
    '',
    `**${results.length} test cases executed or dispositioned.** Browser runs: ${sys.passed}/${sys.total} system tests passed in Chromium; ${comp.passed}/${comp.total} compatibility runs passed across ${new Set(compatTests.map(t => t.project)).size} browser/width combinations.`,
    '',
    '**Exit criteria (Test Plan section 5):**',
    '',
    `- All High-priority functional requirements verified: ${results.filter(r => r.req.startsWith('CSQ-F') && r.status === 'FAIL').length === 0 ? 'yes' : 'no'}.`,
    `- No High-priority NFR failed: ${results.filter(r => ['TC-Perf-01', 'TC-Perf-02', 'TC-Comp-01'].includes(r.id) && r.status === 'FAIL').length === 0 ? 'yes' : 'no'}.`,
    `- TC-Sec-01 to TC-Sec-07 pass with no open critical defect: ${results.filter(r => r.id.startsWith('TC-Sec') && r.status !== 'PASS').length === 0 ? 'yes' : `no — ${results.filter(r => r.id.startsWith('TC-Sec') && r.status !== 'PASS').map(r => r.id).join(', ')} (see defects)`}.`,
    '',
    '## Test environment',
    '',
    table(['Item', 'Value'], [
      ['Machine', info.os],
      ['Runtime', `Node.js ${info.node}, MongoDB ${info.mongo}`],
      ['Browsers (Playwright)', Object.entries(info.browsers).map(([name, version]) => `${name} ${version}`).join(', ')],
      ['Viewports', 'System tests 1280 × 800; compatibility 360 × 740, 768 × 1024, 1920 × 1080'],
      ['Test data', 'Accounts, materials, questions and quizzes created by each test through the UI or REST API in the `studyplatform_e2e` database; one Admin account seeded by the test setup'],
    ]),
    '',
    '## Results by test case',
    '',
    table(['Test case', 'Requirement', 'Title', 'Browser tests', 'Supporting unit/API tests', 'Result'], results.map(r => [
      r.id, r.req, r.title,
      r.browser.length ? `${r.browser.filter(t => t.status === 'passed').length}/${r.browser.length} passed` : '—',
      r.supporting.length ? `${r.supporting.filter(t => t.status === 'passed').length}/${r.supporting.length} passed` : '—',
      ICON[r.status],
    ])),
    '',
    '## Test case details',
    '',
  ]
  for (const r of results) {
    sysLines.push(`### ${r.id} — ${r.title} (${r.req}): ${ICON[r.status]}`, '')
    for (const test of r.browser.filter(t => r.id !== 'TC-Comp-01')) sysLines.push(`- ${test.status === 'passed' ? '✅' : '❌'} Browser: ${test.title} (${(test.durationMs / 1000).toFixed(1)} s)${test.error ? ` — ${test.error}` : ''}`)
    if (r.id === 'TC-Comp-01' && r.browser.length) sysLines.push(`- Compatibility matrix below: ${r.browser.filter(t => t.status === 'passed').length}/${r.browser.length} runs passed.`)
    if (r.supporting.length) {
      const files = [...new Set(r.supporting.map(t => (t.suite === 'frontend' ? `frontend/${t.file}` : `backend/${t.file}`)))]
      sysLines.push(`- Supporting tests: ${r.supporting.filter(t => t.status === 'passed').length}/${r.supporting.length} passed in ${files.map(file => `\`${file}\``).join(', ')}.`)
    }
    for (const failed of r.failed) sysLines.push(`- ❌ Failed: ${failed.name}${failed.error ? ` — ${failed.error}` : ''}`)
    for (const line of r.evidence) sysLines.push(`- ${line}`)
    if (!r.browser.length && !r.supporting.length && !r.evidence.length) sysLines.push('- Not executed in this run.')
    sysLines.push('')
  }

  if (compatTests.length) {
    const projects = [...new Set(compatTests.map(t => t.project))]
    const engines = [...new Set(projects.map(p => p.split('-')[1]))]
    const widthNames = [...new Set(projects.map(p => p.split('-').slice(2).join('-')))]
    sysLines.push('## Compatibility matrix (TC-Comp-01)', '', 'Each cell is the core workflows (student: log in, search and download material, take a timed quiz; contributor: upload form and question bank) with a check that the page never scrolls sideways.', '')
    sysLines.push(table(['Engine (stands in for)', ...widthNames.map(w => `${w.replace('-', ' ')} px`)], engines.map(engine => [
      `${engine} ${info.browsers[engine] || ''} (${{ chromium: 'Chrome, Edge', firefox: 'Firefox', webkit: 'Safari' }[engine]})`,
      ...widthNames.map(width => {
        const cell = compatTests.filter(t => t.project === `compat-${engine}-${width}`)
        return `${cell.every(t => t.status === 'passed') ? '✅' : '❌'} ${cell.filter(t => t.status === 'passed').length}/${cell.length}`
      }),
    ])), '')
  }

  if (e2e.pageLoad) {
    sysLines.push('## Page-load measurements (TC-Perf-03)', '', `Production build in Chromium, ${e2e.pageLoad.network}; time from navigation until the page's content and API data are shown.`, '')
    sysLines.push(table(['Page', 'Route', 'Loads', 'Mean', 'p50', 'p95', 'Max'], e2e.pageLoad.pages.map(p => [p.page, `\`${p.route}\``, p.loads, `${p.meanMs} ms`, `${p.p50Ms} ms`, `${p.p95Ms} ms`, `${p.maxMs} ms`])), '')
    sysLines.push(`Across all ${e2e.pageLoad.loads} loads: **p95 ${e2e.pageLoad.p95Ms} ms, ${e2e.pageLoad.withinTargetPercent}% within 3 s** (target: 95% within 3 s). The team's model-based measurement is in [tc-perf-03-page-load-performance.md](../tc-perf-03-page-load-performance.md) and was re-run here ([log](raw/tc-perf-03-page-load-model.log)).`, '')
  }

  sysLines.push('## Defects', '', table(['ID', 'Severity', 'Status', 'Test cases', 'Defect'], DEFECTS.map(d => [d.id, d.severity, d.status, d.testCases.join(', '), d.title])), '')
  for (const d of DEFECTS) sysLines.push(`**${d.id} — ${d.title}.** ${d.detail} *Fix:* ${d.fix}`, '')
  sysLines.push('## Deviations from the SRS/SAD', '', table(['Reference', 'Deviation'], DEVIATIONS), '')
  sysLines.push('## Observations', '', '- TC-Sec-07: a MongoDB operator in the query string (`?subject[$ne]=x`) is not rejected with 400, but Express 5 passes it to the search as a plain parameter named `subject[$ne]`, which is ignored, so it never reaches the database. Operators in JSON bodies and script or SQL-style text are rejected with 400.', '- TC-Perf-01 and TC-Perf-02 are run with one test file at a time. When the backend suite runs all files in parallel on a busy machine, the 100-submission load test can miss its 3 s target because the other test files compete for the same CPU.', '')
  sysLines.push('## Re-running', '', '```bash', 'node scripts/generate-test-reports.mjs --with-backup-drill --with-tls', '```', '', `Browser test report: [html/e2e-report/index.html](html/e2e-report/index.html). Commands and exit codes of this run: ${runs.length ? runs.map(r => `${r.label} (exit ${r.exitCode}, ${r.durationS} s, [log](${r.log}))`).join('; ') : 'reports rebuilt from earlier results'}.`, '')
  fs.writeFileSync(path.join(out, 'system-validation-report.md'), sysLines.join('\n'))

  // ------------------------------------------ Coverage reports ------------------------------------------
  const metricsRow = (name, total) => [name, `${pct(total.statements.pct)} (${total.statements.covered}/${total.statements.total})`, `${pct(total.lines.pct)} (${total.lines.covered}/${total.lines.total})`, `${pct(total.functions.pct)} (${total.functions.covered}/${total.functions.total})`, `${pct(total.branches.pct)} (${total.branches.covered}/${total.branches.total})`]
  const combine = (a, bb, key) => {
    const covered = a[key].covered + bb[key].covered
    const total = a[key].total + bb[key].total
    return { covered, total, pct: total ? (covered / total) * 100 : 100 }
  }
  const combined = backendCoverage && frontendCoverage ? Object.fromEntries(['statements', 'lines', 'functions', 'branches'].map(key => [key, combine(backendCoverage.total, frontendCoverage.total, key)])) : null
  const coverageExplained = [
    '- **Database and server failure branches.** Most uncovered backend lines are `catch` blocks that turn an unexpected MongoDB error into a 500/503 response, and `readyState !== 1` checks for a lost database connection. The tests run against a working database, so these paths only run if MongoDB fails mid-request.',
    '- **`server.js`** lines 17–21 run only when the file is started directly with a failing database connection.',
    '- **Frontend effects and timers.** The remaining frontend gaps are cancellation guards for requests that finish after a page is closed, the quiz session heartbeat that runs once a minute, and a few defensive fallbacks for missing API fields.',
  ]
  // Uncovered line numbers per backend file, from the LCOV data, for the coverage table.
  const lcov = fs.existsSync(path.join(raw, 'backend-lcov.info')) ? fs.readFileSync(path.join(raw, 'backend-lcov.info'), 'utf8') : ''
  const missedLines = {}
  for (const block of lcov.split('end_of_record')) {
    const source = (block.match(/^SF:(.*)$/m) || [])[1]
    if (!source) continue
    // c8 writes paths relative to backend/; resolve them so absolute and relative paths both work.
    missedLines[relativeTo(backend, path.resolve(backend, source.trim()))] = [...block.matchAll(/^DA:(\d+),0$/gm)].map(match => Number(match[1]))
  }
  const ranges = lines => lines.reduce((acc, line) => {
    const last = acc.at(-1)
    if (last && line === last[1] + 1) last[1] = line
    else acc.push([line, line])
    return acc
  }, []).map(([start, end]) => (start === end ? `${start}` : `${start}–${end}`)).join(', ')
  const coverageLines = [
    header('Code Coverage Report', info),
    'Statement, line and function coverage of the application code by the unit and API integration tests in the [Unit Test Report](unit-test-report.md). Backend coverage is measured with c8 (V8 coverage) across `app.js`, `server.js`, `routes/`, `middleware/`, `models/` and `utils/`, including files no test loads. Frontend coverage is measured with Vitest (V8 coverage) across `frontend/src`, excluding test files and the `main.jsx` entry point. Branch coverage is detailed in the [Branch Coverage Report](branch-coverage-report.md).',
    '',
    '## Summary',
    '',
    table(['Code', 'Statements', 'Lines', 'Functions', 'Branches'], [
      ...(backendCoverage ? [metricsRow('Backend (Node/Express)', backendCoverage.total)] : []),
      ...(frontendCoverage ? [metricsRow('Frontend (React)', frontendCoverage.total)] : []),
      ...(combined ? [metricsRow('**Whole application**', combined)] : []),
    ]),
    '',
    `HTML reports with line-by-line highlighting: [backend](html/backend-coverage/index.html)${backendHtml ? '' : ' (missing)'}, [frontend](html/frontend-coverage/index.html)${frontendHtml ? '' : ' (missing)'}. LCOV files: [backend](raw/backend-lcov.info), [frontend](raw/frontend-lcov.info).`,
    '',
    '## Backend coverage by file',
    '',
    table(['File', 'Statements', 'Lines', 'Functions', 'Branches', 'Uncovered lines'], (backendCoverage?.files || []).sort((x, y) => x.lines.pct - y.lines.pct || x.file.localeCompare(y.file)).map(file => [`\`backend/${file.file}\``, pct(file.statements.pct), pct(file.lines.pct), pct(file.functions.pct), pct(file.branches.pct), ranges(missedLines[file.file] || []) || '—'])),
    '',
    '## Frontend coverage by file',
    '',
    table(['File', 'Statements', 'Lines', 'Functions', 'Branches'], (frontendCoverage?.files || []).sort((x, y) => x.lines.pct - y.lines.pct || x.file.localeCompare(y.file)).map(file => [`\`frontend/${file.file}\``, pct(file.statements.pct), pct(file.lines.pct), pct(file.functions.pct), pct(file.branches.pct)])),
    '',
    '## What is not covered',
    '',
    ...coverageExplained,
    '',
    'The browser tests in the [System Validation Report](system-validation-report.md) exercise the same code end to end but are not included in these figures.',
    '',
  ]
  fs.writeFileSync(path.join(out, 'code-coverage-report.md'), coverageLines.join('\n'))

  const branchFiles = cov => (cov?.files || []).map(file => ({ ...file, missing: cov.uncovered[file.file] || [] })).sort((x, y) => x.branches.pct - y.branches.pct || x.file.localeCompare(y.file))
  const branchLines = [
    header('Branch Coverage Report', info),
    'Branch coverage counts every path through each decision in the code: both outcomes of `if`/`else`, each side of `&&`, `||` and `??`, both results of `? :`, each `switch` case and default parameter values. A branch is covered when at least one test runs it. Measured with V8 coverage (c8 for the backend, Vitest for the frontend) during the unit and API integration tests.',
    '',
    '## Summary',
    '',
    table(['Code', 'Branches covered', 'Branch coverage'], [
      ...(backendCoverage ? [['Backend (Node/Express)', `${backendCoverage.total.branches.covered} of ${backendCoverage.total.branches.total}`, pct(backendCoverage.total.branches.pct)]] : []),
      ...(frontendCoverage ? [['Frontend (React)', `${frontendCoverage.total.branches.covered} of ${frontendCoverage.total.branches.total}`, pct(frontendCoverage.total.branches.pct)]] : []),
      ...(combined ? [['**Whole application**', `${combined.branches.covered} of ${combined.branches.total}`, pct(combined.branches.pct)]] : []),
    ]),
    '',
    'Branch coverage is lower than line coverage because one line often holds several branches. For example, `return res.status(error ? 500 : 200)` is one covered line but counts as two branches, and the 500 side only runs when a database call fails.',
    '',
    '## Backend branches by file',
    '',
    table(['File', 'Branches', 'Covered', 'Lines of uncovered branches'], branchFiles(backendCoverage).map(file => [`\`backend/${file.file}\``, file.branches.total, pct(file.branches.pct), [...new Set(file.missing.map(m => m.line))].sort((x, y) => x - y).join(', ') || '—'])),
    '',
    '## Frontend branches by file',
    '',
    table(['File', 'Branches', 'Covered', 'Lines of uncovered branches'], branchFiles(frontendCoverage).map(file => [`\`frontend/${file.file}\``, file.branches.total, pct(file.branches.pct), [...new Set(file.missing.map(m => m.line))].sort((x, y) => x - y).join(', ') || '—'])),
    '',
    '## Why the remaining branches are not covered',
    '',
    ...coverageExplained,
    '- **Defaults and fallbacks** such as `process.env.PORT || 5000`, `user?.name ?? null` and `error.message || "Could not reach the server"` count their unused side as an uncovered branch.',
    '',
    `The highlighted HTML reports mark each uncovered branch in the source: [backend](html/backend-coverage/index.html), [frontend](html/frontend-coverage/index.html).`,
    '',
  ]
  fs.writeFileSync(path.join(out, 'branch-coverage-report.md'), branchLines.join('\n'))

  // ------------------------------------------------- Index -------------------------------------------------
  const failingCases = results.filter(r => r.status === 'FAIL').map(r => r.id)
  fs.writeFileSync(path.join(out, 'README.md'), [
    '# Test reports (Deliverables Part-3)',
    '',
    `Generated ${info.date} from commit \`${info.commit}\`.`,
    '',
    table(['Report', 'Contents', 'Headline'], [
      ['[Unit Test Report](unit-test-report.md)', 'Backend unit, API integration and load tests; frontend component tests', `${b.passed + f.passed} passed, ${b.failed + f.failed} failed${todos.length ? `, ${todos.length} to-do for an open defect` : ''}`],
      ['[System Validation Report](system-validation-report.md)', 'All 33 Test Plan test cases against the running system in real browsers', `${statusCount.map(([key, n]) => `${n} ${key.toLowerCase()}`).join(', ')}`],
      ['[Code Coverage Report](code-coverage-report.md)', 'Statement, line and function coverage', combined ? `${pct(combined.lines.pct)} of lines` : '—'],
      ['[Branch Coverage Report](branch-coverage-report.md)', 'Coverage of every decision path', combined ? `${pct(combined.branches.pct)} of branches` : '—'],
    ]),
    '',
    failingCases.length ? `Failing test cases: ${failingCases.join(', ')} — see the defects in the System Validation Report.` : 'No test case failed.',
    '',
    'HTML reports: [backend coverage](html/backend-coverage/index.html), [frontend coverage](html/frontend-coverage/index.html), [browser tests](html/e2e-report/index.html). Raw results and logs: [raw](raw).',
    '',
    'Regenerate with `node scripts/generate-test-reports.mjs --with-backup-drill --with-tls` (MongoDB running; Docker for the TLS check; mongodump/mongorestore for the backup drill).',
    '',
  ].join('\n'))

  console.log(`\nReports written to ${relativeTo(root, out)}/ — ${failingCases.length ? `failing test cases: ${failingCases.join(', ')}` : 'no failing test cases'}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
