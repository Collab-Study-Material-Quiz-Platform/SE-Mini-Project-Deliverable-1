import { expect, test } from '@playwright/test'
import { API, auth, createAccount, logIn, nav, unique } from './support/app.js'
import { ADMIN, db } from './support/backend.js'

test.describe('Authentication and access control', () => {
  test('TC-Auth-01: a visitor registers as Student or Contributor within 3 s; a reused email is refused', async ({ page }) => {
    await page.goto('/#/register')
    await expect(page.getByRole('radio')).toHaveCount(2)
    await expect(page.getByRole('radio', { name: /Admin/i })).toHaveCount(0)

    const email = `${unique('student')}@e2e.test`
    for (const [role, address] of [['Student', email], ['Contributor', `${unique('contributor')}@e2e.test`]]) {
      await page.getByLabel('Full name').fill(`New ${role}`)
      await page.getByLabel('Email address').fill(address)
      await page.getByLabel('Password').fill('abcdef12')
      await page.getByRole('radio', { name: new RegExp(role) }).check()
      const startedAt = Date.now()
      await page.getByRole('button', { name: 'Create account' }).click()
      await expect(page.getByRole('status')).toHaveText(`Welcome, New ${role}! Your account has been created.`)
      expect(Date.now() - startedAt).toBeLessThan(3000)
    }

    const stored = await (await db()).collection('users').findOne({ email })
    expect(stored.role).toBe('student')

    await page.getByLabel('Full name').fill('Someone Else')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password').fill('abcdef12')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('alert')).toHaveText('Email already registered')
  })

  test('TC-Auth-05: "abc12" and "abcdefgh" are rejected with "Password too weak"; "abcdef12" is accepted', async ({ page }) => {
    await page.goto('/#/register')
    const email = `${unique('pw')}@e2e.test`
    await page.getByLabel('Full name').fill('Password Tester')
    await page.getByLabel('Email address').fill(email)
    for (const weak of ['abc12', 'abcdefgh']) {
      await page.getByLabel('Password').fill(weak)
      await page.getByRole('button', { name: 'Create account' }).click()
      await expect(page.getByRole('alert')).toHaveText('Password too weak')
    }
    expect(await (await db()).collection('users').countDocuments({ email })).toBe(0)

    await page.getByLabel('Password').fill('abcdef12')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('status')).toContainText('Your account has been created')
  })

  test('TC-Auth-05: the server also rejects a weak password sent directly to the API', async ({ request }) => {
    const response = await request.post(`${API}/auth/register`, { data: { name: 'Api Tester', email: `${unique('api')}@e2e.test`, password: 'abcdefgh' } })
    expect(response.status()).toBe(400)
    expect((await response.json()).message).toBe('Password too weak')
  })

  test('TC-Auth-02: correct credentials open the home page for the role; wrong ones show the error and create no session', async ({ page, request }) => {
    const student = await createAccount(request, 'student')

    await page.goto('/#/login')
    await page.getByLabel('Email address').fill(student.email)
    await page.getByLabel('Password').fill('WrongPassword1')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByRole('alert')).toHaveText('Invalid email or password')
    expect(await page.evaluate(() => localStorage.getItem('authToken'))).toBeNull()

    await page.getByLabel('Email address').fill(`${unique('nobody')}@e2e.test`)
    await page.getByLabel('Password').fill('abcdef12')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByRole('alert')).toHaveText('Invalid email or password')

    await logIn(page, student.email, student.password)
    await expect(nav(page).getByRole('link', { name: 'Quizzes' })).toBeVisible()
    await expect(nav(page).getByRole('button', { name: 'Log out' })).toBeVisible()
  })

  test('TC-Auth-03: each role sees only its permitted features, and forbidden requests get 403 "Access denied"', async ({ page, request }) => {
    const student = await createAccount(request, 'student')
    await logIn(page, student.email, student.password)
    await expect(nav(page).getByRole('link')).toHaveText(['Home', 'Create account', 'Log in', 'System Status', 'Materials', 'Quizzes', 'Performance'])
    await page.goto('/#/questions')
    await expect(page.getByRole('alert')).toContainText('Only Contributors can use the question bank')

    for (const [method, path] of [['post', '/questions'], ['get', '/quizzes/all'], ['get', '/admin']]) {
      const response = await request[method](`${API}${path}`, { headers: auth(student.token), data: method === 'post' ? {} : undefined })
      expect(response.status(), `${method} ${path}`).toBe(403)
      expect((await response.json()).message).toBe('Access denied')
    }

    const admin = await (await request.post(`${API}/auth/login`, { data: { email: ADMIN.email, password: ADMIN.password } })).json()
    expect(admin.user.role).toBe('admin')
    expect((await request.post(`${API}/materials`, { headers: auth(admin.token), multipart: { title: 'x' } })).status()).toBe(403)
  })

  test('TC-Auth-04: logout ends the session; protected pages show the login page and the old token is refused', async ({ page, request }) => {
    const student = await createAccount(request, 'student')
    await logIn(page, student.email, student.password)
    const token = await page.evaluate(() => localStorage.getItem('authToken'))

    await nav(page).getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL(/#\/login$/)
    expect(await page.evaluate(() => localStorage.getItem('authToken'))).toBeNull()

    await page.goto('/#/materials')
    await expect(page.getByRole('heading', { name: 'Log in to your account' })).toBeVisible()
    expect((await request.get(`${API}/auth/me`, { headers: auth(token) })).status()).toBe(401)
  })
})
