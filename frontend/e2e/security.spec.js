import { expect, test } from '@playwright/test'
import { API, auth, createAccount, logIn, unique, uploadMaterial } from './support/app.js'
import { ADMIN, db, mongoose, signToken } from './support/backend.js'

test.describe('Security validation (Test Plan 5.1)', () => {
  test('TC-Sec-01: passwords are stored only as bcrypt hashes with cost >= 10 and never returned', async ({ page, request }) => {
    const password = 'Secret1Password'
    const email = `${unique('sec')}@e2e.test`
    const registered = await request.post(`${API}/auth/register`, { data: { name: 'Hash Check', email, password, role: 'student' } })
    expect(await registered.text()).not.toContain(password)

    const stored = await (await db()).collection('users').findOne({ email })
    expect(stored.password).toBeUndefined()
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$(\d{2})\$/)
    expect(Number(stored.passwordHash.split('$')[2])).toBeGreaterThanOrEqual(10)
    expect(stored.passwordHash).not.toContain(password)

    const login = await request.post(`${API}/auth/login`, { data: { email, password } })
    const body = await login.text()
    expect(body).not.toContain(password)
    expect(body).not.toContain('passwordHash')
    const me = await request.get(`${API}/auth/me`, { headers: auth(JSON.parse(body).token) })
    expect(await me.text()).not.toContain('passwordHash')

    // The password is not kept by the client either.
    await logIn(page, email, password)
    const storage = await page.evaluate(() => JSON.stringify(localStorage))
    expect(storage).not.toContain(password)
  })

  test('TC-Sec-02: a Student token on Contributor-only and Admin-only requests gets 403 "Access denied"', async ({ request }) => {
    const student = await createAccount(request, 'student')
    const contributor = await createAccount(request, 'contributor')
    const checks = [
      ['post', '/questions', student], ['get', '/questions', student], ['post', '/quizzes', student],
      ['get', '/reports/contributor/quizzes', student], ['get', '/quizzes/all', student], ['get', '/admin', student],
      ['get', '/quizzes/all', contributor], ['get', '/reports/student/me', contributor],
    ]
    for (const [method, path, account] of checks) {
      const response = await request[method](`${API}${path}`, { headers: auth(account.token), data: method === 'post' ? {} : undefined })
      expect(response.status(), `${account.user.role} ${method.toUpperCase()} ${path}`).toBe(403)
      expect((await response.json()).message).toBe('Access denied')
    }
  })

  test('TC-Sec-03: missing, altered, 31-minute-old and revoked tokens all get 401', async ({ request }) => {
    const student = await createAccount(request, 'student')
    const me = headers => request.get(`${API}/auth/me`, { headers })

    expect((await me({})).status()).toBe(401)
    const altered = `${student.token.slice(0, -1)}${student.token.endsWith('a') ? 'b' : 'a'}`
    expect((await me(auth(altered))).status()).toBe(401)
    const old = signToken({ sub: student.user.id, role: 'student' }, Math.floor(Date.now() / 1000) - 31 * 60)
    expect((await me(auth(old))).status()).toBe(401)

    expect((await me(auth(student.token))).status()).toBe(200)
    expect((await request.post(`${API}/auth/logout`, { headers: auth(student.token) })).status()).toBe(200)
    expect((await me(auth(student.token))).status()).toBe(401)
  })

  test('TC-Sec-06: login success and failure, upload and deletion each write one audit entry with user, action and time', async ({ request }) => {
    const contributor = await createAccount(request, 'contributor')
    const userId = new mongoose.Types.ObjectId(contributor.user.id)
    const audit = (await db()).collection('audit_logs')
    const startedAt = new Date(Date.now() - 1000)

    await request.post(`${API}/auth/login`, { data: { email: contributor.email, password: 'WrongPassword1' } })
    const material = await uploadMaterial(request, contributor.token, { title: unique('Audited ') })
    const admin = await (await request.post(`${API}/auth/login`, { data: { email: ADMIN.email, password: ADMIN.password } })).json()
    expect((await request.delete(`${API}/materials/${material.id}`, { headers: auth(admin.token) })).status()).toBe(200)

    const entries = await audit.find({ timestamp: { $gte: startedAt } }).toArray()
    const ofUser = action => entries.filter(entry => entry.action === action && String(entry.userId) === String(userId))
    expect(ofUser('LOGIN_SUCCESS')).toHaveLength(1)
    expect(ofUser('LOGIN_FAILED')).toHaveLength(1)
    expect(ofUser('UPLOAD')).toHaveLength(1)
    expect(ofUser('UPLOAD')[0].targetId.toString()).toBe(material.id)
    const deletion = entries.find(entry => entry.action === 'DELETE' && String(entry.targetId) === material.id)
    expect(String(deletion.userId)).toBe(admin.user.id)
    for (const entry of entries) expect(entry.timestamp).toBeInstanceOf(Date)

    // The audit log is append-only: no API route changes or removes entries.
    for (const method of ['get', 'delete']) {
      expect((await request[method](`${API}/audit`, { headers: auth(admin.token) })).status()).toBe(404)
    }
  })

  test('TC-Sec-07: script and database-command input is rejected with 400 and not stored', async ({ request }) => {
    const contributor = await createAccount(request, 'contributor')
    const scripted = await request.post(`${API}/questions`, {
      headers: auth(contributor.token),
      data: { text: '<script>alert(1)</script>', options: ['a', 'b', 'c', 'd'], correctIndex: 0, topic: 'Algebra', difficulty: 'Easy' },
    })
    expect(scripted.status()).toBe(400)
    expect(await (await db()).collection('questions').countDocuments({ text: /<script>/ })).toBe(0)

    const operator = await request.post(`${API}/auth/login`, { data: { email: { $ne: null }, password: { $ne: null } } })
    expect(operator.status()).toBe(400)
    const command = await request.post(`${API}/auth/login`, { data: { email: "x' UNION SELECT * FROM users --", password: 'abcdef12' } })
    expect(command.status()).toBe(400)
    // Express 5 does not turn "subject[$ne]=x" into an object, so it reaches the search as an unknown
    // parameter named "subject[$ne]" and is ignored rather than run as a MongoDB operator.
    const plain = await (await request.get(`${API}/materials`, { headers: auth(contributor.token) })).json()
    const queryOperator = await request.get(`${API}/materials?subject[$ne]=x`, { headers: auth(contributor.token) })
    expect(queryOperator.status()).toBe(200)
    expect((await queryOperator.json()).total).toBe(plain.total)
    expect((await request.get(`${API}/materials?subject=x`, { headers: auth(contributor.token) })).status()).toBe(200)
  })
})
