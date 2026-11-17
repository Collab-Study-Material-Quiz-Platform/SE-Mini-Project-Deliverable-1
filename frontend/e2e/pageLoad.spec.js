import { expect, test } from '@playwright/test'
import { createAccount, createPublishedQuiz, createQuestions, unique, uploadMaterial } from './support/app.js'

// TC-Perf-03 (CSQ-NF-006): 95% of page loads finish within 3 s on a 10 Mbps connection.
// Loads the production build in Chromium with the network throttled to 10 Mbps and the cache disabled,
// and times each load from navigation until the page's content, including its API data, is shown.
const PRODUCTION_BUILD = 'http://localhost:4173'
const LOADS_PER_PAGE = 10
const TARGET_MS = 3000
const TEN_MBPS = (10 * 1000 * 1000) / 8

test.skip(({ browserName }) => browserName !== 'chromium', 'Network throttling uses the Chromium DevTools protocol')

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length))) - 1]
}

test('TC-Perf-03: main pages load within 3 s for at least 95% of loads at 10 Mbps', async ({ browser, request }, testInfo) => {
  test.setTimeout(240_000)
  const contributor = await createAccount(request, 'contributor')
  const student = await createAccount(request, 'student')
  for (let i = 0; i < 10; i += 1) await uploadMaterial(request, contributor.token, { title: unique('Load test material ') })
  const questions = await createQuestions(request, contributor.token, 20)
  await createPublishedQuiz(request, contributor.token, questions.slice(0, 10))
  await createPublishedQuiz(request, contributor.token, questions.slice(10))

  const pages = [
    { name: 'Home', route: '#/', account: null, ready: page => page.getByText('All systems operational') },
    { name: 'Create account', route: '#/register', account: null, ready: page => page.getByRole('button', { name: 'Create account' }) },
    { name: 'Log in', route: '#/login', account: null, ready: page => page.getByRole('button', { name: 'Log in' }) },
    { name: 'Materials', route: '#/materials', account: student, ready: page => page.getByText(/materials? found/) },
    { name: 'Upload material', route: '#/materials/upload', account: contributor, ready: page => page.getByLabel('File') },
    { name: 'Question bank', route: '#/questions', account: contributor, ready: page => page.locator('.qb-item').first() },
    { name: 'Published quizzes', route: '#/quizzes', account: student, ready: page => page.getByRole('button', { name: 'Start quiz' }).first() },
    { name: 'Performance', route: '#/performance', account: student, ready: page => page.getByText('Overall average') },
    { name: 'System status', route: '#/status', account: null, ready: page => page.getByText('Operational', { exact: true }) },
  ]

  const results = []
  for (const target of pages) {
    const durations = []
    for (let i = 0; i < LOADS_PER_PAGE; i += 1) {
      const context = await browser.newContext()
      if (target.account) {
        await context.addInitScript(({ token, user }) => {
          localStorage.setItem('authToken', token)
          localStorage.setItem('authUser', JSON.stringify(user))
        }, target.account)
      }
      const page = await context.newPage()
      const cdp = await context.newCDPSession(page)
      await cdp.send('Network.enable')
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 20, downloadThroughput: TEN_MBPS, uploadThroughput: TEN_MBPS })

      const startedAt = Date.now()
      await page.goto(`${PRODUCTION_BUILD}/${target.route}`)
      await expect(target.ready(page)).toBeVisible({ timeout: 15_000 })
      durations.push(Date.now() - startedAt)
      await context.close()
    }
    const sorted = durations.slice().sort((a, b) => a - b)
    results.push({
      page: target.name,
      route: target.route,
      loads: durations.length,
      meanMs: Math.round(durations.reduce((sum, ms) => sum + ms, 0) / durations.length),
      p50Ms: percentile(sorted, 50),
      p95Ms: percentile(sorted, 95),
      maxMs: sorted.at(-1),
      durations,
    })
  }

  const all = results.flatMap(result => result.durations).sort((a, b) => a - b)
  const summary = {
    loads: all.length,
    p95Ms: percentile(all, 95),
    withinTargetPercent: Math.round((all.filter(ms => ms <= TARGET_MS).length / all.length) * 1000) / 10,
    network: '10 Mbps down and up, 20 ms latency, cache disabled',
    pages: results,
  }
  await testInfo.attach('page-load-results.json', { body: JSON.stringify(summary, null, 2), contentType: 'application/json' })
  console.log(results.map(result => `${result.page.padEnd(18)} p50 ${result.p50Ms} ms  p95 ${result.p95Ms} ms  max ${result.maxMs} ms`).join('\n'))

  expect(summary.withinTargetPercent).toBeGreaterThanOrEqual(95)
  expect(summary.p95Ms).toBeLessThanOrEqual(TARGET_MS)
})
